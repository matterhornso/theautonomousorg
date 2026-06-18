-- Migration: 012_recorder_keys
-- Purpose: Per-workspace API keys for the device-ingest webhook
--   (POST /api/recorder/ingest). The OEM/recorder pushes audio authenticated by
--   one of these scoped keys — NOT the cross-service INTERNAL_SECRET.
--
-- Only the SHA-256 hash of a key is stored; the raw key is shown once at
-- creation and never persisted. A request presents the raw key, we hash it and
-- look up the owning company. Keys are revocable (soft, via revoked_at).
--
-- Resolution is a privileged server path: it looks a key up by hash across all
-- companies (it has no tenant context yet — the key IS what resolves the
-- tenant). The app connects as the Postgres superuser, which bypasses RLS, so
-- the lookup works; the RLS policy below is defense-in-depth for a future
-- non-superuser admin surface that lists/revokes keys within one company.
--
-- Forward-only, idempotent. Apply after 001 (companies).
-- Apply with: psql "$DATABASE_URL" -f migrations/012_recorder_keys.sql

BEGIN;

CREATE TABLE IF NOT EXISTS recorder_api_keys (
  id            TEXT PRIMARY KEY,
  company_id    TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  key_hash      TEXT NOT NULL UNIQUE,
  label         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at  TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_recorder_api_keys_company
  ON recorder_api_keys(company_id);

ALTER TABLE recorder_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE recorder_api_keys FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recorder_api_keys_tenant_isolation ON recorder_api_keys;
CREATE POLICY recorder_api_keys_tenant_isolation ON recorder_api_keys
  FOR ALL
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

COMMIT;
