-- Migration: 010_integrations
-- Purpose: Per-tenant integration credentials, encrypted at rest. Replaces the
-- v1 single-tenant globals (TELEGRAM_BOT_TOKEN, SHOPIFY_CLIENT_ID/SECRET, …)
-- with one row per (company, provider, account) so a 2nd/3rd customer can bring
-- their own bot / store / keys.
--
-- Design notes: docs/integrations-design.md
--
-- Encryption: the `credentials_*` columns hold AES-256-GCM ciphertext produced
-- by the app layer (src/lib/integrations.ts). The DB never sees plaintext.
-- `key_alias` records which key encrypted the row so we can rotate ENCRYPTION_KEY
-- (or move to per-firm KMS via companies.kms_key_alias) without a flag day.
--
-- Webhook routing: inbound webhooks (Telegram, Shopify) arrive with NO tenant
-- context. `public.resolve_integration_company(provider, external_id)` is a
-- SECURITY DEFINER lookup that maps a provider-side id (bot username, shop
-- domain) to its company_id, bypassing RLS, WITHOUT exposing the ciphertext.
-- The entrypoint then sets app.current_company_id and reads the row under RLS.
--
-- Apply order: AFTER 001_rls_policies.sql (needs public.current_company_id()).

BEGIN;

-- ─── integrations ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  /** Which third party: 'telegram' | 'shopify' | 'whatsapp' | 'anthropic' | 'resend' | 'custom'. */
  provider TEXT NOT NULL CHECK (provider IN (
    'telegram', 'shopify', 'whatsapp', 'anthropic', 'resend', 'custom'
  )),
  /** Human label shown in the admin UI, e.g. "@acme_timesheet_bot" or "acme.myshopify.com". */
  label TEXT,
  /**
   * Provider-side identifier used for webhook routing WITHOUT decrypting:
   * Telegram bot username, Shopify shop domain, WhatsApp phone-number id, etc.
   * Globally unique per provider so an inbound webhook resolves to one tenant.
   */
  external_id TEXT,
  /** AES-256-GCM ciphertext (base64) of the credential JSON blob. */
  credentials_ciphertext TEXT NOT NULL,
  /** Base64 IV/nonce used for this row. */
  credentials_iv TEXT NOT NULL,
  /** Base64 GCM auth tag (stored separately from ciphertext). */
  credentials_auth_tag TEXT NOT NULL,
  /**
   * Which key encrypted this row, for rotation. e.g. 'app:v1' for the global
   * ENCRYPTION_KEY, or a per-firm KMS alias (see companies.kms_key_alias).
   */
  key_alias TEXT NOT NULL DEFAULT 'app:v1',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disabled', 'error')),
  /** Last time we successfully exercised the credential (e.g. getMe / token mint). */
  last_verified_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A firm can hold several accounts of one provider (e.g. two Shopify stores),
  -- distinguished by external_id.
  UNIQUE (company_id, provider, external_id)
);

CREATE INDEX IF NOT EXISTS idx_integrations_company_provider
  ON integrations(company_id, provider);

-- Webhook routing: (provider, external_id) → exactly one integration, globally.
-- Partial so rows without an external_id (e.g. outbound-only API keys) don't
-- collide.
CREATE UNIQUE INDEX IF NOT EXISTS uq_integrations_provider_external
  ON integrations(provider, external_id)
  WHERE external_id IS NOT NULL;

-- ─── updated_at trigger ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_integrations_updated_at ON integrations;
CREATE TRIGGER trg_integrations_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS ───────────────────────────────────────────────────────────────────
-- Same tenant-isolation pattern as 003/005: scoped by the session GUC.

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS integrations_tenant_isolation ON integrations;
CREATE POLICY integrations_tenant_isolation ON integrations
  FOR ALL
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

-- ─── webhook routing helper ────────────────────────────────────────────────
-- SECURITY DEFINER so an unauthenticated webhook can resolve which tenant an
-- inbound event belongs to. Returns ONLY the company_id (never the ciphertext),
-- so it can't be used to exfiltrate credentials. The caller then sets
-- app.current_company_id and reads the full row under normal RLS.

CREATE OR REPLACE FUNCTION public.resolve_integration_company(
  p_provider TEXT,
  p_external_id TEXT
)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id
  FROM integrations
  WHERE provider = p_provider
    AND external_id = p_external_id
    AND status = 'active'
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.resolve_integration_company(TEXT, TEXT) IS
  'Maps a provider-side id (bot username, shop domain) to its company_id, bypassing RLS for unauthenticated webhook routing. Returns no credential material.';

COMMIT;
