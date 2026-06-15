/**
 * Per-workspace API keys for the device-ingest webhook
 * (POST /api/recorder/ingest). The recorder/OEM authenticates with one of these
 * scoped keys instead of the cross-service INTERNAL_SECRET.
 *
 * Security: only the SHA-256 hash is stored (see migration 012). The raw key is
 * returned once at creation and never persisted. Resolution hashes the presented
 * key and looks up the owning company; revoked keys never resolve.
 */

import { randomUUID } from "crypto";
import { hashApiKey } from "./api-keys";

type SqlTemplate = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<unknown[]>;

async function getSql(): Promise<SqlTemplate | null> {
  const mod = await import("./db-postgres");
  return ((mod as { sql?: unknown }).sql as SqlTemplate | undefined) ?? null;
}

/** `tar_` (The Autonomous Recorder) + 64 hex chars. */
export function generateRecorderKey(): { key: string; hash: string } {
  const raw = `tar_${randomUUID().replace(/-/g, "")}${randomUUID().replace(/-/g, "")}`;
  return { key: raw, hash: hashApiKey(raw) };
}

export interface RecorderKeyRow {
  id: string;
  companyId: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

/**
 * Mint a key for a company. Returns the RAW key exactly once — store it
 * somewhere safe; only its hash is kept. Returns null if there's no DB.
 */
export async function createRecorderKey(
  companyId: string,
  label?: string
): Promise<{ id: string; key: string } | null> {
  const sql = await getSql();
  if (!sql) return null;
  const { key, hash } = generateRecorderKey();
  const id = `rk_${randomUUID()}`;
  await sql`
    INSERT INTO recorder_api_keys (id, company_id, key_hash, label)
    VALUES (${id}, ${companyId}, ${hash}, ${label ?? null})
  `;
  return { id, key };
}

/**
 * Resolve the company that owns a presented raw key. Hashes the key, matches a
 * non-revoked row, and stamps last_used_at. Returns null for missing/unknown/
 * revoked keys (the caller should answer 401).
 */
export async function resolveCompanyByRecorderKey(
  rawKey: string | null | undefined
): Promise<{ companyId: string; keyId: string } | null> {
  const sql = await getSql();
  if (!sql || !rawKey || !rawKey.trim()) return null;
  const hash = hashApiKey(rawKey.trim());
  const rows = (await sql`
    SELECT id, company_id
    FROM recorder_api_keys
    WHERE key_hash = ${hash} AND revoked_at IS NULL
    LIMIT 1
  `) as Array<{ id: string; company_id: string }>;
  const row = rows[0];
  if (!row) return null;
  // Best-effort usage stamp; never block ingestion on it (but do log, so a
  // persistent DB failure on this path isn't completely invisible).
  try {
    await sql`UPDATE recorder_api_keys SET last_used_at = now() WHERE id = ${row.id}`;
  } catch (err) {
    console.warn("[recorder-keys] last_used_at stamp failed:", err);
  }
  return { companyId: row.company_id, keyId: row.id };
}

export async function listRecorderKeys(
  companyId: string
): Promise<RecorderKeyRow[]> {
  const sql = await getSql();
  if (!sql) return [];
  const rows = (await sql`
    SELECT id, company_id, label, created_at, last_used_at, revoked_at
    FROM recorder_api_keys
    WHERE company_id = ${companyId}
    ORDER BY created_at DESC
  `) as Array<{
    id: string;
    company_id: string;
    label: string | null;
    created_at: string;
    last_used_at: string | null;
    revoked_at: string | null;
  }>;
  return rows.map((r) => ({
    id: r.id,
    companyId: r.company_id,
    label: r.label,
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at,
    revokedAt: r.revoked_at,
  }));
}

/** Soft-revoke a key by id. Returns true if a row was revoked. */
export async function revokeRecorderKey(keyId: string): Promise<boolean> {
  const sql = await getSql();
  if (!sql) return false;
  const rows = (await sql`
    UPDATE recorder_api_keys
    SET revoked_at = now()
    WHERE id = ${keyId} AND revoked_at IS NULL
    RETURNING id
  `) as Array<{ id: string }>;
  return rows.length > 0;
}
