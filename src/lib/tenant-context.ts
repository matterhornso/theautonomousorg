/**
 * Tenant context — sets Postgres session GUCs for RLS enforcement.
 *
 * Usage:
 *   const result = await withTenantContext(
 *     { companyId, userId },
 *     async (tx) => tx`SELECT * FROM agents WHERE company_id = ${companyId}`
 *   );
 *
 * Inside the callback, every query the transaction runs has Postgres GUCs
 * `app.current_company_id` and `app.current_user_id` set, so RLS policies
 * defined in migrations/001_rls_policies.sql can enforce tenant isolation.
 *
 * Without this wrapper, RLS policies see NULL GUCs and reject every query.
 *
 * Eng review locked decision: per-tenant data isolation is mandatory; RLS is
 * the defense-in-depth layer on top of app-level WHERE clauses. See:
 *   ~/.gstack/projects/matterhornso-theautonomousorg/abhinavramesh-main-design-20260501-162924.md
 *
 * Migration status (2026-05-02):
 *   - Migration SQL written (migrations/001_rls_policies.sql)
 *   - This helper shipped, available for new code paths
 *   - Migration NOT YET APPLIED in production; will land after every existing
 *     query path is wrapped or tagged
 */

import type { Sql } from "postgres";
import { sql } from "./db-postgres";
import {
  tenantStore,
  assertCtx,
  getCurrentTenantContext,
  getCurrentTx,
  runWithTenantStore,
  type TenantContext,
} from "./tenant-als";

// Re-exported for back-compat: callers still import these from "./tenant-context".
export type { TenantContext };
export { getCurrentTenantContext, getCurrentTx, runWithTenantStore };

/**
 * Run a sequence of queries inside a Postgres transaction with tenant GUCs set.
 *
 * The transaction is committed if `fn` returns; rolled back if `fn` throws.
 * GUCs are set with `set_config(..., is_local => true)` so they auto-clear at
 * commit/rollback. There is no manual cleanup required.
 *
 * @throws if companyId or userId is missing/empty
 * @throws if the underlying transaction fails
 */
export async function withTenantContext<T>(
  ctx: TenantContext,
  fn: (tx: Sql) => Promise<T>
): Promise<T> {
  assertCtx(ctx, "withTenantContext");
  if (!sql) {
    throw new Error("withTenantContext: DATABASE_URL is not configured");
  }

  return await sql.begin(async (tx) => {
    // set_config(setting, value, is_local). is_local=true scopes to this transaction.
    // Cast: postgres.js TransactionSql has Sql call signatures at runtime; the typings
    // do not always expose them in the version we use.
    const txSql = tx as unknown as Sql;
    await txSql`SELECT set_config('app.current_company_id', ${ctx.companyId}, true)`;
    await txSql`SELECT set_config('app.current_user_id', ${ctx.userId}, true)`;
    // Publish into AsyncLocalStorage so getCurrentTx() / getCurrentTenantContext()
    // see the active tx for code that runs inside fn() without the tx param.
    return await tenantStore.run({ ctx, tx: txSql }, () => fn(txSql));
  }) as T;
}

/**
 * Run queries with ONLY the user GUC set (app.current_user_id), leaving
 * app.current_company_id empty.
 *
 * Use for BOOTSTRAP / user-scoped reads that happen before a company is chosen
 * — e.g. resolveTenant()'s getCompaniesByUser(userId), "list my companies", or
 * resolving which company a user owns. The `companies` RLS policy is
 * `(id = current_company_id()) OR (user_id = current_user_id())`, so with the
 * user GUC set these queries correctly return the caller's own companies (and
 * nothing else) under the NOBYPASSRLS app_user role.
 */
export async function withUserContext<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  if (!userId || typeof userId !== "string") {
    throw new Error("withUserContext: userId is required (got " + JSON.stringify(userId) + ")");
  }
  if (!sql) {
    throw new Error("withUserContext: DATABASE_URL is not configured");
  }
  return await sql.begin(async (tx) => {
    const txSql = tx as unknown as Sql;
    await txSql`SELECT set_config('app.current_user_id', ${userId}, true)`;
    await txSql`SELECT set_config('app.current_company_id', '', true)`;
    return await tenantStore.run({ ctx: { companyId: "", userId }, tx: txSql }, fn);
  }) as T;
}

/**
 * Like withTenantContext but for system-level operations that legitimately
 * need to bypass tenant scope: cron jobs, webhook receivers, migrations.
 *
 * The migration-applying script and any code that genuinely needs to read
 * across tenants (analytics, platform-level audits) uses this. App code
 * serving user requests should NEVER call this.
 *
 * GUCs are deliberately NOT set; RLS policies will see NULL and reject
 * tenant-scoped queries unless the connection role has BYPASSRLS.
 */
export async function withSystemContext<T>(
  fn: (tx: Sql) => Promise<T>
): Promise<T> {
  if (!sql) {
    throw new Error("withSystemContext: DATABASE_URL is not configured");
  }
  return await sql.begin(async (tx) => {
    return await fn(tx as unknown as Sql);
  }) as T;
}

/**
 * Verify the current session has a tenant context set.
 * Useful in middleware for catching un-wrapped queries early in development.
 *
 * Returns the active context, or throws if not set.
 */
export async function requireTenantContext(tx: Sql): Promise<TenantContext> {
  const [row] = await tx<{ company_id: string | null; user_id: string | null }[]>`
    SELECT
      current_setting('app.current_company_id', true) AS company_id,
      current_setting('app.current_user_id', true) AS user_id
  `;
  if (!row?.company_id || !row?.user_id) {
    throw new Error(
      "requireTenantContext: no tenant context active. Wrap your query in withTenantContext()."
    );
  }
  return { companyId: row.company_id, userId: row.user_id };
}
