-- Migration: 005_timesheets
-- Purpose: Tables backing the Telegram timesheet reminder vertical (Client 1).
--
-- Two tables only:
--   employees             — one row per person we ping
--   timesheet_submissions — one row per (employee, period_key) tracking whether
--                           they've submitted yet, and when reminders were sent
--
-- "Period" is encoded as an opaque text key (e.g. "2026-W19" for ISO week).
-- The cron job computes the current week's key and inserts submission rows
-- for every active employee on first run of that week. No separate periods
-- table; period_key is the tenant of truth.
--
-- Tenant scoping via RLS, matching the lessons + admin_notifications pattern
-- in 003. Apply order: AFTER 001_rls_policies.sql.

BEGIN;

-- ─── employees ───────────────────────────────────────────────────────────
-- Bot links chat IDs lazily: admin creates the row with name + email; the
-- employee runs `/link <email>` in Telegram to bind their Telegram chat_id.
-- An employee is "addressable" once telegram_chat_id is non-null AND active.

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  /** Optional Telegram @handle (cosmetic; matching uses chat_id). */
  telegram_handle TEXT,
  /** Populated when the employee runs /link <email> in the bot. BIGINT because Telegram chat IDs can exceed 32 bits. */
  telegram_chat_id BIGINT,
  /** IANA timezone, used by the cron when deciding "is today the right day to remind". */
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  /** Soft deactivate. Keeps history; stops new reminders. */
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, email)
);

CREATE INDEX IF NOT EXISTS idx_employees_company ON employees(company_id);
CREATE INDEX IF NOT EXISTS idx_employees_telegram_chat ON employees(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employees_tenant_isolation ON employees;
CREATE POLICY employees_tenant_isolation ON employees
  FOR ALL
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

-- ─── timesheet_submissions ──────────────────────────────────────────────
-- One row per (employee, period_key). Created upfront when a period starts
-- (so /admin/timesheets can list outstanding from t=0). Updated when the
-- employee replies "DONE" via Telegram, when an admin marks them manually,
-- or by an inbound webhook from their timesheet tool (later).

CREATE TABLE IF NOT EXISTS timesheet_submissions (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  /** Opaque period identifier. v1: ISO week e.g. "2026-W19". v2 may extend to "2026-05" for monthly. */
  period_key TEXT NOT NULL,
  /** Null = not yet submitted. */
  submitted_at TIMESTAMPTZ,
  /** Where the submission signal came from: 'telegram' | 'manual' | 'webhook'. */
  source TEXT,
  notes TEXT,
  reminders_sent INT NOT NULL DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employee_id, period_key)
);

CREATE INDEX IF NOT EXISTS idx_timesheet_submissions_company_period
  ON timesheet_submissions(company_id, period_key);
CREATE INDEX IF NOT EXISTS idx_timesheet_submissions_outstanding
  ON timesheet_submissions(company_id, period_key)
  WHERE submitted_at IS NULL;

ALTER TABLE timesheet_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_submissions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS timesheet_submissions_tenant_isolation ON timesheet_submissions;
CREATE POLICY timesheet_submissions_tenant_isolation ON timesheet_submissions
  FOR ALL
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

COMMIT;
