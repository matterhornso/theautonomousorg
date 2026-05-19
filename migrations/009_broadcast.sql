-- Migration: 009_broadcast
-- Purpose: Tables backing the JAA broadcast agent — a Telegram-driven way for
-- firm admins to fan messages out to a CSV-imported contact list over email +
-- Telegram, plus trigger timesheet reminders by chat.
--
-- Three tables:
--   contacts          — firm-wide contact list (CSV-imported: name, email, phone)
--   broadcast_admins  — which Telegram chats may issue broadcast commands
--   broadcasts        — audit log, one row per executed admin command
--
-- Tenant scoping via RLS, matching the employees/timesheet_submissions pattern
-- in 005. Apply order: AFTER 001_rls_policies.sql.

BEGIN;

-- ─── contacts ────────────────────────────────────────────────────────────
-- A contact is "email-addressable" when email is non-null, and
-- "telegram-addressable" once telegram_chat_id is set (the contact runs
-- /link <email> in the bot, same as timesheet employees). Phone is stored
-- for a future WhatsApp channel but unused in v1.

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  /** Nullable: a contact may be phone-only. */
  email TEXT,
  /** Nullable. Stored for the future WhatsApp channel; unused in v1. */
  phone TEXT,
  /** Populated when the contact runs /link <email> in the bot. */
  telegram_chat_id BIGINT,
  /** Soft deactivate — keeps history, stops future sends. */
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  /** Email is the CSV upsert key. Postgres allows multiple NULLs, so
      phone-only contacts never collide. */
  UNIQUE(company_id, email)
);

CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_telegram_chat
  ON contacts(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contacts_tenant_isolation ON contacts;
CREATE POLICY contacts_tenant_isolation ON contacts
  FOR ALL
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

-- ─── broadcast_admins ────────────────────────────────────────────────────
-- A Telegram chat allowed to issue broadcast commands for a firm. Enrolled
-- via `/register <code>` in the bot (code checked against BROADCAST_ADMIN_CODE).

CREATE TABLE IF NOT EXISTS broadcast_admins (
  telegram_chat_id BIGINT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_admins_company ON broadcast_admins(company_id);

ALTER TABLE broadcast_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_admins FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS broadcast_admins_tenant_isolation ON broadcast_admins;
CREATE POLICY broadcast_admins_tenant_isolation ON broadcast_admins
  FOR ALL
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

-- ─── broadcasts ──────────────────────────────────────────────────────────
-- Audit log: one row per executed admin command. `action` is the agent's
-- classified intent ('broadcast' | 'send_reminders' | 'unknown').

CREATE TABLE IF NOT EXISTS broadcasts (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  admin_chat_id BIGINT,
  /** Raw text the admin sent. */
  instruction TEXT NOT NULL,
  /** Agent-classified action. */
  action TEXT NOT NULL,
  /** Resolved outbound message, when action='broadcast'. */
  message TEXT,
  email_sent INT NOT NULL DEFAULT 0,
  telegram_sent INT NOT NULL DEFAULT 0,
  failed INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_company_created
  ON broadcasts(company_id, created_at DESC);

ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcasts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS broadcasts_tenant_isolation ON broadcasts;
CREATE POLICY broadcasts_tenant_isolation ON broadcasts
  FOR ALL
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

COMMIT;
