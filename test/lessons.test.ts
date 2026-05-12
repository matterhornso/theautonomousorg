/**
 * Unit tests for src/lib/lessons.ts. Mocks the postgres client.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const { sqlMock } = vi.hoisted(() => {
  const sql = vi.fn();
  return { sqlMock: sql };
});

vi.mock("@/lib/db-postgres", () => ({
  sql: sqlMock,
}));

import { buildLessonsHelper } from "@/lib/lessons";

describe("buildLessonsHelper", () => {
  beforeEach(() => {
    sqlMock.mockReset();
  });

  it("readRecent returns rows mapped to LessonRecord shape", async () => {
    const helper = buildLessonsHelper({ firmId: "firm_a", agentId: "finance_a4_bank_recon" });
    const now = new Date("2026-05-01T10:00:00Z");
    sqlMock.mockResolvedValueOnce([
      {
        id: "lesson_1",
        agent_id: "finance_a4_bank_recon",
        run_id: "run_1",
        task_description: "Reconcile bank vs ledger for 2026-05-01",
        output_accepted: "approved",
        modification_detail: null,
        self_critique: "Matched=12, exceptions=0",
        created_at: now,
      },
      {
        id: "lesson_2",
        agent_id: "finance_a4_bank_recon",
        run_id: "run_2",
        task_description: "Reconcile bank vs ledger for 2026-04-30",
        output_accepted: "modified",
        modification_detail: "User adjusted vendor name match",
        self_critique: null,
        created_at: now,
      },
    ]);

    const lessons = await helper.readRecent();
    expect(lessons).toHaveLength(2);
    expect(lessons[0]).toEqual({
      agentId: "finance_a4_bank_recon",
      runId: "run_1",
      taskDescription: "Reconcile bank vs ledger for 2026-05-01",
      outputAccepted: "approved",
      modificationDetail: undefined,
      selfCritique: "Matched=12, exceptions=0",
      createdAt: now,
    });
    expect(lessons[1].outputAccepted).toBe("modified");
    expect(lessons[1].modificationDetail).toBe("User adjusted vendor name match");
  });

  it("readRecent uses default limit=5 when not specified", async () => {
    const helper = buildLessonsHelper({ firmId: "firm_a", agentId: "agent_x" });
    sqlMock.mockResolvedValueOnce([]);
    await helper.readRecent();
    // Verify the LIMIT placeholder was 5 by inspecting interpolated values.
    const lastCall = sqlMock.mock.calls[0];
    expect(lastCall).toBeDefined();
    const values = lastCall.slice(1) as unknown[];
    expect(values).toContain(5);
  });

  it("readRecent respects custom limit", async () => {
    const helper = buildLessonsHelper({ firmId: "firm_a", agentId: "agent_x" });
    sqlMock.mockResolvedValueOnce([]);
    await helper.readRecent({ limit: 20 });
    const values = sqlMock.mock.calls[0].slice(1) as unknown[];
    expect(values).toContain(20);
  });

  it("readRecent filters by firmId + agentId", async () => {
    const helper = buildLessonsHelper({ firmId: "firm_xyz", agentId: "agent_q" });
    sqlMock.mockResolvedValueOnce([]);
    await helper.readRecent();
    const values = sqlMock.mock.calls[0].slice(1) as unknown[];
    expect(values).toContain("firm_xyz");
    expect(values).toContain("agent_q");
  });

  it("write inserts a row with the provided fields and a generated id", async () => {
    const helper = buildLessonsHelper({ firmId: "firm_a", agentId: "agent_x" });
    sqlMock.mockResolvedValueOnce([]);
    await helper.write({
      agentId: "agent_x",
      runId: "run_42",
      taskDescription: "Do the thing",
      outputAccepted: "approved",
      selfCritique: "All good",
    });
    expect(sqlMock).toHaveBeenCalledTimes(1);
    const values = sqlMock.mock.calls[0].slice(1) as unknown[];
    // Generated id is a string starting with "lesson_".
    const idArg = values.find(
      (v) => typeof v === "string" && (v as string).startsWith("lesson_")
    );
    expect(idArg).toBeDefined();
    expect(values).toContain("firm_a");
    expect(values).toContain("agent_x");
    expect(values).toContain("run_42");
    expect(values).toContain("Do the thing");
    expect(values).toContain("approved");
    expect(values).toContain("All good");
  });

  it("write maps undefined modificationDetail and selfCritique to null", async () => {
    const helper = buildLessonsHelper({ firmId: "firm_a", agentId: "agent_x" });
    sqlMock.mockResolvedValueOnce([]);
    await helper.write({
      agentId: "agent_x",
      runId: "run_x",
      taskDescription: "task",
      outputAccepted: "unknown",
    });
    const values = sqlMock.mock.calls[0].slice(1) as unknown[];
    // Both optional fields go in as null. Count nulls in the last 4 args:
    const nulls = values.filter((v) => v === null).length;
    expect(nulls).toBeGreaterThanOrEqual(2);
  });

  it("rejects bogus outputAccepted via TypeScript types — runtime accepts the four valid values", async () => {
    const helper = buildLessonsHelper({ firmId: "f", agentId: "a" });
    sqlMock.mockResolvedValue([]);
    for (const status of ["approved", "rejected", "modified", "unknown"] as const) {
      await helper.write({
        agentId: "a",
        runId: "r",
        taskDescription: "t",
        outputAccepted: status,
      });
    }
    expect(sqlMock).toHaveBeenCalledTimes(4);
  });
});
