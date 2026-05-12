-- Migration: 003_lessons
-- Purpose: Cross-run learning loop for the AgentRunner. Each agent run
-- writes a structured lesson; subsequent runs read recent lessons before
-- executing so corrections compound over time.
--
-- Eng review locked decision (Section 2): the lessons table is a thin
-- table backing the LessonsHelper interface in src/lib/agent-sdk-helpers.ts.
-- Per-firm + per-agent partition; tenant-scoped via RLS.
--
-- Apply order: AFTER 001_rls_policies.sql.

BEGIN;

-- ─── lessons ───────────────────────────────────────────────────────────────
-- One row per agent-run reflection. The agent's afterRun hook writes here;
-- beforeRun reads the most recent N for the same (company_id, agent_id).

CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  task_description TEXT NOT NULL,
  /** approved | rejected | modified | unknown — feedback signal from a human reviewer or downstream system. */
  output_accepted TEXT NOT NULL CHECK (output_accepted IN ('approved', 'rejected', 'modified', 'unknown')),
  /** What the human changed about the agent's output, if anything. */
  modification_detail TEXT,
  /** Agent's own self-critique written at afterRun time. */
  self_critique TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite index for the readRecent query: (company_id, agent_id, created_at DESC).
CREATE INDEX IF NOT EXISTS idx_lessons_recent
  ON lessons(company_id, agent_id, created_at DESC);

-- ─── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lessons_tenant_isolation ON lessons;
CREATE POLICY lessons_tenant_isolation ON lessons
  FOR ALL
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

-- ─── admin_notifications ───────────────────────────────────────────────────
-- Persistent notifications surfaced in the admin portal. Composed by the
-- EscalationHelper alongside an outbound WhatsApp template. SPOC + partner
-- can mark them resolved; cron archival lives in src/lib/task-processor.ts.

CREATE TABLE IF NOT EXISTS admin_notifications (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  /** Originating agent run, for cross-reference with Langfuse trace + lessons. */
  agent_id TEXT,
  run_id TEXT,
  /** Severity drives the notification sound + colour + paging behaviour. */
  severity TEXT NOT NULL CHECK (severity IN ('P1', 'P2', 'P3', 'INFO')),
  /** Free-form: 'spoc_alert' | 'human_escalation' | 'handoff' | other. */
  kind TEXT NOT NULL,
  subject TEXT NOT NULL,
  detail TEXT NOT NULL,
  /** Optional role hint for routing (e.g. 'partner', 'audit_lead'). */
  role_hint TEXT,
  /** Filled when a human reviewer acks/closes the notification. */
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_recent
  ON admin_notifications(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_open
  ON admin_notifications(company_id, acknowledged_at)
  WHERE acknowledged_at IS NULL;

ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notifications FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_notifications_tenant_isolation ON admin_notifications;
CREATE POLICY admin_notifications_tenant_isolation ON admin_notifications
  FOR ALL
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

-- ─── approval_callbacks ────────────────────────────────────────────────────
-- Records every click on an approval-card button. Idempotency: UNIQUE(card_id,
-- action) means a duplicate click on Approve is a no-op the second time.
-- The agent's afterRun (or a separate poller) reads this table to know
-- whether a card was approved/rejected.

CREATE TABLE IF NOT EXISTS approval_callbacks (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,
  firm_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('approve', 'reject', 'escalate')),
  payload JSONB,
  expiry TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(card_id, action)
);

CREATE INDEX IF NOT EXISTS idx_approval_callbacks_card
  ON approval_callbacks(card_id);
CREATE INDEX IF NOT EXISTS idx_approval_callbacks_run
  ON approval_callbacks(run_id);

ALTER TABLE approval_callbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_callbacks FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS approval_callbacks_tenant_isolation ON approval_callbacks;
CREATE POLICY approval_callbacks_tenant_isolation ON approval_callbacks
  FOR ALL
  USING (firm_id = public.current_company_id())
  WITH CHECK (firm_id = public.current_company_id());

COMMIT;
