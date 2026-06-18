/**
 * Unit tests for recorder device API keys (migration 012).
 *
 * Security invariants asserted (against a captured sql mock):
 *   1. Only the SHA-256 HASH is written — the raw key never hits the DB.
 *   2. Resolution matches by hash and excludes revoked keys.
 *   3. A bad/empty key resolves to null (→ 401 at the route).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHash } from "crypto";

interface Captured {
  text: string;
  values: unknown[];
}
const calls: Captured[] = [];
let sqlRows: unknown[] = [];
const sqlMock = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
  calls.push({ text: strings.join(" ? "), values });
  return Promise.resolve(sqlRows);
});
vi.mock("@/lib/db-postgres", () => ({ sql: sqlMock }));

import {
  generateRecorderKey,
  createRecorderKey,
  resolveCompanyByRecorderKey,
  revokeRecorderKey,
} from "@/lib/recorder-keys";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

beforeEach(() => {
  calls.length = 0;
  sqlRows = [];
  sqlMock.mockClear();
});

describe("generateRecorderKey", () => {
  it("produces a tar_-prefixed key and its matching sha256 hash", () => {
    const { key, hash } = generateRecorderKey();
    expect(key.startsWith("tar_")).toBe(true);
    expect(key.length).toBeGreaterThan(40);
    expect(hash).toBe(sha(key));
  });

  it("is unique per call", () => {
    expect(generateRecorderKey().key).not.toBe(generateRecorderKey().key);
  });
});

describe("createRecorderKey", () => {
  it("stores only the hash, never the raw key", async () => {
    const res = await createRecorderKey("co-1", "factory fleet");
    expect(res).toBeTruthy();
    const insert = calls.find((c) => c.text.includes("INSERT INTO recorder_api_keys"));
    expect(insert).toBeTruthy();
    // The raw key must NOT appear in any bound value.
    expect(insert!.values).not.toContain(res!.key);
    // The hash of the returned key MUST be one of the bound values.
    expect(insert!.values).toContain(sha(res!.key));
    expect(insert!.values).toContain("co-1");
  });
});

describe("resolveCompanyByRecorderKey", () => {
  it("looks up by hash, excludes revoked, returns the company", async () => {
    sqlRows = [{ id: "rk_1", company_id: "co-9" }];
    const out = await resolveCompanyByRecorderKey("tar_abc123");
    expect(out).toEqual({ companyId: "co-9", keyId: "rk_1" });
    const lookup = calls.find((c) => c.text.includes("FROM recorder_api_keys"));
    expect(lookup!.text).toContain("key_hash =");
    expect(lookup!.text).toContain("revoked_at IS NULL");
    expect(lookup!.values).toContain(sha("tar_abc123"));
    // raw key is never bound
    expect(lookup!.values).not.toContain("tar_abc123");
  });

  it("returns null for an unknown key", async () => {
    sqlRows = [];
    expect(await resolveCompanyByRecorderKey("tar_nope")).toBeNull();
  });

  it("returns null for an empty/missing key without querying", async () => {
    expect(await resolveCompanyByRecorderKey(undefined)).toBeNull();
    expect(await resolveCompanyByRecorderKey("")).toBeNull();
    expect(calls.length).toBe(0);
  });
});

describe("revokeRecorderKey", () => {
  it("soft-revokes by id and reports success", async () => {
    sqlRows = [{ id: "rk_1" }];
    const done = await revokeRecorderKey("rk_1");
    expect(done).toBe(true);
    const upd = calls.find((c) => c.text.includes("UPDATE recorder_api_keys"));
    expect(upd!.text).toContain("revoked_at = now()");
    expect(upd!.values).toContain("rk_1");
  });

  it("returns false when nothing was revoked", async () => {
    sqlRows = [];
    expect(await revokeRecorderKey("rk_x")).toBe(false);
  });
});
