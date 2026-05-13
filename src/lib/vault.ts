/**
 * Vault module v1 — per-tenant knowledge base for agents (W5).
 *
 * Eng review locked decisions:
 *   - 4A-A: per-tenant pgvector index for constant search latency at scale.
 *     v1 implements as shared table + RLS + composite index; v2 migrates
 *     to Postgres-native partitioning at firm 10+. See migrations/002_vault.sql.
 *   - 6C-B (user-overridden, was outside-voice 6C-A): rich Vault v1 with
 *     bilingual + provenance. This module ships the foundation; bilingual
 *     entity extraction (GSTIN/PAN/CIN) lands in vault-extractors.ts
 *     follow-up.
 *
 * What v1 does:
 *   - ingest(title, content, metadata): chunk + embed + store with provenance
 *   - query(q, limit, filter): semantic + structured filter, returns chunks
 *     with source citation
 *   - dedup via SHA-256 content hash; re-ingesting same content is a no-op
 *   - bilingual via Cohere embed-multilingual-v3 (1024 dims)
 *
 * Configuration (env vars):
 *   COHERE_API_KEY (preferred): bilingual Hindi/English embeddings
 *   OPENAI_API_KEY (fallback): text-embedding-3-small (English-skewed but works)
 *
 * If neither key is set, ingest stores chunks with NULL embeddings and query
 * returns empty (dev mode). Logs a warning so this isn't silent.
 *
 * Tests: test/vault.test.ts mocks the embedding provider + sql client.
 */

import { createHash } from "crypto";
import type { VaultChunk, VaultHelper, VaultQueryOptions } from "./agent-sdk-helpers";
import { mergeEntitiesIntoMetadata } from "./vault-extractors";

// ─── Config + DI ───────────────────────────────────────────────────────────

export interface VaultConfig {
  cohereApiKey?: string;
  openaiApiKey?: string;
  fetchImpl?: typeof fetch;
}

function getConfig(overrides?: Partial<VaultConfig>): VaultConfig {
  return {
    cohereApiKey: overrides?.cohereApiKey ?? process.env.COHERE_API_KEY,
    openaiApiKey: overrides?.openaiApiKey ?? process.env.OPENAI_API_KEY,
    fetchImpl: overrides?.fetchImpl ?? globalThis.fetch,
  };
}

// ─── Chunking ──────────────────────────────────────────────────────────────
// Fixed 512-token chunks with 64-token overlap, per design doc Vault spec.
// Token-counting heuristic: ~4 chars per token (English) / ~3 chars per token
// (Devanagari). For v1, use char-based chunking with conservative bounds; v2
// will swap in tiktoken once we ship a tiktoken-equivalent for Devanagari.

const TARGET_CHUNK_CHARS = 1800; // ≈ 450 English tokens, conservative for mixed
const OVERLAP_CHARS = 240; // ≈ 60 tokens

export function chunkText(text: string): Array<{ text: string; chunkIndex: number }> {
  if (text.length === 0) return [];
  const chunks: Array<{ text: string; chunkIndex: number }> = [];
  let start = 0;
  let chunkIndex = 0;
  while (start < text.length) {
    const end = Math.min(start + TARGET_CHUNK_CHARS, text.length);
    // Prefer splitting on a paragraph boundary near `end` to keep semantic units intact.
    const slice = text.slice(start, end);
    let splitAt = slice.length;
    if (end < text.length) {
      const lastBreak = Math.max(
        slice.lastIndexOf("\n\n"),
        slice.lastIndexOf(". "),
        slice.lastIndexOf("? "),
        slice.lastIndexOf("! ")
      );
      if (lastBreak > TARGET_CHUNK_CHARS / 2) {
        splitAt = lastBreak + 1;
      }
    }
    chunks.push({ text: slice.slice(0, splitAt).trim(), chunkIndex });
    chunkIndex++;
    if (end >= text.length) break;
    start = start + splitAt - OVERLAP_CHARS;
    if (start < 0) start = 0;
  }
  return chunks.filter((c) => c.text.length > 0);
}

// ─── Embedding ─────────────────────────────────────────────────────────────

export interface EmbeddingProvider {
  name: string;
  dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}

export function pickProvider(cfg: VaultConfig): EmbeddingProvider | null {
  if (cfg.cohereApiKey) return cohereProvider(cfg);
  if (cfg.openaiApiKey) return openaiProvider(cfg);
  return null;
}

