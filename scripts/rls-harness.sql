-- Minimal RLS harness for scripts/verify-rls-isolation.ts.
-- Mirrors the real isolation pattern (migrations/001 policies + the
-- current_company_id()/current_user_id() helpers) and the least-privilege
-- app_user role (migrations/011) on a throwaway local Postgres, so the app's
-- real `sql` proxy + withTenantContext can be proven to isolate tenants under a
-- NOBYPASSRLS role WITHOUT needing the full production schema (no pgvector etc).
--
-- Setup (local Postgres):
--   initdb -D /tmp/taorg-pgtest -U postgres --auth=trust --locale=C
--   pg_ctl -D /tmp/taorg-pgtest -o "-p 5599 -c listen_addresses=localhost" start
--   psql -h localhost -p 5599 -U postgres -d postgres -f scripts/rls-harness.sql
--   TEST_DATABASE_URL='postgresql://app_user:app_pw@localhost:5599/postgres?sslmode=disable' \
--     bun run scripts/verify-rls-isolation.ts

CREATE OR REPLACE FUNCTION public.current_company_id() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_company_id', true), '')::text; $$;
CREATE OR REPLACE FUNCTION public.current_user_id() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::text; $$;

DROP TABLE IF EXISTS agents, companies;
CREATE TABLE companies (id text PRIMARY KEY, user_id text, name text);
ALTER TABLE companies ENABLE ROW LEVEL SECURITY; ALTER TABLE companies FORCE ROW LEVEL SECURITY;
CREATE POLICY companies_tenant_isolation ON companies
  USING ((id = current_company_id()) OR (user_id = current_user_id()));

CREATE TABLE agents (id text PRIMARY KEY, company_id text NOT NULL, role text);
ALTER TABLE agents ENABLE ROW LEVEL SECURITY; ALTER TABLE agents FORCE ROW LEVEL SECURITY;
CREATE POLICY agents_tenant_isolation ON agents USING (company_id = current_company_id());

INSERT INTO companies VALUES ('co_A','user_A','Alpha'),('co_B','user_B','Bravo');
INSERT INTO agents VALUES ('ag_A1','co_A','Sales'),('ag_A2','co_A','Legal'),('ag_B1','co_B','Sales');

DROP ROLE IF EXISTS app_user;
CREATE ROLE app_user LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD 'app_pw';
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;
