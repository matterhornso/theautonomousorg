/**
 * Unit tests for the memory visibility lane (migration 010 + Phase 1).
 *
 * Goal of this feature: the company brain is "company-shared by default,
 * private opt-in". The PRIMARY enforcement is the app-layer SQL filter in
 * knowledge-graph.ts (the running app connects as a superuser that bypasses
 * RLS), so these tests assert:
 *
 *   1. Writes persist `visibility` + `owner_user_id` (default "company").
 *   2. Reads emit the visibility predicate and thread the viewer's user id as
 *      the `owner_user_id` bind param — null when there is no viewer (agent /
 *      system read), which collapses the predicate to company-only.
 *   3. queryCompanyMemory passes its `viewerUserId` all the way down to the
 *      graph reads.
 *
 * The exact Postgres semantics of `owner_user_id = NULL` excluding private rows
 * is a DB-level guarantee covered by the (deferred) live E2E; here we mock the
 * sql client and assert the query the app *sends*.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Capturing sql tagged-template mock. postgres.js invokes the tag as
// sql`... ${a} ${b}` => fn(stringsArray, a, b, ...). We record the flattened
// SQL text + the ordered bind values, and return [] (no rows).
interface Captured {
  text: string;
  values: unknown[];
}
const calls: Captured[] = [];
const sqlMock = vi.fn(
  (strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join(" ? "), values });
    return Promise.resolve([] as unknown[]);
  }
);

vi.mock("@/lib/db-postgres", () => ({ sql: sqlMock }));

import {
  createConversation,
  createPerson,
  getRecentConversations,
  getRecentDecisions,
  getOpenCommitments,
  getRecentArtifacts,
  summarizeKnowledgeGraph,
} from "@/lib/knowledge-graph";
import { queryCompanyMemory } from "@/lib/memory";

const CO = "co-1";

beforeEach(() => {
  calls.length = 0;
  sqlMock.mockClear();
});

describe("write path — visibility persisted", () => {
  it("createConversation defaults to company-shared with no owner", async () => {
    await createConversation({ companyId: CO, kind: "meeting", title: "Standup" });
    const insert = calls.find((c) => c.text.includes("INSERT INTO memory_conversations"));
    expect(insert).toBeTruthy();
    expect(insert!.text).toContain("visibility");
    expect(insert!.text).toContain("owner_user_id");
    // default lane is "company", owner is null
    expect(insert!.values).toContain("company");
    expect(insert!.values).not.toContain("private");
  });

  it("createConversation persists a private capture with its owner", async () => {
    await createConversation({
      companyId: CO,
      kind: "call",
      title: "1:1 with board",
      visibility: "private",
      ownerUserId: "user_ceo",
    });
    const insert = calls.find((c) => c.text.includes("INSERT INTO memory_conversations"));
    expect(insert!.values).toContain("private");
    expect(insert!.values).toContain("user_ceo");
  });

  // Migration 011: a person from a private capture must inherit the private lane,
  // so a private 1:1 doesn't leak the contact's identity company-wide.
  it("createPerson defaults to company-shared", async () => {
    await createPerson({ companyId: CO, name: "Jane Doe" });
    const insert = calls.find((c) => c.text.includes("INSERT INTO persons"));
    expect(insert).toBeTruthy();
    expect(insert!.text).toContain("visibility");
    expect(insert!.text).toContain("owner_user_id");
    expect(insert!.values).toContain("company");
    expect(insert!.values).not.toContain("private");
  });

  it("createPerson persists a private contact with its owner", async () => {
    await createPerson({
      companyId: CO,
      name: "Jane Doe",
      email: "jane@competitor.com",
      visibility: "private",
      ownerUserId: "user_ceo",
    });
    const insert = calls.find((c) => c.text.includes("INSERT INTO persons"));
    expect(insert!.values).toContain("private");
    expect(insert!.values).toContain("user_ceo");
  });
});

describe("summary counts — viewer threaded so private rows aren't counted", () => {
  it("counts every lane-bearing table (incl. persons) with the visibility predicate", async () => {
    await summarizeKnowledgeGraph(CO, { viewerUserId: "user_z" });
    const visibilityCounts = calls.filter(
      (c) => c.text.includes("count(*)") && c.text.includes("owner_user_id =")
    );
    // persons, conversations, decisions, commitments, events_log, artifacts = 6
    expect(visibilityCounts.length).toBe(6);
    expect(visibilityCounts.every((c) => c.values.includes("user_z"))).toBe(true);
    // persons specifically is now viewer-filtered (the migration-011 fix).
    expect(
      visibilityCounts.some((c) => c.text.includes("FROM persons"))
    ).toBe(true);
  });

  it("agent/system summary (no viewer) binds null owner → company-only counts", async () => {
    await summarizeKnowledgeGraph(CO);
    const visibilityCounts = calls.filter(
      (c) => c.text.includes("count(*)") && c.text.includes("owner_user_id =")
    );
    expect(visibilityCounts.length).toBe(6);
    expect(visibilityCounts.every((c) => c.values.includes(null))).toBe(true);
  });
});

describe("read path — viewer threaded into the visibility predicate", () => {
  const readers: Array<[string, (v?: { viewerUserId?: string }) => Promise<unknown>]> = [
    ["getRecentConversations", (v) => getRecentConversations(CO, 10, v)],
    ["getRecentDecisions", (v) => getRecentDecisions(CO, 10, v)],
    ["getOpenCommitments", (v) => getOpenCommitments(CO, 10, v)],
    ["getRecentArtifacts", (v) => getRecentArtifacts(CO, 10, v)],
  ];

  for (const [name, run] of readers) {
    it(`${name} emits the visibility predicate`, async () => {
      await run({ viewerUserId: "user_x" });
      const q = calls[0];
      expect(q.text).toContain("visibility = 'company'");
      expect(q.text).toContain("owner_user_id =");
      // viewer id is bound as the owner param
      expect(q.values).toContain("user_x");
    });

    it(`${name} binds null owner when there is no viewer (agent read)`, async () => {
      await run(undefined);
      const q = calls[0];
      // companyId + limit are non-null; a null in the params is the owner param,
      // so the predicate collapses to company-only.
      expect(q.values).toContain(null);
      expect(q.values).not.toContain("user_x");
    });
  }
});

describe("queryCompanyMemory — viewer propagation to graph reads", () => {
  it("threads viewerUserId down to the graph SQL", async () => {
    await queryCompanyMemory({ companyId: CO, types: ["graph"], viewerUserId: "user_y" });
    // every graph read should have bound the viewer id
    const graphReads = calls.filter((c) => c.text.includes("owner_user_id ="));
    expect(graphReads.length).toBeGreaterThan(0);
    expect(graphReads.every((c) => c.values.includes("user_y"))).toBe(true);
  });

  it("agent read (no viewer) binds null owner to every graph read", async () => {
    await queryCompanyMemory({ companyId: CO, types: ["graph"] });
    const graphReads = calls.filter((c) => c.text.includes("owner_user_id ="));
    expect(graphReads.length).toBeGreaterThan(0);
    expect(graphReads.every((c) => c.values.includes(null))).toBe(true);
    expect(graphReads.some((c) => c.values.includes("user_y"))).toBe(false);
  });
});