function cohereProvider(cfg: VaultConfig): EmbeddingProvider {
  return {
    name: "cohere/embed-multilingual-v3.0",
    dimensions: 1024,
    async embed(texts: string[]): Promise<number[][]> {
      const res = await cfg.fetchImpl!(
        "https://api.cohere.com/v1/embed",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cfg.cohereApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "embed-multilingual-v3.0",
            texts,
            input_type: "search_document",
          }),
        }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Cohere embed failed: HTTP ${res.status} — ${text}`);
      }
      const json = (await res.json()) as { embeddings: number[][] };
      return json.embeddings;
    },
  };
}

function openaiProvider(cfg: VaultConfig): EmbeddingProvider {
  return {
    name: "openai/text-embedding-3-small",
    dimensions: 1536, // truncated to 1024 for compat with the schema
    async embed(texts: string[]): Promise<number[][]> {
      const res = await cfg.fetchImpl!(
        "https://api.openai.com/v1/embeddings",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cfg.openaiApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "text-embedding-3-small",
            input: texts,
            // Truncate to match the schema's vector(1024) dim. OpenAI supports
            // dimensions param on embedding-3 models for native truncation.
            dimensions: 1024,
          }),
        }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`OpenAI embed failed: HTTP ${res.status} — ${text}`);
      }
      const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
      return json.data.map((d) => d.embedding);
    },
  };
}

// ─── pgvector serialization ────────────────────────────────────────────────
// postgres.js doesn't natively serialize vectors; pass them as text in
// pgvector's `[1.0, 2.0, ...]` literal format.

function vectorLiteral(vec: number[]): string {
  return `[${vec.map((v) => v.toFixed(6)).join(",")}]`;
}

// ─── VaultHelper implementation ────────────────────────────────────────────

export interface VaultHelperContext {
  /** Active firm. Used for tenant-scoped queries + RLS. */
  firmId: string;
}

export function buildVaultHelper(
  ctx: VaultHelperContext,
  configOverrides?: Partial<VaultConfig>
): VaultHelper {
  const cfg = getConfig(configOverrides);
  const provider = pickProvider(cfg);
  return {
    async ingest(opts: {
      title: string;
      content: string;
      metadata?: Record<string, unknown>;
    }): Promise<{ docId: string; chunkCount: number }> {
      const { sql } = await import("./db-postgres");
      if (!sql) throw new Error("vault.ingest: DATABASE_URL not configured");
      const contentHash = createHash("sha256").update(opts.content).digest("hex");
      const docId = `vdoc_${contentHash.slice(0, 16)}`;

      // Dedup: if we've already ingested this exact content for this firm,
      // return the existing doc id. Idempotency is mandatory; agents may
      // re-ingest from cron jobs that didn't track success.
      const existing = (await sql`
        SELECT id FROM vault_documents
        WHERE company_id = ${ctx.firmId} AND content_hash = ${contentHash}
        LIMIT 1
      `) as Array<{ id: string }>;
      if (existing[0]) {
        const chunks = (await sql`
          SELECT count(*)::int AS n FROM vault_chunks WHERE document_id = ${existing[0].id}
        `) as Array<{ n: number }>;
        return { docId: existing[0].id, chunkCount: chunks[0]?.n ?? 0 };
      }

      const chunks = chunkText(opts.content);
      if (chunks.length === 0) {
        throw new Error("vault.ingest: empty content cannot be ingested");
      }

      // Embed in a single batch call; providers handle batching up to their limits.
      let embeddings: Array<number[] | null>;
      if (!provider) {
        console.warn(
          "[vault] No embedding provider configured (COHERE_API_KEY or OPENAI_API_KEY); ingesting chunks with NULL embeddings (dev mode)"
        );
        embeddings = chunks.map(() => null);
      } else {
        const vectors = await provider.embed(chunks.map((c) => c.text));
        embeddings = vectors;
      }

      // Upsert document + chunks in a single transaction so partial failures
      // don't leave dangling document rows.
      // Cast tx → typeof sql because postgres.js TransactionSql call signatures
      // exist at runtime but aren't always exposed in the typings.
      // Auto-extract Indian-context structured entities (GSTIN/PAN/CIN/IFSC)
      // from the document content and merge into metadata. User-supplied
      // metadata wins on conflicts.
      const enrichedMetadata = mergeEntitiesIntoMetadata(opts.metadata, opts.content);

      await sql.begin(async (tx) => {
        const txSql = tx as unknown as typeof sql;
        await txSql`
          INSERT INTO vault_documents (id, company_id, title, content_hash, metadata)
          VALUES (${docId}, ${ctx.firmId}, ${opts.title}, ${contentHash}, ${
            JSON.stringify(enrichedMetadata)
          })
        `;
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const embedding = embeddings[i];
          await txSql`
            INSERT INTO vault_chunks (
              id, document_id, company_id, chunk_index, text, embedding
            ) VALUES (
              ${`vchunk_${docId}_${i}`},
              ${docId},
              ${ctx.firmId},
              ${chunk.chunkIndex},
              ${chunk.text},
              ${embedding ? vectorLiteral(embedding) : null}
            )
          `;
        }
      });

      return { docId, chunkCount: chunks.length };
    },

    async query(opts: VaultQueryOptions): Promise<VaultChunk[]> {
      const { sql } = await import("./db-postgres");
      if (!sql) throw new Error("vault.query: DATABASE_URL not configured");
      const limit = opts.limit ?? 5;
      if (!provider) {
        console.warn("[vault] No embedding provider configured; query returns empty (dev mode)");
        return [];
      }
      const [queryEmbedding] = await provider.embed([opts.q]);
      const queryVec = vectorLiteral(queryEmbedding);

      // Cosine similarity: 1 - (embedding <=> query) gives similarity in [0,1]
      // where 1 is identical. pgvector's <=> operator returns cosine DISTANCE
      // (lower is closer); we convert to similarity in the result.
      // ORDER BY embedding <=> queryVec uses the HNSW index.
      const rows = (await sql`
        SELECT
          c.id AS chunk_id,
          c.text,
          d.id AS doc_id,
          d.title AS doc_title,
          c.page,
          c.paragraph,
          (1 - (c.embedding <=> ${queryVec}::vector))::float AS score
        FROM vault_chunks c
        JOIN vault_documents d ON d.id = c.document_id
        WHERE c.company_id = ${ctx.firmId}
          AND c.embedding IS NOT NULL
          AND d.deleted_at IS NULL
        ORDER BY c.embedding <=> ${queryVec}::vector
        LIMIT ${limit}
      `) as Array<{
        chunk_id: string;
        text: string;
        doc_id: string;
        doc_title: string;
        page: number | null;
        paragraph: number | null;
        score: number;
      }>;

      return rows.map((r) => ({
        chunkId: r.chunk_id,
        text: r.text,
        source: {
          docId: r.doc_id,
          docTitle: r.doc_title,
          page: r.page ?? undefined,
          paragraph: r.paragraph ?? undefined,
        },
        score: r.score,
      }));
    },
  };
}

// ─── Re-embed ───────────────────────────────────────────────────────────────
// Re-runs the embedding provider over vault_chunks for a company. Two modes:
//   - missing (default): only chunks where embedding IS NULL (e.g. ingested
//     during a dev-mode window when COHERE_API_KEY wasn't set)
//   - all: every chunk (use when switching embedding model / dimensions)
//
// Returns a summary so the admin UI can show "embedded 23 chunks" or
// "skipped — 0 chunks needed embedding".

export interface ReembedSummary {
  totalChunks: number;
  embedded: number;
  skipped: number;
  failed: number;
  provider: string | null;
}

export async function reembedAllForCompany(
  companyId: string,
  options?: {
    mode?: "missing" | "all";
    configOverrides?: Partial<VaultConfig>;
    /** Batch size for the embedding provider. Default 32. */
    batchSize?: number;
  }
): Promise<ReembedSummary> {
  const mode = options?.mode ?? "missing";
  const batchSize = options?.batchSize ?? 32;
  const cfg = getConfig(options?.configOverrides);
  const provider = pickProvider(cfg);

  const { sql } = await import("./db-postgres");
  if (!sql) {
    return { totalChunks: 0, embedded: 0, skipped: 0, failed: 0, provider: null };
  }
  if (!provider) {
    return { totalChunks: 0, embedded: 0, skipped: 0, failed: 0, provider: null };
  }

  // Discover candidate chunks. `mode=missing` is the safe default — never
  // overwrites existing embeddings.
  const candidates = (mode === "all"
    ? ((await sql`
        SELECT id, text FROM vault_chunks
        WHERE company_id = ${companyId}
        ORDER BY id
      `) as Array<{ id: string; text: string }>)
    : ((await sql`
        SELECT id, text FROM vault_chunks
        WHERE company_id = ${companyId} AND embedding IS NULL
        ORDER BY id
      `) as Array<{ id: string; text: string }>));

  if (candidates.length === 0) {
    return {
      totalChunks: 0,
      embedded: 0,
      skipped: 0,
      failed: 0,
      provider: provider.name,
    };
  }

  let embedded = 0;
  let failed = 0;
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    try {
      const vectors = await provider.embed(batch.map((c) => c.text));
      for (let j = 0; j < batch.length; j++) {
        const vec = vectors[j];
        if (!vec) {
          failed++;
          continue;
        }
        await sql`
          UPDATE vault_chunks
          SET embedding = ${vectorLiteral(vec)}::vector
          WHERE id = ${batch[j].id} AND company_id = ${companyId}
        `;
        embedded++;
      }
    } catch (err) {
      console.warn(
        `[vault] re-embed batch ${i}/${candidates.length} failed:`,
        err
      );
      failed += batch.length;
    }
  }

  return {
    totalChunks: candidates.length,
    embedded,
    skipped: 0,
    failed,
    provider: provider.name,
  };
}
