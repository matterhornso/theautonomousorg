-- Migration: 008_agent_runs
-- Purpose: thin local index of agent runs so the /admin/agents/[role] and
-- /admin/agents/[role]/[runId] pages stop reading from mock fixtures.
--
-- Langfuse remains the canonical detailed trace store (full tool calls,
-- token-by-token, etc.). This table stores enough to render the admin UI
-- without round-tripping Langfuse: input, output, status, model, usage,
-- credits, trace_id pointer back to Langfuse.
--
-- Apply order: AFTER 001_rls_policies.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  /** Role of the agent that owned this run. Denormalized for the per-role list view. */
  agent_role TEXT NOT NULL,
  /** Concrete agent id from the agents table (may be null for ad-hoc runs). */
  agent_id TEXT,
  /** user | cron | event | mention | api */
  triggered_by TEXT NOT NULL,
  /** Free-form description of what kicked off this run. */
  trigger_detail TEXT,
  /** Original input to the run (request payload, user message). */
  input JSONB NOT NULL,
  /** Final output. Null while running / awaiting_approval / failed. */
  output JSONB,
  /** queued | running | completed | failed | awaiting_approval */
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'awaiting_approval')),
  /** Concrete model used; surfaces BYOM vs platform default in run trace. */
  model_used TEXT,
  /** anthropic | openai | openai_compat */
  provider TEXT,
  tokens_in INTEGER,
  tokens_out INTEGER,
  credits_used INTEGER,
  /** Pointer back to Langfuse for the full trace. */
  langfuse_trace_id TEXT,
  /** Human-friendly summary written by the agent's afterRun hook. */
  summary TEXT,
  error_detail TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_by_role
  ON agent_runs(company_id, agent_role, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_recent
  ON agent_runs(company_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_open
  ON agent_runs(company_id, status)
  WHERE status IN ('queued', 'running', 'awaiting_approval');

ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agent_runs_tenant_isolation ON agent_runs;
CREATE POLICY agent_runs_tenant_isolation ON agent_runs
  FOR ALL
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

COMMIT;
