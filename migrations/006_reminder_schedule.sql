-- Migration: 006_reminder_schedule
-- Purpose: Per-firm cadence for the timesheet reminder bot. The cron endpoint
-- reads this row to decide whether the current invocation should fire.
-- Apply order: AFTER 005_timesheets.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS reminder_schedules (
  company_id TEXT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  /** Cron expression — minute hour day-of-month month day-of-week. e.g. "0 17 * * *" = daily 17:00. */
  cron TEXT NOT NULL DEFAULT '0 17 * * *',
  /** IANA timezone for cron interpretation. */
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  /** Soft pause without losing the cadence config. */
  paused BOOLEAN NOT NULL DEFAULT FALSE,
  /** Most recent successful pass — written by the cron handler. */
  last_run_at TIMESTAMPTZ,
  /** Computed/cached next-fire timestamp; UI shows this. */
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE reminder_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_schedules FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reminder_schedules_tenant_isolation ON reminder_schedules;
CREATE POLICY reminder_schedules_tenant_isolation ON reminder_schedules
  FOR ALL
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

COMMIT;
