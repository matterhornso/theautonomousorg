-- 011_least_privilege_role.sql
-- Purpose: make RLS actually ENFORCE tenant isolation.
--
-- The application currently connects as the `postgres` role, which has
-- BYPASSRLS = true. That means every Row-Level-Security policy on every table
-- (migrations 001+) is silently ignored for the app's own connection, so
-- tenant isolation rests entirely on hand-written `WHERE company_id = ...`
-- clauses in application code. This migration creates a least-privilege role
-- the app can connect as instead, so RLS becomes a real second layer.
--
-- SAFE TO APPLY: this only creates a role and grants — it does NOT change the
-- app's connection or behaviour. Applying it has zero runtime effect until you
-- switch DATABASE_URL.
--
-- ⚠️  DO NOT switch DATABASE_URL to app_user until the per-request tenant GUC
--     (app.current_company_id) is set on EVERY query path. Today only
--     tenant-context.ts (runWithTenantStore) sets it, and it has no callers in
--     the API routes — so a NOBYPASSRLS role would currently see ZERO rows.
--     Cutover checklist is at the bottom of this file.

-- 1) Connection role WITHOUT superuser / bypassrls.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

-- 2) Privileges. RLS policies still apply ON TOP of these grants.
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;

-- Future objects created later inherit the same grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO app_user;

-- 3) app_user does NOT need any special grant to run
--    SELECT set_config('app.current_company_id', ..., true) — SET is allowed
--    for any role. RLS reads that GUC via public.current_company_id().

-- ─────────────────────────────────────────────────────────────────────────────
-- CUTOVER CHECKLIST (do in order, only after GUC wiring is complete):
--   1. Ensure every DB read/write runs inside runWithTenantStore() (or an
--      equivalent that calls set_config('app.current_company_id', ...) AND
--      set_config('app.current_user_id', ...) at the start of the transaction).
--      Webhook/cron paths must set it explicitly from the resolved tenant.
--   2. Set a strong password:  ALTER ROLE app_user PASSWORD '<openssl rand -base64 32>';
--   3. Point the app at it (transaction pooler, port 6543):
--        DATABASE_URL=postgresql://app_user:<pw>@<ref>.pooler.supabase.com:6543/postgres
--      Keep a separate admin/owner URL (postgres role) ONLY for running migrations.
--   4. Verify isolation: with a forged GUC, a SELECT must return 0 rows:
--        SET app.current_company_id = '00000000-0000-0000-0000-000000000000';
--        SELECT count(*) FROM companies;  -- expect 0 under app_user
-- ─────────────────────────────────────────────────────────────────────────────
