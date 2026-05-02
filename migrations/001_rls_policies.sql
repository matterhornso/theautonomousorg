-- Migration: 001_rls_policies
-- Purpose: Enable Postgres Row-Level Security (RLS) on all tenant-scoped tables.
-- Rationale: Defense-in-depth on top of app-layer `WHERE company_id = $1` filters.
--   A single missing WHERE clause becomes a no-op instead of a cross-tenant data leak.
-- Source design: ~/.gstack/projects/matterhornso-theautonomousorg/abhinavramesh-main-design-20260501-162924.md
-- Eng review locked decisions:
--   - Step 0 scope: multi-tenant work is a hardening pass, not a rebuild
--   - Section 1 1D-A: per-firm AWS KMS CMK (separate concern; not in this migration)
--
-- IMPORTANT — Apply order:
--   This migration MUST NOT be applied until every server-side query path
--   sets the session GUCs `app.current_company_id` and `app.current_user_id`
--   via `src/lib/tenant-context.ts` (introduced in this PR).
--   Applying RLS before the GUCs are wired everywhere = production outage.
--
-- Apply with: `npx tsx scripts/apply-rls-migration.ts`
-- Rollback: `migrations/001_rls_policies_rollback.sql` (forward-only is preferred;
--   rollback is documented for emergency only).

BEGIN;

-- ============================================================================
-- PART 1 — Helper functions read session GUCs.
-- ============================================================================
-- These are SECURITY INVOKER (default), STABLE so the planner can cache them
-- within a query. `missing_ok = true` returns NULL if the GUC isn't set;
-- policies treat NULL as "no tenant context" and reject the row.

CREATE OR REPLACE FUNCTION public.current_company_id() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.current_company_id', true), '')::TEXT;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION public.current_user_id() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::TEXT;
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION public.current_company_id() IS
  'Returns the company_id from the session GUC `app.current_company_id`, or NULL if not set. Policies reject NULL.';
COMMENT ON FUNCTION public.current_user_id() IS
  'Returns the Clerk user_id from the session GUC `app.current_user_id`, or NULL if not set.';

-- ============================================================================
-- PART 2 — companies table.
-- ============================================================================
-- A user can see companies they own (user_id) OR companies tied to their
-- current tenant context (id = current_company_id()). The OR shape supports
-- both onboarding (creating first company before context is set) and runtime.

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS companies_tenant_isolation ON companies;
CREATE POLICY companies_tenant_isolation ON companies
  FOR ALL
  USING (
    id = public.current_company_id()
    OR user_id = public.current_user_id()
  )
  WITH CHECK (
    id = public.current_company_id()
    OR user_id = public.current_user_id()
  );

-- ============================================================================
-- PART 3 — Direct tenant-scoped tables (have `company_id` column with FK).
-- ============================================================================
-- Pattern: enable + force RLS, then a single FOR ALL policy bound to
-- `current_company_id()`. WITH CHECK enforces that INSERT/UPDATE rows
-- belong to the active tenant.

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'agents',
    'team_members',
    'debriefs',
    'subscriptions',
    'usage_records',
    'api_keys',
    'user_api_keys',
    'webhooks',
    'chai_time_sessions',
    'chai_time_config',
    'workflows',
    'workflow_runs',
    'eval_runs'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_isolation ON %I', t, t);
    EXECUTE format($f$
      CREATE POLICY %I_tenant_isolation ON %I
        FOR ALL
        USING (company_id = public.current_company_id())
        WITH CHECK (company_id = public.current_company_id())
    $f$, t, t);
  END LOOP;
END $$;

-- ============================================================================
-- PART 4 — `messaging_users` (nullable company_id).
-- ============================================================================
-- Some messaging users (e.g. unauthenticated inbound webhook senders) may
-- not yet be associated with a firm. Allow rows where company_id IS NULL
-- to be visible to any session, but writes must include the active tenant.

