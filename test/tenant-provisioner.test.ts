/**
 * Unit tests for src/lib/tenant-provisioner.ts.
 *
 * Mocks the postgres `sql` client with a fake in-memory companies table.
 * Each adapter (kms, langfuse, schema, vault) is mocked with a vi.fn so
 * we can assert call counts + idempotency.
 */

import { describe, it, expect, vi } from "vitest";
import { TenantProvisioner, selfServeBlocked } from "@/lib/tenant-provisioner";
import type { Sql } from "postgres";

interface FakeRow {
  id: string;
  user_id: string | null;
  name: string;
  url: string;
  spoc_phone: string | null;
  kms_key_alias: string | null;
  langfuse_project_id: string | null;
  provisioning_state: string | null;
  provisioning_error: string | null;
}

function buildFakeSql() {
  const rows = new Map<string, FakeRow>();
  // The fake mimics postgres.js's tagged-template style enough for the
  // provisioner's queries. We dispatch on the SQL keyword in the first
  // template fragment and on positional values.
  // Note: template literal handling assumes we can read raw .strings;
  // postgres.js exposes it as a plain string array.
  const sqlFn = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    const sql = strings.join("?").trim();
    const upperFirst = sql.replace(/\s+/g, " ").toUpperCase();
    if (upperFirst.startsWith("SELECT")) {
      const id = values.find((v) => typeof v === "string");
      const row = rows.get(id as string);
      return Promise.resolve(row ? [row] : []);
    }
    if (upperFirst.startsWith("INSERT INTO COMPANIES")) {
      const [id, userId, name, url, spocPhone] = values as unknown[];
      const row: FakeRow = {
        id: id as string,
        user_id: (userId as string | null) ?? null,
        name: name as string,
        url: url as string,
        spoc_phone: (spocPhone as string | null) ?? null,
        kms_key_alias: null,
        langfuse_project_id: null,
        provisioning_state: "created",
        provisioning_error: null,
      };
      rows.set(row.id, row);
      return Promise.resolve([]);
    }
    if (upperFirst.startsWith("UPDATE COMPANIES")) {
      // SQL: SET provisioning_state = ${state}, provisioning_error = ..., kms_key_alias = COALESCE(${setKms}, kms_key_alias), ...
      // Values order matches the parameters in source.
      // Parameters list (in order):
      //   0: state
      //   1: state (in CASE for error null)
      //   2: setError
      //   3: setKms
      //   4: setLangfuse
      //   5: state (CASE for provisioned_at)
      //   6: firmId
      // The simple `SET spoc_phone = ${...}` UPDATE branch uses:
      //   0: spoc_phone
      //   1: firmId
      // Our matcher: if there are 2 values, it's the spoc-phone branch.
      if (values.length === 2) {
        const [spocPhone, id] = values as [string, string];
        const r = rows.get(id);
        if (r) r.spoc_phone = spocPhone;
        return Promise.resolve([]);
      }
      // legacy created upgrade path: SET provisioning_state = 'created' WHERE id = ${id}
      if (values.length === 1) {
        const id = values[0] as string;
        const r = rows.get(id);
        if (r && !r.provisioning_state) r.provisioning_state = "created";
        return Promise.resolve([]);
      }
      // Standard transition. Source SQL has 6 placeholders, in this order:
      //   0: provisioning_state
      //   1: provisioning_error
      //   2: kms_key_alias (COALESCE arg)
      //   3: langfuse_project_id (COALESCE arg)
      //   4: state (in CASE for provisioned_at)
      //   5: firm id (WHERE)
      const [state, setError, setKms, setLangfuse, , firmId] = values as [
        string,
        string | null,
        string | null,
        string | null,
        string,
        string
      ];
      const r = rows.get(firmId);
      if (r) {
        r.provisioning_state = state;
        r.provisioning_error = state === "failed" ? setError : null;
        if (setKms) r.kms_key_alias = setKms;
        if (setLangfuse) r.langfuse_project_id = setLangfuse;
      }
      return Promise.resolve([]);
    }
    return Promise.resolve([]);
  }) as unknown as Sql;
  return { sqlFn, rows };
}

