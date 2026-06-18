/**
 * Tenant AsyncLocalStorage — the dependency-free core shared by the DB layer
 * and tenant-context. Holds the active tenant + (optionally) the open
 * transaction so the `sql` proxy in db-postgres can route queries onto the
 * transaction that has the RLS GUCs set.
 *
 * This module must NOT import db-postgres (that would create an import cycle:
 * db-postgres → tenant-als is the only allowed direction).
 */

import { AsyncLocalStorage } from "async_hooks";
import type { Sql } from "postgres";

export interface TenantContext {
  /** Clerk-derived company id (firm). MUST be present for tenant queries. */
  companyId: string;
  /** Clerk-derived user id (the human signed in). MUST be present. */
  userId: string;
}

interface TenantStore {
  ctx: TenantContext;
  /** The active transaction-scoped Sql, if one is open. */
  tx?: Sql;
}

export const tenantStore = new AsyncLocalStorage<TenantStore>();

export function getCurrentTenantContext(): TenantContext | null {
  const store = tenantStore.getStore();
  return store ? store.ctx : null;
}

export function getCurrentTx(): Sql | null {
  return tenantStore.getStore()?.tx ?? null;
}

/**
 * Used by the db layer's `sql` proxy to route queries onto the active tenant
 * transaction (with RLS GUCs set) when one is open; returns null otherwise so
 * the proxy falls back to the base pool.
 */
export function getActiveTx(): Sql | null {
  return getCurrentTx();
}

export function assertCtx(ctx: TenantContext, who: string): void {
  if (!ctx.companyId || typeof ctx.companyId !== "string") {
    throw new Error(`${who}: companyId is required (got ${JSON.stringify(ctx.companyId)})`);
  }
  if (!ctx.userId || typeof ctx.userId !== "string") {
    throw new Error(`${who}: userId is required (got ${JSON.stringify(ctx.userId)})`);
  }
}

/**
 * Run `fn` with the tenant context active in AsyncLocalStorage. Does NOT open a
 * transaction or set GUCs (that's withTenantContext's job).
 */
export async function runWithTenantStore<T>(
  ctx: TenantContext,
  fn: () => Promise<T>
): Promise<T> {
  assertCtx(ctx, "runWithTenantStore");
  return await tenantStore.run({ ctx }, fn);
}

/** Publish an already-open transaction + ctx into ALS for the duration of `fn`. */
export async function runWithTenantTx<T>(
  ctx: TenantContext,
  tx: Sql,
  fn: () => Promise<T>
): Promise<T> {
  return await tenantStore.run({ ctx, tx }, fn);
}
