/**
 * Unit tests for tenant-context.ts.
 *
 * These tests mock the postgres `sql` client so they run without a real
 * database. End-to-end tenant-isolation tests against a real Postgres with
 * the RLS migration applied live in test/tenant-isolation-rls.test.ts (added
 * in the next PR after the migration is applied to the dev database).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// vi.mock is hoisted; use vi.hoisted to lift the mock objects so the factory can see them.
const { beginMock, sqlMock } = vi.hoisted(() => {
  const begin = vi.fn();
  const sql = Object.assign(vi.fn(), { begin });
  return { beginMock: begin, sqlMock: sql };
});

vi.mock("@/lib/db-postgres", () => ({
  sql: sqlMock,
}));

import {
  withTenantContext,
  withSystemContext,
  runWithTenantStore,
  getCurrentTenantContext,
  getCurrentTx,
} from "@/lib/tenant-context";

describe("withTenantContext", () => {
  beforeEach(() => {
    beginMock.mockReset();
    sqlMock.mockReset();
  });

  it("throws when companyId is empty", async () => {
    await expect(
      withTenantContext({ companyId: "", userId: "u1" }, async () => "ok")
    ).rejects.toThrow(/companyId is required/);
  });

  it("throws when userId is empty", async () => {
    await expect(
      withTenantContext({ companyId: "c1", userId: "" }, async () => "ok")
    ).rejects.toThrow(/userId is required/);
  });

  it("throws when companyId is not a string", async () => {
    await expect(
      withTenantContext(
        { companyId: 123 as unknown as string, userId: "u1" },
        async () => "ok"
      )
    ).rejects.toThrow(/companyId is required/);
  });

  it("opens a transaction and sets both GUCs before invoking fn", async () => {
    const txCalls: string[] = [];
    const fakeTx = (strings: TemplateStringsArray, ..._values: unknown[]) => {
      // Capture the SQL template being run.
      txCalls.push(strings.join("?"));
      return Promise.resolve([]);
    };

    beginMock.mockImplementation(async (cb: (tx: typeof fakeTx) => Promise<unknown>) => {
      return await cb(fakeTx);
    });

    const result = await withTenantContext(
      { companyId: "firm_abc", userId: "user_xyz" },
      async (tx) => {
        // The transaction-scoped tx should be passed through.
        await tx`SELECT 1 FROM agents`;
        return "fn-result";
      }
    );

    expect(beginMock).toHaveBeenCalledTimes(1);
    expect(result).toBe("fn-result");

    // Two set_config calls fire BEFORE the fn's queries.
    expect(txCalls.length).toBeGreaterThanOrEqual(3);
    expect(txCalls[0]).toMatch(/set_config\('app\.current_company_id'/);
    expect(txCalls[1]).toMatch(/set_config\('app\.current_user_id'/);
    expect(txCalls[2]).toMatch(/SELECT 1 FROM agents/);
  });

  it("propagates errors from fn (transaction rolls back)", async () => {
    const fakeTx = (_strings: TemplateStringsArray, ..._values: unknown[]) =>
      Promise.resolve([]);

    beginMock.mockImplementation(async (cb: (tx: typeof fakeTx) => Promise<unknown>) => {
      // sql.begin rolls back if cb throws and re-raises.
      try {
        return await cb(fakeTx);
      } catch (err) {
        throw err;
      }
    });

    await expect(
      withTenantContext({ companyId: "c1", userId: "u1" }, async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow(/boom/);
  });

  it("returns the fn result unchanged", async () => {
    const fakeTx = (_strings: TemplateStringsArray, ..._values: unknown[]) =>
      Promise.resolve([]);
    beginMock.mockImplementation(async (cb: (tx: typeof fakeTx) => Promise<unknown>) => cb(fakeTx));

    const obj = { rows: [1, 2, 3], count: 3 };
    const result = await withTenantContext(
      { companyId: "c1", userId: "u1" },
      async () => obj
    );
    expect(result).toBe(obj);
  });
});

describe("AsyncLocalStorage propagation", () => {
  beforeEach(() => {
    beginMock.mockReset();
    sqlMock.mockReset();
  });

  it("getCurrentTenantContext returns null outside a store", () => {
    expect(getCurrentTenantContext()).toBeNull();
    expect(getCurrentTx()).toBeNull();
  });

  it("runWithTenantStore makes the ctx visible to nested code", async () => {
    let observed: ReturnType<typeof getCurrentTenantContext> = null;
    await runWithTenantStore({ companyId: "firm_x", userId: "user_x" }, async () => {
      observed = getCurrentTenantContext();
    });
    expect(observed).toEqual({ companyId: "firm_x", userId: "user_x" });
    // Outside the run, it goes back to null.
    expect(getCurrentTenantContext()).toBeNull();
  });

  it("runWithTenantStore validates companyId/userId", async () => {
    await expect(
      runWithTenantStore({ companyId: "", userId: "u1" }, async () => "x")
    ).rejects.toThrow(/companyId is required/);
    await expect(
      runWithTenantStore({ companyId: "c1", userId: "" }, async () => "x")
    ).rejects.toThrow(/userId is required/);
  });

  it("withTenantContext exposes the tx via getCurrentTx() inside fn", async () => {
    const fakeTx = (_strings: TemplateStringsArray, ..._values: unknown[]) =>
      Promise.resolve([]);
    beginMock.mockImplementation(async (cb: (tx: typeof fakeTx) => Promise<unknown>) =>
      cb(fakeTx)
    );

    let observedCtx: ReturnType<typeof getCurrentTenantContext> = null;
    let observedTx: ReturnType<typeof getCurrentTx> = null;
    await withTenantContext({ companyId: "firm_y", userId: "user_y" }, async () => {
      observedCtx = getCurrentTenantContext();
      observedTx = getCurrentTx();
      return "ok";
    });
    expect(observedCtx).toEqual({ companyId: "firm_y", userId: "user_y" });
    expect(observedTx).not.toBeNull();
  });

  it("nested runWithTenantStore replaces the outer ctx", async () => {
    let inner: ReturnType<typeof getCurrentTenantContext> = null;
    await runWithTenantStore({ companyId: "outer", userId: "u" }, async () => {
      await runWithTenantStore({ companyId: "inner", userId: "u" }, async () => {
        inner = getCurrentTenantContext();
      });
      // After inner exits, outer ctx is restored.
      expect(getCurrentTenantContext()).toEqual({ companyId: "outer", userId: "u" });
    });
    expect(inner).toEqual({ companyId: "inner", userId: "u" });
  });
});

describe("withSystemContext", () => {
  beforeEach(() => {
    beginMock.mockReset();
  });

  it("opens a transaction WITHOUT setting tenant GUCs", async () => {
    const txCalls: string[] = [];
    const fakeTx = (strings: TemplateStringsArray, ..._values: unknown[]) => {
      txCalls.push(strings.join("?"));
      return Promise.resolve([]);
    };

    beginMock.mockImplementation(async (cb: (tx: typeof fakeTx) => Promise<unknown>) => cb(fakeTx));

    await withSystemContext(async (tx) => {
      await tx`SELECT 1`;
    });

    expect(beginMock).toHaveBeenCalledTimes(1);
    expect(txCalls.length).toBe(1);
    expect(txCalls[0]).toMatch(/SELECT 1/);
    // No set_config calls happened.
    expect(txCalls.find((s) => s.includes("set_config"))).toBeUndefined();
  });
});
