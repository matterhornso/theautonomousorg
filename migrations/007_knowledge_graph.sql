-- Migration: 007_knowledge_graph
-- Purpose: structured entity tables + graph spine for the shared-brain
-- promise of v2 (and the foundation of the Memory product).
--
-- Today the four memory sources (per-agent memory, lessons, vault chunks,
-- activity feed) are surfaced by src/lib/memory.ts as a unified read. This
-- migration adds first-class entity rows + edges so the read can ALSO
-- include structured graph traversal (e.g. "everything we know about Acme
-- Inc" → person → conversations → commitments → decisions).
--
-- Strategy: additive. Existing memory sources stay the source of truth.
-- Once tenants opt into Memory ingestion (Deepgram + Claude entity
-- extraction pipeline), these tables populate and queryCompanyMemory()
-- expands its merge set.
--
-- Apply order: AFTER 001_rls_policies.sql (we depend on companies + current_company_id).

BEGIN;

-- ─── persons ───────────────────────────────────────────────────────────────
-- Internal or external contacts mentioned in meetings, emails, agent runs.

CREATE TABLE IF NOT EXISTS persons (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT,
  /** external = vendor, customer, prospect; internal = teammate. */
  is_external BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_persons_company
  ON persons(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_persons_email
  ON persons(company_id, email)
  WHERE email IS NOT NULL;

ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE persons FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS persons_tenant_isolation ON persons;
CREATE POLICY persons_tenant_isolation ON persons
  FOR ALL
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

-- ─── conversations ─────────────────────────────────────────────────────────
-- Any captured interaction: meeting, call, email thread, chat session,
-- agent run. Contains the transcript (when one exists) and an embedding
-- for semantic retrieval.

-- NOTE: named `memory_conversations` (not `conversations`) to avoid colliding
-- with the base agent-chat `conversations` table created by initSchema()
-- (src/lib/db-postgres.ts). Both are tenant data but unrelated shapes.
CREATE TABLE IF NOT EXISTS memory_conversations (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  /** meeting | call | email_thread | chat | agent_run | note */
  kind TEXT NOT NULL,
  title TEXT,
  occurred_at TIMESTAMPTZ,
  /** Provenance: deepgram | gmail | fireflies | zoom | agent | user */
  source TEXT,
  /** External id from the source system (Deepgram recording id, Gmail thread id, agent run id). */
  source_ref TEXT,
  transcript TEXT,
  /** Cohere embed-multilingual-v3.0; matches the vault_chunks pattern. */
  embedding vector(1024),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_conversations_company
  ON memory_conversations(company_id, occurred_at DESC NULLS LAST, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_conversations_source
  ON memory_conversations(company_id, source, source_ref);
-- HNSW index for semantic search. Matches vault_chunks index params.
CREATE INDEX IF NOT EXISTS idx_memory_conversations_embedding
  ON memory_conversations
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

ALTER TABLE memory_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_conversations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS memory_conversations_tenant_isolation ON memory_conversations;
CREATE POLICY memory_conversations_tenant_isolation ON memory_conversations
  FOR ALL
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

-- ─── decisions ─────────────────────────────────────────────────────────────
-- Durable choices the company has made. Surfaced in pre-meeting briefs
-- ("the CEO decided X about pricing on 2026-04-12").

CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  detail TEXT,
  decided_by TEXT,
  decided_at TIMESTAMPTZ,
  /** Optional grouping: pricing | hiring | product | gtm | finance | legal */
  category TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decisions_company
  ON decisions(company_id, decided_at DESC NULLS LAST, created_at DESC);

ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS decisions_tenant_isolation ON decisions;
CREATE POLICY decisions_tenant_isolation ON decisions
  FOR ALL
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

-- ─── commitments ───────────────────────────────────────────────────────────
-- Promises made by/to a person with a deadline. Drives pre-meeting briefs
-- and CEO orchestrator reminders.

CREATE TABLE IF NOT EXISTS commitments (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  /** Free-form description of what was promised. */
  description TEXT NOT NULL,
  /** Person id (committed_by) — the entity making the promise. */
  committed_by TEXT REFERENCES persons(id) ON DELETE SET NULL,
  /** Person id (committed_to) — the recipient. */
  committed_to TEXT REFERENCES persons(id) ON DELETE SET NULL,
  due_at TIMESTAMPTZ,
  /** open | resolved | overdue | cancelled */
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'overdue', 'cancelled')),
  resolved_at TIMESTAMPTZ,
  /** Provenance — conversation that surfaced this commitment. */
  source_conversation_id TEXT REFERENCES memory_conversations(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commitments_open
  ON commitments(company_id, status, due_at)
  WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_commitments_company
  ON commitments(company_id, created_at DESC);

ALTER TABLE commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE commitments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS commitments_tenant_isolation ON commitments;
CREATE POLICY commitments_tenant_isolation ON commitments
  FOR ALL
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

-- ─── events_log ────────────────────────────────────────────────────────────
-- Calendar events + scheduled triggers. Drives pre-meeting brief cron.

CREATE TABLE IF NOT EXISTS events_log (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  /** Provenance: google_cal | outlook | manual | brief_cron */
  source TEXT,
  source_ref TEXT,
  attendees JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Plain index (not a `WHERE starts_at > NOW()` partial — NOW() is STABLE, not
-- IMMUTABLE, which Postgres rejects in an index predicate). The planner still
-- uses this for the `starts_at >= NOW()` range scans in getUpcomingEvents.
CREATE INDEX IF NOT EXISTS idx_events_upcoming
  ON events_log(company_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_events_company
  ON events_log(company_id, starts_at DESC);

ALTER TABLE events_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE events_log FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS events_log_tenant_isolation ON events_log;
CREATE POLICY events_log_tenant_isolation ON events_log
  FOR ALL
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

-- ─── artifacts ─────────────────────────────────────────────────────────────
-- Outputs an agent produced and persisted: drafts, lists, briefs, plans.
-- Distinct from vault_documents (uploaded sources) — these are agent-authored.

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  /** Producing agent (role + id for cross-reference). */
  agent_id TEXT,
  agent_role TEXT,
  /** Which run produced this artifact (link back to agent_runs). */
  run_id TEXT,
  /** draft_email | prospect_list | brief | plan | report | contract */
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artifacts_company
  ON artifacts(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artifacts_agent
  ON artifacts(company_id, agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artifacts_run
  ON artifacts(run_id);

ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS artifacts_tenant_isolation ON artifacts;
CREATE POLICY artifacts_tenant_isolation ON artifacts
  FOR ALL
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

-- ─── knowledge_edges ───────────────────────────────────────────────────────
-- The graph spine. Any entity → any entity, with a typed relation +
-- arbitrary JSONB properties. Examples of relations:
--   person --attended--> conversation
--   person --committed--> commitment
--   conversation --produced--> artifact
--   conversation --resulted_in--> decision
--   agent_run --read--> vault_document
--
-- Edge storage is denormalized on purpose — we want one index lookup to
-- find "everything related to X" without joining six tables.

CREATE TABLE IF NOT EXISTS knowledge_edges (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  /** person | conversation | decision | commitment | event | artifact |
   *  vault_document | agent_run | lesson */
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  /** Free-form. Common values listed in this file's comment above. */
  relation TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_edges_outgoing
  ON knowledge_edges(company_id, source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_incoming
  ON knowledge_edges(company_id, target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_relation
  ON knowledge_edges(company_id, relation);

ALTER TABLE knowledge_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_edges FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS knowledge_edges_tenant_isolation ON knowledge_edges;
CREATE POLICY knowledge_edges_tenant_isolation ON knowledge_edges
  FOR ALL
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

COMMIT;