ALTER TABLE messaging_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE messaging_users FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS messaging_users_tenant_isolation ON messaging_users;
CREATE POLICY messaging_users_tenant_isolation ON messaging_users
  FOR ALL
  USING (
    company_id IS NULL
    OR company_id = public.current_company_id()
  )
  WITH CHECK (
    company_id = public.current_company_id()
  );

-- ============================================================================
-- PART 5 — `file_uploads` (nullable company_id, no FK declared).
-- ============================================================================
-- Same shape as messaging_users: legacy rows may have NULL company_id;
-- new writes require the active tenant.

ALTER TABLE file_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_uploads FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS file_uploads_tenant_isolation ON file_uploads;
CREATE POLICY file_uploads_tenant_isolation ON file_uploads
  FOR ALL
  USING (
    company_id IS NULL
    OR company_id = public.current_company_id()
    OR (company_id IS NULL AND user_id = public.current_user_id())
  )
  WITH CHECK (
    company_id = public.current_company_id()
    OR (company_id IS NULL AND user_id = public.current_user_id())
  );

-- ============================================================================
-- PART 6 — Transitively scoped tables (via agent_id → agents.company_id).
-- ============================================================================
-- Subquery: agent_id IN (SELECT id FROM agents WHERE company_id = current_company_id()).
-- The agents table itself is RLS-protected (Part 3), so this subquery is also RLS-filtered.
-- Result: only agents in the active tenant are visible; rows joining to those agents are visible.

DO $$
DECLARE
  t TEXT;
  agent_tables TEXT[] := ARRAY[
    'agent_custom_skills',
    'agent_actions',
    'conversations',
    'memory',
    'tasks',
    'agent_assignments',
    'agent_evals'
  ];
BEGIN
  FOREACH t IN ARRAY agent_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_isolation ON %I', t, t);
    EXECUTE format($f$
      CREATE POLICY %I_tenant_isolation ON %I
        FOR ALL
        USING (
          agent_id IN (
            SELECT id FROM agents WHERE company_id = public.current_company_id()
          )
        )
        WITH CHECK (
          agent_id IN (
            SELECT id FROM agents WHERE company_id = public.current_company_id()
          )
        )
    $f$, t, t);
  END LOOP;
END $$;

-- ============================================================================
-- PART 7 — `messages` (transitively scoped via conversation_id → conversations.agent_id).
-- ============================================================================
-- Two-hop: messages → conversations → agents. Same pattern, deeper subquery.

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS messages_tenant_isolation ON messages;
CREATE POLICY messages_tenant_isolation ON messages
  FOR ALL
  USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE agent_id IN (
        SELECT id FROM agents WHERE company_id = public.current_company_id()
      )
    )
  )
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE agent_id IN (
        SELECT id FROM agents WHERE company_id = public.current_company_id()
      )
    )
  );

-- ============================================================================
-- PART 8 — `inter_agent_messages` (both source and target must be tenant agents).
-- ============================================================================
-- Cross-firm agent communication is forbidden by design. Both source_agent_id
-- and target_agent_id must belong to the active tenant.

ALTER TABLE inter_agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE inter_agent_messages FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inter_agent_messages_tenant_isolation ON inter_agent_messages;
CREATE POLICY inter_agent_messages_tenant_isolation ON inter_agent_messages
  FOR ALL
  USING (
    source_agent_id IN (
      SELECT id FROM agents WHERE company_id = public.current_company_id()
    )
    AND target_agent_id IN (
      SELECT id FROM agents WHERE company_id = public.current_company_id()
    )
  )
  WITH CHECK (
    source_agent_id IN (
      SELECT id FROM agents WHERE company_id = public.current_company_id()
    )
    AND target_agent_id IN (
      SELECT id FROM agents WHERE company_id = public.current_company_id()
    )
  );

