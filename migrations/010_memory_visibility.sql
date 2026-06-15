-- Migration: 010_memory_visibility
-- Purpose: Add a visibility lane to the human-sourced knowledge-graph tables so
--   the company brain is "company-shared by default, private opt-in".
-- Rationale (UNIFICATION.md, Phase 1):
--   The brain is shared across every agent and member by default. A member can
--   opt a specific item (e.g. a sensitive 1:1) into a private lane visible only
--   to its owner. Agents act as the company (no user identity) and therefore
--   only ever see `visibility = 'company'` rows.
--
-- Enforcement note:
--   The running app connects as the Postgres superuser (Supabase pooler user
--   `postgres.<project>`), which BYPASSES RLS — so the *primary* enforcement of
--   this rule is the app-layer filter in src/lib/knowledge-graph.ts read
--   functions (`visibility = 'company' OR owner_user_id = $viewer`). The RLS
--   policies below are defense-in-depth that keep the same guarantee if a
--   non-superuser/`authenticated` role is ever used.
--
-- Applies to the human-sourced entity tables only. `persons` stay
--   company-shared (a contact is a shared entity; the sensitive content lives in
--   the conversation/decision/commitment, which carry the flag).
--
-- Forward-only, idempotent. Apply order is after 007 (knowledge graph) + 008.
-- Apply with: psql "$DATABASE_URL" -f migrations/010_memory_visibility.sql

BEGIN;

-- ─── memory_conversations ────────────────────────────────────────────────────
ALTER TABLE memory_conversations
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'company'
    CHECK (visibility IN ('company', 'private'));
ALTER TABLE memory_conversations
  ADD COLUMN IF NOT EXISTS owner_user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_memory_conversations_visibility
  ON memory_conversations(company_id, visibility, owner_user_id);

DROP POLICY IF EXISTS memory_conversations_tenant_isolation ON memory_conversations;
CREATE POLICY memory_conversations_tenant_isolation ON memory_conversations
  FOR ALL
  USING (
    company_id = public.current_company_id()
    AND (visibility = 'company' OR owner_user_id = public.current_user_id())
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND (visibility = 'company' OR owner_user_id = public.current_user_id())
  );

-- ─── decisions ───────────────────────────────────────────────────────────────
ALTER TABLE decisions
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'company'
    CHECK (visibility IN ('company', 'private'));
ALTER TABLE decisions
  ADD COLUMN IF NOT EXISTS owner_user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_decisions_visibility
  ON decisions(company_id, visibility, owner_user_id);

DROP POLICY IF EXISTS decisions_tenant_isolation ON decisions;
CREATE POLICY decisions_tenant_isolation ON decisions
  FOR ALL
  USING (
    company_id = public.current_company_id()
    AND (visibility = 'company' OR owner_user_id = public.current_user_id())
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND (visibility = 'company' OR owner_user_id = public.current_user_id())
  );

-- ─── commitments ─────────────────────────────────────────────────────────────
ALTER TABLE commitments
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'company'
    CHECK (visibility IN ('company', 'private'));
ALTER TABLE commitments
  ADD COLUMN IF NOT EXISTS owner_user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_commitments_visibility
  ON commitments(company_id, visibility, owner_user_id);

DROP POLICY IF EXISTS commitments_tenant_isolation ON commitments;
CREATE POLICY commitments_tenant_isolation ON commitments
  FOR ALL
  USING (
    company_id = public.current_company_id()
    AND (visibility = 'company' OR owner_user_id = public.current_user_id())
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND (visibility = 'company' OR owner_user_id = public.current_user_id())
  );

-- ─── events_log ──────────────────────────────────────────────────────────────
ALTER TABLE events_log
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'company'
    CHECK (visibility IN ('company', 'private'));
ALTER TABLE events_log
  ADD COLUMN IF NOT EXISTS owner_user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_events_log_visibility
  ON events_log(company_id, visibility, owner_user_id);

DROP POLICY IF EXISTS events_log_tenant_isolation ON events_log;
CREATE POLICY events_log_tenant_isolation ON events_log
  FOR ALL
  USING (
    company_id = public.current_company_id()
    AND (visibility = 'company' OR owner_user_id = public.current_user_id())
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND (visibility = 'company' OR owner_user_id = public.current_user_id())
  );

-- ─── artifacts ───────────────────────────────────────────────────────────────
-- Agent-authored by default (company-shared). The column still lets a user lock
-- a specific artifact down to themselves.
ALTER TABLE artifacts
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'company'
    CHECK (visibility IN ('company', 'private'));
ALTER TABLE artifacts
  ADD COLUMN IF NOT EXISTS owner_user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_artifacts_visibility
  ON artifacts(company_id, visibility, owner_user_id);

DROP POLICY IF EXISTS artifacts_tenant_isolation ON artifacts;
CREATE POLICY artifacts_tenant_isolation ON artifacts
  FOR ALL
  USING (
    company_id = public.current_company_id()
    AND (visibility = 'company' OR owner_user_id = public.current_user_id())
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND (visibility = 'company' OR owner_user_id = public.current_user_id())
  );

COMMIT;
