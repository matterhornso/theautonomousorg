import { describe, it, expect, vi } from "vitest";

// No DATABASE_URL in tests → every helper must degrade gracefully.
vi.mock("@/lib/db-postgres", () => ({
  sql: null,
}));

import * as runs from "@/lib/agent-runs";

describe("agent-runs — graceful no-DB fallback", () => {
  it("createAgentRun returns null without DATABASE_URL", async () => {
    expect(
      await runs.createAgentRun({
        companyId: "co-1",
        agentRole: "Sales",
        triggeredBy: "user",
        input: { message: "hi" },
      })
    ).toBeNull();
  });

  it("completeAgentRun returns null without DATABASE_URL", async () => {
    expect(
      await runs.completeAgentRun("run_x", { status: "completed" })
    ).toBeNull();
  });

  it("getAgentRun returns null without DATABASE_URL", async () => {
    expect(await runs.getAgentRun("run_x")).toBeNull();
  });

  it("getAgentRunsByRole returns [] without DATABASE_URL", async () => {
    expect(await runs.getAgentRunsByRole("co-1", "Sales")).toEqual([]);
  });

  it("getRecentAgentRuns returns [] without DATABASE_URL", async () => {
    expect(await runs.getRecentAgentRuns("co-1")).toEqual([]);
  });

  it("getOpenAgentRuns returns [] without DATABASE_URL", async () => {
    expect(await runs.getOpenAgentRuns("co-1")).toEqual([]);
  });
});
