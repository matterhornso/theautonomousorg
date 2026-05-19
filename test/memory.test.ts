import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  getAgentsByCompany: vi.fn(),
  getMemoryByAgentIds: vi.fn(),
  getActivityFeed: vi.fn(),
}));

vi.mock("@/lib/lessons", () => ({
  buildLessonsHelper: vi.fn(),
}));

vi.mock("@/lib/vault", () => ({
  buildVaultHelper: vi.fn(),
}));

vi.mock("@/lib/db-postgres", () => ({
  sql: null,
}));

import { queryCompanyMemory, summarizeCompanyMemory } from "@/lib/memory";
import * as db from "@/lib/db";
import { buildLessonsHelper } from "@/lib/lessons";
import { buildVaultHelper } from "@/lib/vault";

const mockAgents = [
  { id: "a-sales", role: "Sales", company_id: "co-1" },
  { id: "a-legal", role: "Legal", company_id: "co-1" },
];

const mockMemoryByAgent = {
  "a-sales": [
    { key: "icp", value: "Series B FinTech CTOs", created_at: "2026-05-01T10:00:00Z" },
    { key: "tone", value: "consultative, never pushy", created_at: "2026-05-05T09:00:00Z" },
  ],
  "a-legal": [
    { key: "msa-template", value: "v3 with mutual NDA", created_at: "2026-04-20T11:00:00Z" },
  ],
};

const mockLessons = [
  {
    agentId: "a-sales",
    runId: "run-1",
    taskDescription: "cold outreach to FinTech CTOs",
    outputAccepted: "modified" as const,
    modificationDetail: "subject line changed to 15-min walkthrough",
    selfCritique: "previous demo framing under-performed",
    createdAt: new Date("2026-05-08T14:00:00Z"),
  },
];

const mockActivity = [
  {
    type: "task" as const,
    agent_role: "Sales",
    agent_id: "a-sales",
    title: "Outreach to 20 FinTech CTOs",
    detail: "Sent · 8 replies",
    status: "completed",
    created_at: "2026-05-10T08:00:00Z",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  (db.getAgentsByCompany as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgents);
  (db.getMemoryByAgentIds as ReturnType<typeof vi.fn>).mockResolvedValue(mockMemoryByAgent);
  (db.getActivityFeed as ReturnType<typeof vi.fn>).mockResolvedValue(mockActivity);
  (buildLessonsHelper as ReturnType<typeof vi.fn>).mockImplementation(({ agentId }) => ({
    readRecent: vi.fn().mockResolvedValue(agentId === "a-sales" ? mockLessons : []),
    write: vi.fn(),
  }));
  (buildVaultHelper as ReturnType<typeof vi.fn>).mockReturnValue({
    query: vi.fn().mockResolvedValue([
      {
        chunkId: "c-1",
        text: "Soma sparkling water — sugar-free, electrolyte-rich",
        source: { docId: "vd-1", docTitle: "Brand Voice Doc" },
        score: 0.82,
      },
    ]),
    ingest: vi.fn(),
  });
});

describe("queryCompanyMemory", () => {
  it("merges memory + lessons + activity for a tenant without a query", async () => {
    const hits = await queryCompanyMemory({ companyId: "co-1" });
    const types = hits.map((h) => h.type);
    expect(types).toContain("memory");
    expect(types).toContain("lesson");
    expect(types).toContain("activity");
    // No query supplied -> vault is skipped
    expect(types).not.toContain("vault");
  });

  it("includes vault hits when a free-text query is supplied", async () => {
    const hits = await queryCompanyMemory({
      companyId: "co-1",
      query: "sparkling water",
    });
    expect(hits.some((h) => h.type === "vault")).toBe(true);
    const vaultHit = hits.find((h) => h.type === "vault")!;
    expect(vaultHit.score).toBeGreaterThan(0);
    expect(vaultHit.source.docTitle).toBe("Brand Voice Doc");
  });

  it("ranks vault hits (with score) above non-scored hits when query supplied", async () => {
    const hits = await queryCompanyMemory({
      companyId: "co-1",
      query: "sparkling",
    });
    expect(hits[0].type).toBe("vault");
  });

  it("restricts to requested types", async () => {
    const hits = await queryCompanyMemory({
      companyId: "co-1",
      types: ["lesson"],
    });
    expect(hits.every((h) => h.type === "lesson")).toBe(true);
    expect(db.getMemoryByAgentIds).not.toHaveBeenCalled();
    expect(db.getActivityFeed).not.toHaveBeenCalled();
  });

  it("filters memory + lessons + activity by query substring (case-insensitive)", async () => {
    const hits = await queryCompanyMemory({
      companyId: "co-1",
      query: "ICP",
    });
    // Only the "icp" memory entry should match for the memory source
    const memoryHits = hits.filter((h) => h.type === "memory");
    expect(memoryHits).toHaveLength(1);
    expect(memoryHits[0].title).toContain("Sales");
    expect(memoryHits[0].body).toContain("FinTech");
  });

  it("respects the overall limit", async () => {
    const hits = await queryCompanyMemory({
      companyId: "co-1",
      limit: 2,
    });
    expect(hits.length).toBeLessThanOrEqual(2);
  });

  it("returns empty array when company has no agents", async () => {
    (db.getAgentsByCompany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    (db.getAgentsByCompany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    (db.getActivityFeed as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    const hits = await queryCompanyMemory({ companyId: "co-empty" });
    expect(hits).toEqual([]);
  });

  it("tolerates a source failure without aborting the merge", async () => {
    (db.getAgentsByCompany as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("memory source down")
    );
    // Second call (for lessons) still succeeds; third (for activity) succeeds.
    (db.getAgentsByCompany as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockAgents);
    const hits = await queryCompanyMemory({ companyId: "co-1" });
    // No memory hits since first call failed; lessons and activity still appear
    expect(hits.some((h) => h.type === "lesson")).toBe(true);
    expect(hits.some((h) => h.type === "activity")).toBe(true);
  });
});

describe("summarizeCompanyMemory", () => {
  it("returns counts across all four sources", async () => {
    const summary = await summarizeCompanyMemory("co-1");
    // 2 + 1 entries across agents
    expect(summary.memoryEntries).toBe(3);
    // Only a-sales had lessons (1); a-legal had none
    expect(summary.lessons).toBe(1);
    // vault count requires DB, mocked to null → stays 0
    expect(summary.vaultDocs).toBe(0);
    expect(summary.recentActivity).toBe(1);
  });
});
