-- Migration: 004_tenant_provisioning
-- Purpose: Per-firm provisioning state on the `companies` table. Backs the
-- tenant-provisioner state machine (src/lib/tenant-provisioner.ts).
--
-- Eng review locked decisions:
--   - 1D-A: per-firm AWS KMS CMK alias (column landed here, KMS module ships in W2)
--   - 9: tenant provisioning state machine; idempotent across restarts
--
-- Apply order: any time after 003.

BEGIN;

-- ─── companies columns ─────────────────────────────────────────────────────
-- We use ADD COLUMN IF NOT EXISTS so the migration is idempotent across
-- re-applies and across staging vs prod where the column may already exist.

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS spoc_phone TEXT,
  ADD COLUMN IF NOT EXISTS kms_key_alias TEXT,
  ADD COLUMN IF NOT EXISTS langfuse_project_id TEXT,
  ADD COLUMN IF NOT EXISTS provisioning_state TEXT
    CHECK (provisioning_state IN (
      'created',
      'schema_applied',
      'kms_provisioned',
      'langfuse_provisioned',
      'vault_initialized',
      'ready',
      'failed'
    )),
  ADD COLUMN IF NOT EXISTS provisioning_error TEXT,
  ADD COLUMN IF NOT EXISTS provisioned_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_companies_provisioning_state
  ON companies(provisioning_state)
  WHERE provisioning_state IS NOT NULL AND provisioning_state <> 'ready';

-- ─── tally_agent_certs ─────────────────────────────────────────────────────
-- Per-firm allowlist of mTLS cert fingerprints for the Tally on-prem agent.
-- One firm can have multiple certs (replicas, backup machines). Revocation
-- is via revoked_at, not row deletion, so audit history is preserved.

CREATE TABLE IF NOT EXISTS tally_agent_certs (
  id TEXT PRIMARY KEY,
  firm_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  cert_fingerprint TEXT NOT NULL,
  cert_subject TEXT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  UNIQUE(firm_id, cert_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_tally_agent_certs_firm
  ON tally_agent_certs(firm_id) WHERE revoked_at IS NULL;

ALTER TABLE tally_agent_certs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tally_agent_certs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tally_agent_certs_tenant_isolation ON tally_agent_certs;
CREATE POLICY tally_agent_certs_tenant_isolation ON tally_agent_certs
  FOR ALL
  USING (firm_id = public.current_company_id())
  WITH CHECK (firm_id = public.current_company_id());

-- ─── tally_inbox ───────────────────────────────────────────────────────────
-- Raw payloads from the on-prem agent, awaiting agent processing.
-- payload_hash is a SHA-256 of the raw body so the on-prem agent's retry
-- loop is idempotent: duplicate payload = no-op.

CREATE TABLE IF NOT EXISTS tally_inbox (
  id TEXT PRIMARY KEY,
  firm_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  payload_hash TEXT NOT NULL,
  source_ts TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  /** Filled when an agent run picks up the inbox row. */
  processed_at TIMESTAMPTZ,
  /** Optional pointer to the run that processed this row. */
  processed_by_run TEXT,
  UNIQUE(firm_id, payload_hash)
);

CREATE INDEX IF NOT EXISTS idx_tally_inbox_unprocessed
  ON tally_inbox(firm_id, received_at)
  WHERE processed_at IS NULL;

ALTER TABLE tally_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE tally_inbox FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tally_inbox_tenant_isolation ON tally_inbox;
CREATE POLICY tally_inbox_tenant_isolation ON tally_inbox
  FOR ALL
  USING (firm_id = public.current_company_id())
  WITH CHECK (firm_id = public.current_company_id());

COMMIT;
