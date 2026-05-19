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

import { AsyncLocalStorage } from "async_hooks";
import type { Sql } from "postgres";
import { sql } from "./db-postgres";

export interface TenantContext {
  /** Clerk-derived company id (firm). MUST be present for tenant queries. */
  companyId: string;
  /** Clerk-derived user id (the human signed in). MUST be present. */
  userId: string;
}

// ─── AsyncLocalStorage propagation ─────────────────────────────────────────
// Once a request has called runWithTenantStore() (or withTenantContext()),
// any nested code path can read the active tenant via getCurrentTenantContext()
// without threading it through function arguments.

interface TenantStore {
  ctx: TenantContext;
  /** The active transaction-scoped Sql, if one is open. */
  tx?: Sql;
}

const tenantStore = new AsyncLocalStorage<TenantStore>();

/**
 * Read the active tenant context, or null if none is set.
 * Use this in helpers (lessons, escalation, vault) so call sites can drop
 * explicit `companyId` arguments.
 */
export function getCurrentTenantContext(): TenantContext | null {
  const store = tenantStore.getStore();
  return store ? store.ctx : null;
}

/**
 * Read the active transaction-scoped Sql, or null if no transaction is open.
 * Used by db helpers that want to participate in the open transaction
 * without taking an explicit `tx` parameter.
 */
export function getCurrentTx(): Sql | null {
  const store = tenantStore.getStore();
  return store?.tx ?? null;
}

/**
 * Run `fn` with the given tenant context active in AsyncLocalStorage.
 * Does NOT open a transaction or set Postgres GUCs; that's withTenantContext's
 * job. Use this for code paths that don't need a transaction (e.g. background
 * tasks calling `helpers.lessons.write` without the run being inside an open tx).
 */
export async function runWithTenantStore<T>(
  ctx: TenantContext,
  fn: () => Promise<T>
): Promise<T> {
  if (!ctx.companyId || typeof ctx.companyId !== "string") {
    throw new Error(
      "runWithTenantStore: companyId is required (got " + JSON.stringify(ctx.companyId) + ")"
    );
  }
  if (!ctx.userId || typeof ctx.userId !== "string") {
    throw new Error(
      "runWithTenantStore: userId is required (got " + JSON.stringify(ctx.userId) + ")"
    );
  }
  return await tenantStore.run({ ctx }, fn);
}

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
  if (!ctx.companyId || typeof ctx.companyId !== "string") {
    throw new Error(
      "withTenantContext: companyId is required (got " + JSON.stringify(ctx.companyId) + ")"
    );
  }
  if (!ctx.userId || typeof ctx.userId !== "string") {
    throw new Error(
      "withTenantContext: userId is required (got " + JSON.stringify(ctx.userId) + ")"
    );
  }
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
