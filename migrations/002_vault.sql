-- Migration: 002_vault
-- Purpose: Schema for the Vault knowledge base module (W5). Per-tenant
-- knowledge store that agents query for context.
--
-- Per locked decision 4A-A: per-tenant pgvector index for constant search
-- latency at scale. v1 implements this as a shared table with `company_id`
-- column + RLS + composite index (company_id, embedding HNSW). At <20 firms,
-- this gives per-tenant performance characteristics. v2 (post-firm-#10)
-- migrates to Postgres-native partitioning by company_id for true per-tenant
-- index objects. Migration path documented in migrations/README.md.
--
-- Apply order: AFTER 001_rls_policies.sql is applied (vault tables are
-- tenant-scoped and need RLS).

BEGIN;

-- ─── pgvector extension ────────────────────────────────────────────────────
-- Available on Supabase by default. Self-hosted Postgres needs `CREATE EXTENSION`.

CREATE EXTENSION IF NOT EXISTS vector;

-- ─── vault_documents ───────────────────────────────────────────────────────
-- One row per ingested document. Tracks provenance + dedup via content_hash.

CREATE TABLE IF NOT EXISTS vault_documents (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  /** SHA-256 of content; used to dedup re-ingest of identical docs. */
  content_hash TEXT NOT NULL,
  /** Free-form JSON: doc_type, source_url, author, etc. */
  metadata JSONB,
  /** Soft delete: tombstone instead of hard delete so chunks can be tombstoned consistently. */
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, content_hash)
);

CREATE INDEX IF NOT EXISTS idx_vault_documents_company ON vault_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_vault_documents_metadata ON vault_documents USING gin(metadata);

-- ─── vault_chunks ──────────────────────────────────────────────────────────
-- Each document is split into chunks; each chunk gets its own embedding +
-- provenance pointer back to (document, page, paragraph).

CREATE TABLE IF NOT EXISTS vault_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES vault_documents(id) ON DELETE CASCADE,
  /** Denormalized from documents for query perf + RLS isolation at the chunk level. */
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  /**
   * Cohere embed-multilingual-v3 = 1024 dims. If the embedding provider
   * changes, a separate migration adds a new column + re-embeds; do NOT
   * resize this column in place (pgvector dim change is a recreate).
   */
  embedding vector(1024),
  /** Provenance: 1-indexed page in source doc, NULL if not paginated (e.g. WhatsApp message). */
  page INTEGER,
  /** 1-indexed paragraph within the page. NULL if structure is flat. */
  paragraph INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_vault_chunks_document ON vault_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_vault_chunks_company ON vault_chunks(company_id);

-- HNSW index for cosine similarity. Build params tuned for ~10K chunks/firm
-- with up to 20 firms in v1; revisit at firm 10+. ef_construction=64 balances
-- index build time vs query quality.
CREATE INDEX IF NOT EXISTS idx_vault_chunks_embedding
  ON vault_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ─── RLS policies ──────────────────────────────────────────────────────────
-- Same pattern as 001_rls_policies.sql: bind to current_company_id() GUC.
-- These are added here (not 001) because the vault tables didn't exist yet.

ALTER TABLE vault_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_documents FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vault_documents_tenant_isolation ON vault_documents;
CREATE POLICY vault_documents_tenant_isolation ON vault_documents
  FOR ALL
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

ALTER TABLE vault_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_chunks FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vault_chunks_tenant_isolation ON vault_chunks;
CREATE POLICY vault_chunks_tenant_isolation ON vault_chunks
  FOR ALL
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

COMMIT;

-- ─── v2 migration path (documented, not executed) ──────────────────────────
-- When firm count exceeds ~10, convert vault_chunks to a partitioned table:
--
--   ALTER TABLE vault_chunks RENAME TO vault_chunks_legacy;
--   CREATE TABLE vault_chunks (
--     ... same columns ...
--   ) PARTITION BY LIST (company_id);
--
--   -- For each firm:
--   CREATE TABLE vault_chunks_firm_jaa PARTITION OF vault_chunks
--     FOR VALUES IN ('firm_jaa');
--   CREATE INDEX ON vault_chunks_firm_jaa USING hnsw (embedding vector_cosine_ops);
--
--   INSERT INTO vault_chunks SELECT * FROM vault_chunks_legacy;
--   DROP TABLE vault_chunks_legacy;
--
-- Tenant-provisioning state machine (W9) handles partition creation + index
-- build per new firm. Keep this comment block here as the canonical design.