-- ============================================================================
-- PART 9 — User-scoped tables (Clerk user_id, NOT firm-scoped).
-- ============================================================================
-- user_profiles, credits, credit_transactions belong to a Clerk user, not a firm.
-- Bind policies to current_user_id() instead of current_company_id().

DO $$
DECLARE
  t TEXT;
  user_tables TEXT[] := ARRAY[
    'user_profiles',
    'credits',
    'credit_transactions'
  ];
BEGIN
  FOREACH t IN ARRAY user_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_user_isolation ON %I', t, t);
    EXECUTE format($f$
      CREATE POLICY %I_user_isolation ON %I
        FOR ALL
        USING (user_id = public.current_user_id())
        WITH CHECK (user_id = public.current_user_id())
    $f$, t, t);
  END LOOP;
END $$;

-- ============================================================================
-- PART 10 — Global table: eval_test_suites.
-- ============================================================================
-- Platform-wide test suites. Read-only for all authenticated sessions.
-- Writes are restricted: only sessions with NULL current_company_id (i.e.
-- migration scripts running outside a tenant context) can write. App code
-- with a tenant context cannot mutate global tables.

ALTER TABLE eval_test_suites ENABLE ROW LEVEL SECURITY;
ALTER TABLE eval_test_suites FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS eval_test_suites_read_all ON eval_test_suites;
CREATE POLICY eval_test_suites_read_all ON eval_test_suites
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS eval_test_suites_write_admin ON eval_test_suites;
CREATE POLICY eval_test_suites_write_admin ON eval_test_suites
  FOR INSERT
  WITH CHECK (public.current_company_id() IS NULL AND public.current_user_id() IS NULL);

-- (UPDATE/DELETE on eval_test_suites are not policy-allowed at all; they
--  require running the SQL with a Postgres role that has BYPASSRLS, e.g.
--  the migrations role outside the app connection pool.)

-- ============================================================================
-- PART 11 — Confirm everything is locked down.
-- ============================================================================
-- This block fails the migration if any tenant table is missing RLS.
-- A failed migration rolls back; the database is left in pre-migration state.

DO $$
DECLARE
  t TEXT;
  expected_rls_tables TEXT[] := ARRAY[
    'companies', 'agents', 'team_members', 'debriefs', 'subscriptions',
    'usage_records', 'api_keys', 'user_api_keys', 'webhooks',
    'chai_time_sessions', 'chai_time_config', 'workflows', 'workflow_runs',
    'eval_runs', 'messaging_users', 'file_uploads',
    'agent_custom_skills', 'agent_actions', 'conversations', 'memory',
    'tasks', 'agent_assignments', 'agent_evals',
    'messages', 'inter_agent_messages',
    'user_profiles', 'credits', 'credit_transactions',
    'eval_test_suites'
  ];
  rls_enabled BOOLEAN;
BEGIN
  FOREACH t IN ARRAY expected_rls_tables LOOP
    SELECT relrowsecurity INTO rls_enabled
    FROM pg_class WHERE relname = t AND relnamespace = 'public'::regnamespace;
    IF rls_enabled IS NULL THEN
      RAISE EXCEPTION 'Table % does not exist; cannot verify RLS', t;
    END IF;
    IF NOT rls_enabled THEN
      RAISE EXCEPTION 'Table % does not have RLS enabled', t;
    END IF;
  END LOOP;
END $$;

COMMIT;

-- ============================================================================
-- Post-migration sanity check.
-- ============================================================================
-- After applying, run:
--
--   SET app.current_company_id = 'firm_a';
--   SELECT count(*) FROM agents;  -- returns only firm_a's agents
--
--   SET app.current_company_id = 'firm_b';
--   SELECT count(*) FROM agents;  -- returns only firm_b's agents (different number)
--
--   RESET app.current_company_id;
--   SELECT count(*) FROM agents;  -- returns 0 (no tenant context = no rows)
--
-- If any of these return wrong counts, RLS is misconfigured.
