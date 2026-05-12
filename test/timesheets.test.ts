/**
 * Unit tests for timesheet domain logic.
 *
 * The DB-touching helpers are exercised against a stubbed `sql` tag — we
 * mock `@/lib/db-postgres` so no Postgres connection is opened. The pure
 * helpers (period key) are tested directly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  isoWeekKey,
  currentPeriodKey,
} from "@/lib/timesheets";

describe("isoWeekKey", () => {
  it("formats as YYYY-Www with zero-padded week", () => {
    // 2026-01-05 is a Monday, ISO week 2 of 2026.
    expect(isoWeekKey(new Date("2026-01-05T12:00:00Z"))).toBe("2026-W02");
    // 2026-12-28 (Monday) is week 53 of 2026 in ISO terms.
    expect(isoWeekKey(new Date("2026-12-28T12:00:00Z"))).toBe("2026-W53");
  });

  it("rolls early-Jan dates back into the previous ISO year", () => {
    // 2027-01-01 is a Friday; ISO week 53 of 2026.
    expect(isoWeekKey(new Date("2027-01-01T12:00:00Z"))).toBe("2026-W53");
  });

  it("rolls late-Dec dates into the next ISO year", () => {
    // 2024-12-30 is a Monday → ISO week 1 of 2025.
    expect(isoWeekKey(new Date("2024-12-30T12:00:00Z"))).toBe("2025-W01");
  });

  it("currentPeriodKey returns isoWeekKey of now by default", () => {
    const expected = isoWeekKey(new Date());
    expect(currentPeriodKey()).toBe(expected);
  });
});

// ─── DB-backed helpers ────────────────────────────────────────────────

interface SqlRecorder {
  calls: Array<{ template: TemplateStringsArray; values: unknown[] }>;
  responses: unknown[][];
}

function makeSqlMock(responses: unknown[][] = []): {
  sql: (template: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>;
  recorder: SqlRecorder;
} {
  const recorder: SqlRecorder = { calls: [], responses };
  let i = 0;
  const sql = (template: TemplateStringsArray, ...values: unknown[]) => {
    recorder.calls.push({ template, values });
    return Promise.resolve(responses[i++] ?? []);
  };
  return { sql, recorder };
}

describe("findEmployeeByTelegramChatId", () => {
  const original = { ...process.env };
  beforeEach(() => {
    vi.resetModules();
    process.env.DATABASE_URL = "postgres://test";
  });
  afterEach(() => {
    process.env = { ...original };
    vi.restoreAllMocks();
  });

  it("returns null when DATABASE_URL is unset", async () => {
    delete process.env.DATABASE_URL;
    const { findEmployeeByTelegramChatId } = await import("@/lib/timesheets");
    const r = await findEmployeeByTelegramChatId(123);
    expect(r).toBeNull();
  });

  it("returns mapped Employee when row exists", async () => {
    const { sql } = makeSqlMock([
      [
        {
          id: "emp_1",
          company_id: "co_1",
          name: "Riya",
          email: "riya@firm.com",
          telegram_handle: "@riya",
          telegram_chat_id: "987654321",
          timezone: "Asia/Kolkata",
          active: true,
          created_at: new Date("2026-05-01"),
        },
      ],
    ]);
    vi.doMock("@/lib/db-postgres", () => ({ sql }));
    const { findEmployeeByTelegramChatId } = await import("@/lib/timesheets");
    const r = await findEmployeeByTelegramChatId(987654321);
    expect(r?.name).toBe("Riya");
    expect(r?.telegramChatId).toBe(987654321);
  });

  it("returns null when no row matches", async () => {
    const { sql } = makeSqlMock([[]]);
    vi.doMock("@/lib/db-postgres", () => ({ sql }));
    const { findEmployeeByTelegramChatId } = await import("@/lib/timesheets");
    const r = await findEmployeeByTelegramChatId(0);
    expect(r).toBeNull();
  });
});

describe("markSubmitted + getActiveSubmissionForEmployee", () => {
  const original = { ...process.env };
  beforeEach(() => {
    vi.resetModules();
    process.env.DATABASE_URL = "postgres://test";
  });
  afterEach(() => {
    process.env = { ...original };
    vi.restoreAllMocks();
  });

  it("getActiveSubmissionForEmployee returns mapped row", async () => {
    const { sql } = makeSqlMock([
      [
        {
          id: "sub_1",
          company_id: "co_1",
          employee_id: "emp_1",
          period_key: "2026-W19",
          submitted_at: null,
          source: null,
          notes: null,
          reminders_sent: 0,
          last_reminder_at: null,
          created_at: new Date(),
        },
      ],
    ]);
    vi.doMock("@/lib/db-postgres", () => ({ sql }));
    const { getActiveSubmissionForEmployee } = await import("@/lib/timesheets");
    const r = await getActiveSubmissionForEmployee("emp_1", "2026-W19");
    expect(r?.id).toBe("sub_1");
    expect(r?.submittedAt).toBeNull();
  });

  it("markSubmitted runs an UPDATE", async () => {
    const { sql, recorder } = makeSqlMock([[]]);
    vi.doMock("@/lib/db-postgres", () => ({ sql }));
    const { markSubmitted } = await import("@/lib/timesheets");
    await markSubmitted("sub_1", "telegram");
    expect(recorder.calls).toHaveLength(1);
    expect(recorder.calls[0]!.values).toContain("telegram");
    expect(recorder.calls[0]!.values).toContain("sub_1");
  });

  it("markSubmitted throws when DATABASE_URL is unset", async () => {
    delete process.env.DATABASE_URL;
    const { markSubmitted } = await import("@/lib/timesheets");
    await expect(markSubmitted("sub_1", "telegram")).rejects.toThrow(
      /DATABASE_URL/
    );
  });
});

describe("sendReminderForSubmission", () => {
  const original = { ...process.env };
  beforeEach(() => {
    vi.resetModules();
    process.env.DATABASE_URL = "postgres://test";
    process.env.TELEGRAM_BOT_TOKEN = "stub-token";
  });
  afterEach(() => {
    process.env = { ...original };
    vi.restoreAllMocks();
  });

  it("returns ok=false when employee has no telegram_chat_id", async () => {
    const { sendReminderForSubmission } = await import("@/lib/timesheets");
    const result = await sendReminderForSubmission({
      submission: {
        id: "sub_1",
        companyId: "co_1",
        employeeId: "emp_1",
        periodKey: "2026-W19",
        submittedAt: null,
        source: null,
        notes: null,
        remindersSent: 0,
        lastReminderAt: null,
        createdAt: new Date(),
      },
      employee: {
        id: "emp_1",
        companyId: "co_1",
        name: "Riya",
        email: "riya@firm.com",
        telegramHandle: null,
        telegramChatId: null,
        timezone: "Asia/Kolkata",
        active: true,
        createdAt: new Date(),
      },
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/has not linked Telegram/);
  });

  it("returns ok=false when bot token is missing", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    const { sendReminderForSubmission } = await import("@/lib/timesheets");
    const result = await sendReminderForSubmission({
      submission: {
        id: "sub_1",
        companyId: "co_1",
        employeeId: "emp_1",
        periodKey: "2026-W19",
        submittedAt: null,
        source: null,
        notes: null,
        remindersSent: 0,
        lastReminderAt: null,
        createdAt: new Date(),
      },
      employee: {
        id: "emp_1",
        companyId: "co_1",
        name: "Riya",
        email: "riya@firm.com",
        telegramHandle: "@riya",
        telegramChatId: 12345,
        timezone: "Asia/Kolkata",
        active: true,
        createdAt: new Date(),
      },
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not configured/);
  });

  it("sends and increments reminders_sent on success", async () => {
    const { sql, recorder } = makeSqlMock([[]]);
    vi.doMock("@/lib/db-postgres", () => ({ sql }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
        text: async () => "",
      })
    );
    const { sendReminderForSubmission } = await import("@/lib/timesheets");
    const result = await sendReminderForSubmission({
      submission: {
        id: "sub_42",
        companyId: "co_1",
        employeeId: "emp_1",
        periodKey: "2026-W19",
        submittedAt: null,
        source: null,
        notes: null,
        remindersSent: 0,
        lastReminderAt: null,
        createdAt: new Date(),
      },
      employee: {
        id: "emp_1",
        companyId: "co_1",
        name: "Riya",
        email: "riya@firm.com",
        telegramHandle: "@riya",
        telegramChatId: 99999,
        timezone: "Asia/Kolkata",
        active: true,
        createdAt: new Date(),
      },
    });
    expect(result.ok).toBe(true);
    // Should have updated reminders_sent
    expect(recorder.calls.length).toBe(1);
    expect(recorder.calls[0]!.values).toContain("sub_42");
  });
});
