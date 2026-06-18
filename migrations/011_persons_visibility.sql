-- Migration: 011_persons_visibility
-- Purpose: Extend the visibility lane (migration 010) to the `persons` table so a
--   private capture is *fully* private — the people it mentions are no longer
--   surfaced as company-shared contacts.
--
-- Background:
--   Migration 010 gave conversations/decisions/commitments/events_log/artifacts a
--   "company" vs "private" lane, but `persons` was deliberately left shared on the
--   theory that "a contact is a shared entity." In practice that leaked the
--   *identity* (name/email/role) of people mentioned only in a private 1:1 to the
--   whole company. This closes that gap: a person extracted from a private
--   conversation inherits the private lane and its owner.
--
--   `persons` are never deduped across conversations in app code (each ingest
--   inserts fresh rows), so there is no cross-conversation promotion to reason
--   about — a person row simply inherits the visibility of the conversation it
--   came from. A genuinely shared contact who also appears in a company
--   conversation still gets a company-lane row from that conversation.
--
-- Enforcement note (same as 010):
--   The running app connects as the Postgres superuser, which BYPASSES RLS, so the
--   primary enforcement is the app-layer filter in src/lib/knowledge-graph.ts. The
--   RLS policy below is defense-in-depth.
--
-- Forward-only, idempotent. Apply after 007 (knowledge graph) and 010.
-- Apply with: psql "$DATABASE_URL" -f migrations/011_persons_visibility.sql

BEGIN;

ALTER TABLE persons
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'company'
    CHECK (visibility IN ('company', 'private'));
ALTER TABLE persons
  ADD COLUMN IF NOT EXISTS owner_user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_persons_visibility
  ON persons(company_id, visibility, owner_user_id);

DROP POLICY IF EXISTS persons_tenant_isolation ON persons;
CREATE POLICY persons_tenant_isolation ON persons
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
