# Migrations

SQL migrations applied incrementally to the Postgres database.

## Pattern

- Each migration is a single SQL file: `NNN_description.sql`.
- Migrations are forward-only and idempotent. Re-running an applied migration is a no-op.
- Apply order is by filename. `001` runs before `002`.
- Rollback files (`NNN_description_rollback.sql`) exist for emergency only; the standard recovery path is to write a new forward migration that undoes the unwanted change.

## Inventory

| ID | Title | Status | Applied to |
|----|-------|--------|-----------|
| 001 | RLS policies for multi-tenant isolation | **READY (not applied)** | none |

## How to apply

```bash
# Validate the migration syntax against your local Postgres without changing data
psql "$DATABASE_URL" -c "BEGIN; \i migrations/001_rls_policies.sql ROLLBACK;"

# Apply for real
psql "$DATABASE_URL" -f migrations/001_rls_policies.sql
```

## 001 — RLS policies (DO NOT APPLY YET)

This migration enables Postgres Row-Level Security on every tenant-scoped
table. Once applied, every query that does not first set the session GUCs
`app.current_company_id` and `app.current_user_id` returns zero rows.

**Applying this migration before every server-side query path is wrapped in
`withTenantContext()` (see `src/lib/tenant-context.ts`) will cause a production
outage** because existing queries do not yet set the GUCs.

### Apply roadmap

1. **PR 1 (this branch):** Migration SQL + `withTenantContext()` helper + unit tests. Migration NOT applied.
2. **PR 2:** Audit every server-side query path. Wrap every `db.ts` / `db-postgres.ts` call site that reads tenant data in `withTenantContext()`. Add integration tests against a real Postgres with the migration applied.
3. **PR 3:** Apply the migration in a staging Supabase project. Run the full regression suite. Verify every existing flow still works under RLS.
4. **PR 4:** Apply in production behind a feature flag (`RLS_ENFORCED=true` env var that the helper reads). Roll out gradually.

### Coverage

The migration enables RLS on:

**Direct tenant-scoped (13 tables, bound to `current_company_id()`):**
agents, team_members, debriefs, subscriptions, usage_records, api_keys,
user_api_keys, webhooks, chai_time_sessions, chai_time_config, workflows,
workflow_runs, eval_runs.

**Nullable tenant-scoped (2 tables, NULL company_id allowed for legacy/unauthenticated rows):**
messaging_users, file_uploads.

**Transitively scoped via agent_id (7 tables):**
agent_custom_skills, agent_actions, conversations, memory, tasks,
agent_assignments, agent_evals.

**Two-hop transitive (1 table, via conversation_id → agent_id):**
messages.

**Cross-agent constrained (1 table, both source and target must be in tenant):**
inter_agent_messages.

**User-scoped (3 tables, bound to `current_user_id()`):**
user_profiles, credits, credit_transactions.

**Special policy (companies table):**
visible to either the company's owner (`user_id = current_user_id()`) OR the
active tenant (`id = current_company_id()`). Supports onboarding flow where
a user creates their first company before the GUC is set.

**Global (1 table, read-all, write requires no tenant context):**
eval_test_suites.

**Total:** 28 tables locked down. The migration's final `DO $$` block fails
the migration if any expected table is missing RLS, so the migration is
self-validating.

### Sanity check after applying

```sql
-- With tenant set: returns only firm_a's agents.
SET app.current_company_id = 'firm_a';
SELECT count(*) FROM agents;

-- With different tenant: different count.
SET app.current_company_id = 'firm_b';
SELECT count(*) FROM agents;

-- Without tenant: zero rows (RLS rejects).
RESET app.current_company_id;
SELECT count(*) FROM agents;  -- expect 0
```

If any of these return wrong counts, RLS is misconfigured. Roll back and
investigate before applying to staging.
