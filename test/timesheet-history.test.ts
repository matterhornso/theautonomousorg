import { describe, it, expect } from "vitest";
import {
  aggregateHistory,
  type Employee,
  type TimesheetSubmission,
} from "@/lib/timesheets";

function emp(id: string, name: string): Employee {
  return {
    id,
    companyId: "co_1",
    name,
    email: `${id}@x.com`,
    telegramHandle: null,
    telegramChatId: null,
    timezone: "Asia/Kolkata",
    active: true,
    createdAt: new Date("2026-01-01"),
  };
}

function sub(
  employeeId: string,
  periodKey: string,
  submitted: boolean
): TimesheetSubmission {
  return {
    id: `sub_${employeeId}_${periodKey}`,
    companyId: "co_1",
    employeeId,
    periodKey,
    submittedAt: submitted ? new Date("2026-05-09") : null,
    source: submitted ? "telegram" : null,
    notes: null,
    remindersSent: submitted ? 1 : 2,
    lastReminderAt: null,
    createdAt: new Date("2026-05-05"),
  };
}

const girish = emp("e_girish", "Girish");
const asha = emp("e_asha", "Asha");

describe("aggregateHistory", () => {
  it("returns empty for no rows", () => {
    expect(aggregateHistory([])).toEqual([]);
  });

  it("groups by period and computes compliance", () => {
    const pairs = [
      { submission: sub("e_girish", "2026-W18", true), employee: girish },
      { submission: sub("e_asha", "2026-W18", false), employee: asha },
      { submission: sub("e_girish", "2026-W19", true), employee: girish },
      { submission: sub("e_asha", "2026-W19", true), employee: asha },
    ];
    const out = aggregateHistory(pairs);
    expect(out.map((p) => p.periodKey)).toEqual(["2026-W19", "2026-W18"]); // newest first
    expect(out[0]).toMatchObject({ total: 2, submitted: 2, outstanding: 0, pct: 100 });
    expect(out[1]).toMatchObject({ total: 2, submitted: 1, outstanding: 1, pct: 50 });
  });

  it("rounds the percentage", () => {
    const pairs = [
      { submission: sub("e_girish", "2026-W20", true), employee: girish },
      { submission: sub("e_asha", "2026-W20", false), employee: asha },
      { submission: sub("e_c", "2026-W20", false), employee: emp("e_c", "Cara") },
    ];
    expect(aggregateHistory(pairs)[0].pct).toBe(33); // 1/3
  });

  it("sorts employees within a period by name", () => {
    const pairs = [
      { submission: sub("e_girish", "2026-W21", true), employee: girish },
      { submission: sub("e_asha", "2026-W21", true), employee: asha },
    ];
    expect(aggregateHistory(pairs)[0].rows.map((r) => r.employee.name)).toEqual([
      "Asha",
      "Girish",
    ]);
  });
});