describe("TenantProvisioner.provision — happy path", () => {
  it("creates a new firm and walks all states to ready", async () => {
    const { sqlFn, rows } = buildFakeSql();
    const adapters = {
      applySchema: vi.fn().mockResolvedValue(undefined),
      provisionKms: vi.fn().mockResolvedValue("alias/firm/firm_a"),
      provisionLangfuse: vi.fn().mockResolvedValue("lf_firm_a"),
      initializeVault: vi.fn().mockResolvedValue(undefined),
    };
    const p = TenantProvisioner.withDefaults(adapters);
    const result = await p.provision(
      {
        firmId: "firm_a",
        name: "Acme Pvt Ltd",
        url: "https://acme.example",
        spocPhone: "+919999911111",
      },
      sqlFn
    );
    expect(result.state).toBe("ready");
    expect(result.steps).toBe(5); // schema, kms, langfuse, vault, ready
    expect(result.kmsKeyAlias).toBe("alias/firm/firm_a");
    expect(result.langfuseProjectId).toBe("lf_firm_a");
    expect(adapters.applySchema).toHaveBeenCalledTimes(1);
    expect(adapters.provisionKms).toHaveBeenCalledTimes(1);
    expect(adapters.provisionLangfuse).toHaveBeenCalledTimes(1);
    expect(adapters.initializeVault).toHaveBeenCalledTimes(1);
    const stored = rows.get("firm_a");
    expect(stored?.provisioning_state).toBe("ready");
  });

  it("idempotent: second run on a ready firm is a no-op (0 steps, no adapter calls)", async () => {
    const { sqlFn } = buildFakeSql();
    const adapters = {
      applySchema: vi.fn().mockResolvedValue(undefined),
      provisionKms: vi.fn().mockResolvedValue("alias/x"),
      provisionLangfuse: vi.fn().mockResolvedValue("lf_x"),
      initializeVault: vi.fn().mockResolvedValue(undefined),
    };
    const p = TenantProvisioner.withDefaults(adapters);
    await p.provision(
      { firmId: "firm_b", name: "B Co", url: "https://b.example" },
      sqlFn
    );
    // Reset call counts.
    for (const fn of Object.values(adapters)) (fn as ReturnType<typeof vi.fn>).mockClear();
    const second = await p.provision({ firmId: "firm_b" }, sqlFn);
    expect(second.state).toBe("ready");
    expect(second.steps).toBe(0);
    expect(adapters.applySchema).not.toHaveBeenCalled();
    expect(adapters.provisionKms).not.toHaveBeenCalled();
  });
});

describe("TenantProvisioner.provision — failure handling", () => {
  it("when an adapter throws, persists state=failed with the error", async () => {
    const { sqlFn, rows } = buildFakeSql();
    const adapters = {
      applySchema: vi.fn().mockResolvedValue(undefined),
      provisionKms: vi.fn().mockRejectedValue(new Error("KMS quota exhausted")),
      provisionLangfuse: vi.fn().mockResolvedValue("lf_x"),
      initializeVault: vi.fn().mockResolvedValue(undefined),
    };
    const p = TenantProvisioner.withDefaults(adapters);
    const result = await p.provision(
      { firmId: "firm_c", name: "C Co", url: "https://c.example" },
      sqlFn
    );
    expect(result.state).toBe("failed");
    expect(result.error).toMatch(/KMS quota/);
    expect(rows.get("firm_c")?.provisioning_error).toMatch(/KMS quota/);
  });

  it("resume after failure: re-running picks up from schema_applied (conservative resume)", async () => {
    const { sqlFn } = buildFakeSql();
    let kmsAttempts = 0;
    const adapters = {
      applySchema: vi.fn().mockResolvedValue(undefined),
      provisionKms: vi.fn().mockImplementation(async () => {
        kmsAttempts++;
        if (kmsAttempts === 1) throw new Error("transient");
        return "alias/firm/firm_d";
      }),
      provisionLangfuse: vi.fn().mockResolvedValue("lf_d"),
      initializeVault: vi.fn().mockResolvedValue(undefined),
    };
    const p = TenantProvisioner.withDefaults(adapters);
    const r1 = await p.provision(
      { firmId: "firm_d", name: "D Co", url: "https://d.example" },
      sqlFn
    );
    expect(r1.state).toBe("failed");

    const r2 = await p.provision({ firmId: "firm_d" }, sqlFn);
    expect(r2.state).toBe("ready");
    expect(kmsAttempts).toBe(2);
  });
});

describe("TenantProvisioner.provision — input validation", () => {
  it("requires name + url when the row doesn't exist yet", async () => {
    const { sqlFn } = buildFakeSql();
    const p = TenantProvisioner.withDefaults();
    await expect(p.provision({ firmId: "firm_e" }, sqlFn)).rejects.toThrow(
      /name \+ url required/
    );
  });

  it("updates spoc_phone when input differs from stored value", async () => {
    const { sqlFn, rows } = buildFakeSql();
    const p = TenantProvisioner.withDefaults();
    await p.provision(
      {
        firmId: "firm_f",
        name: "F Co",
        url: "https://f.example",
        spocPhone: "+919998877001",
      },
      sqlFn
    );
    expect(rows.get("firm_f")?.spoc_phone).toBe("+919998877001");
    // Now run again with a different SPOC phone — should update.
    await p.provision({ firmId: "firm_f", spocPhone: "+919998877002" }, sqlFn);
    expect(rows.get("firm_f")?.spoc_phone).toBe("+919998877002");
  });
});

describe("selfServeBlocked", () => {
  it("blocks when env flag is unset", () => {
    const prev = process.env.PROVISIONER_SELF_SERVE;
    delete process.env.PROVISIONER_SELF_SERVE;
    expect(selfServeBlocked()).toBe(true);
    if (prev !== undefined) process.env.PROVISIONER_SELF_SERVE = prev;
  });

  it("unblocks when env flag is enabled", () => {
    const prev = process.env.PROVISIONER_SELF_SERVE;
    process.env.PROVISIONER_SELF_SERVE = "enabled";
    expect(selfServeBlocked()).toBe(false);
    if (prev === undefined) delete process.env.PROVISIONER_SELF_SERVE;
    else process.env.PROVISIONER_SELF_SERVE = prev;
  });
});
