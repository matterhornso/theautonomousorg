import { withTenantContext } from "./tenant-context";

/**
 * Run a tenant-scoped API handler inside a Postgres transaction that has the
 * RLS GUCs (app.current_company_id / app.current_user_id) set, so every db call
 * the handler makes is enforced by Row-Level Security — once the app connects
 * as a NOBYPASSRLS role (see migrations/011_least_privilege_role.sql).
 *
 * The handler calls db functions normally; they route through the `sql` proxy
 * in db-postgres onto this transaction automatically (no `tx` threading).
 *
 * USE WHEN companyId is known up front (from the URL or the caller's owned
 * companies) AND ownership has already been verified.
 *
 * For resolve-by-id routes (e.g. /api/upload/[fileId], /api/workflows PUT by
 * workflowId) there is a chicken-and-egg: you must look up the resource to learn
 * its company_id before you can set the GUC. Do that lookup + the ownership
 * check first (app-level, already in place), THEN call inTenant() for the rest.
 *
 * Dormant until cutover: while DATABASE_URL connects as the BYPASSRLS `postgres`
 * role, this changes nothing about which rows are returned — it only opens a
 * transaction and sets the GUCs that RLS will read after cutover.
 */
export async function inTenant<T>(
  companyId: string,
  userId: string,
  run: () => Promise<T>
): Promise<T> {
  return withTenantContext({ companyId, userId }, async () => run());
}
