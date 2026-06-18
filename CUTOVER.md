# RLS cutover plan — switching to the `app_user` (NOBYPASSRLS) role

Goal: make Postgres Row-Level Security a *real* enforced layer (not just app-level
`WHERE company_id`), by connecting the app as a role that does **not** bypass RLS.

## Status: mechanism PROVEN ✅

The plumbing is built and verified end-to-end against a real Postgres connected
as a NOBYPASSRLS `app_user` role (`scripts/verify-rls-isolation.ts` +
`scripts/rls-harness.sql`). All 7 checks pass:

- a tenant's unscoped `SELECT` returns only its own rows (RLS filters even with no `WHERE`)
- a tenant cannot fetch another tenant's row by primary key
- an **un-wrapped** query returns **0 rows** — the failure mode is *empty*, never a leak
- `withUserContext` bootstrap returns only the caller's own companies
- the connection is confirmed NOBYPASSRLS

Reproduce locally:
```bash
initdb -D /tmp/pg -U postgres --auth=trust --locale=C
pg_ctl -D /tmp/pg -o "-p 5599 -c listen_addresses=localhost" start
psql -h localhost -p 5599 -U postgres -d postgres -f scripts/rls-harness.sql
TEST_DATABASE_URL='postgresql://app_user:app_pw@localhost:5599/postgres?sslmode=disable' \
  bun run scripts/verify-rls-isolation.ts
```

## The mechanism

- `db-postgres.sql` is a Proxy → routes every query onto the active tenant
  transaction (GUCs set) when one is open, else the base pool. Zero call-site changes.
- `inTenant(companyId, userId, fn)` — sets **both** GUCs. Wrap a whole handler in
  it; the in-handler ownership check (`getCompaniesByUser`) still works because the
  `companies` policy allows `OR user_id = current_user_id()`.
- `withUserContext(userId, fn)` — sets **only** the user GUC. For BOOTSTRAP reads
  before a company is chosen (`getCompaniesByUser`, "list my companies").
- `withSystemContext(fn)` — no GUCs; for cron/migrations that legitimately cross tenants.

**Low-risk cutover:** because a missed wrap returns *empty* (not a leak), you can flip
the role and fix any empty surfaces incrementally rather than needing 100% coverage first.

## The three route classes

1. **company-known** (companyId in URL/query/body): wrap the whole handler in
   `inTenant(companyId, userId, async () => { ...ownership check + work... })`.
2. **user-bootstrap** (only userId; "my companies", per-user keys): wrap in
   `withUserContext(userId, () => ...)`.
3. **resolve-by-id** (only a resourceId, e.g. `fileId`/`agentId`/`workflowId`): under
   RLS you can't look the row up without already knowing its company. **Decision:
   require `companyId` in the request** for these, then treat as class 1. (Alternative:
   a small privileged "resolver" connection for id→company_id lookups + app-level
   ownership check — avoids a contract change but reintroduces a narrow BYPASSRLS path.)
4. **self-authenticating / public** (webhooks, cron, billing webhook, analyze, health,
   newsletter, contact): **no wrap** — they verify their own signature/secret or are public.
5. **external-call-heavy** (chat, shopify/*, debrief/generate, memory/ingest/audio):
   wrap ONLY the DB read/write sections, NEVER the LLM/API call (don't hold a tx open).

## Coverage checklist

**Done (wired + verified):**
- [x] `admin/_lib/resolve-tenant` → `withUserContext` (RSC entry chokepoint)
- [x] `dashboard/[companyId]/layout` → `withUserContext`
- [x] `admin/_lib/admin-data` `loadAdminBootstrap` → `inTenant`
- [x] `api/search` (class 1), `api/workflows` GET (class 1), `api/actions` companyId branch (class 1)

**TODO — class 1 (wrap whole handler in `inTenant`):**
- [ ] team (GET/POST/PATCH/DELETE), contacts, contacts/import, credits, leaderboard,
      evals, debrief, files, calendar/ingest, chai-time, profile, companies/[id],
      vault/reembed, provision, v1/agents, v1/chat, v1/tasks,
      timesheets/{employees,mark-submitted,reset-submission,run-pass,schedule}

**TODO — class 2 (`withUserContext`):**
- [ ] companies (GET list), keys, user-keys

**TODO — class 3 (add `companyId` to request, then `inTenant`):**
- [ ] upload/[fileId] GET, actions?agentId, agents (GET ?id), agents/status,
      agents/skills, agents/custom, team/assignments, tasks/schedule POST (agentId),
      workflows PUT/DELETE, evals/feedback, timesheets/employees/[id]

**TODO — class 5 (wrap DB sections only):**
- [ ] chat, shopify/{plan,apply,insights}, debrief/generate, memory/ingest, memory/ingest/audio

**TODO — RSC per-page loaders** (each admin page that calls a loader directly):
- [ ] approvals, notifications, vault, agents/[role], agents/[role]/[runId] pages →
      wrap their `loadPendingApprovals`/`loadNotifications`/`loadVaultDocs`/`loadAgentRunsByRole`/`loadAgentRun`
      calls in `inTenant(firm.id, user.id, ...)` (note: these currently fall back to MOCK
      data on RLS-deny, so a miss shows placeholder data rather than erroring).

**No wrap (class 4):** analyze, contact, newsletter, memory-waitlist, health, cron/*,
messaging/* webhooks, billing/webhook, integrations/tally, admin/register-webhooks,
agents/relay, agents/runs/[runId]/feedback, memory/{brief,ingest} (internal-secret),
tasks/process, webhooks/[webhookId], dev-auth.

## Cutover steps (when ready to go live)

1. Finish the TODO wraps above (incrementally — empty surfaces are safe to fix post-flip).
2. Apply `migrations/011_least_privilege_role.sql` to the DB.
3. `ALTER ROLE app_user PASSWORD '<openssl rand -base64 32>';`
4. Point the app at it: `DATABASE_URL=postgresql://app_user:<pw>@<ref>.pooler.supabase.com:6543/postgres`
   Keep the `postgres`/owner URL ONLY for migrations.
5. Verify on staging: a forged `app.current_company_id` returns 0 rows under `app_user`.
