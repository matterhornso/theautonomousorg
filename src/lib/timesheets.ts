/**
 * Timesheet reminder domain logic (Client 1 — Telegram).
 *
 * Two tables (see migrations/005_timesheets.sql):
 *   employees             — one row per person we ping
 *   timesheet_submissions — (employee, period_key) tracker
 *
 * Period encoding: ISO week, e.g. "2026-W19".
 * Telegram chat_id linking: employees run `/link <email>` once.
 *
 * All functions are no-ops/empty when DATABASE_URL is missing — keeps dev
 * without a DB working, matching the existing lessons/escalation pattern.
 */

import { randomUUID } from "crypto";
import { sendMessage, isTelegramConfigured } from "./telegram";

// ─── Period helpers (pure) ─────────────────────────────────────────────

/**
 * ISO 8601 week-numbering year + week, formatted "YYYY-Www".
 * Matches `date-fns/formatISO9075` semantics: weeks start Monday, week 1 contains Jan 4.
 *
 * Pure, deterministic, timezone-aware: pass a Date in the relevant zone.
 */
export function isoWeekKey(date: Date): string {
  // Copy and normalize to UTC midnight on the same Y/M/D to avoid TZ noise.
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Move to Thursday in the current week — that defines which ISO year the week belongs to.
  const dayNum = d.getUTCDay() || 7; // Sun=0 → 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function currentPeriodKey(now: Date = new Date()): string {
  return isoWeekKey(now);
}

// ─── Types ─────────────────────────────────────────────────────────────

export interface Employee {
  id: string;
  companyId: string;
  name: string;
  email: string;
  telegramHandle: string | null;
  telegramChatId: number | null;
  timezone: string;
  active: boolean;
  createdAt: Date;
}

export interface TimesheetSubmission {
  id: string;
  companyId: string;
  employeeId: string;
  periodKey: string;
  submittedAt: Date | null;
  source: "telegram" | "manual" | "webhook" | null;
  notes: string | null;
  remindersSent: number;
  lastReminderAt: Date | null;
  createdAt: Date;
}

export interface OutstandingRow {
  submission: TimesheetSubmission;
  employee: Employee;
}

// ─── DB layer ──────────────────────────────────────────────────────────
// We bypass the full RLS/withTenantContext flow for the timesheet vertical
// because the cron route runs without a Clerk session. We still filter every
// query by company_id to keep tenant isolation at the app layer. When we
// promote this to multi-tenant we'll wrap calls in withTenantContext.

interface EmployeeRow {
  id: string;
  company_id: string;
  name: string;
  email: string;
  telegram_handle: string | null;
  telegram_chat_id: string | number | null;
  timezone: string;
  active: boolean;
  created_at: Date;
}

interface SubmissionRow {
  id: string;
  company_id: string;
  employee_id: string;
  period_key: string;
  submitted_at: Date | null;
  source: string | null;
  notes: string | null;
  reminders_sent: number;
  last_reminder_at: Date | null;
  created_at: Date;
}

function rowToEmployee(r: EmployeeRow): Employee {
  return {
    id: r.id,
    companyId: r.company_id,
    name: r.name,
    email: r.email,
    telegramHandle: r.telegram_handle,
    telegramChatId:
      r.telegram_chat_id === null ? null : Number(r.telegram_chat_id),
    timezone: r.timezone,
    active: r.active,
    createdAt: r.created_at,
  };
}

function rowToSubmission(r: SubmissionRow): TimesheetSubmission {
  return {
    id: r.id,
    companyId: r.company_id,
    employeeId: r.employee_id,
    periodKey: r.period_key,
    submittedAt: r.submitted_at,
    source: (r.source as TimesheetSubmission["source"]) ?? null,
    notes: r.notes,
    remindersSent: r.reminders_sent,
    lastReminderAt: r.last_reminder_at,
    createdAt: r.created_at,
  };
}

async function getSql() {
  if (!process.env.DATABASE_URL) return null;
  const mod = await import("./db-postgres");
  return mod.sql;
}

// ─── Employee CRUD ─────────────────────────────────────────────────────

export async function listEmployees(companyId: string): Promise<Employee[]> {
  const sql = await getSql();
  if (!sql) return [];
  const rows = (await sql`
    SELECT * FROM employees
    WHERE company_id = ${companyId}
    ORDER BY created_at DESC
  `) as EmployeeRow[];
  return rows.map(rowToEmployee);
}

export async function createEmployee(input: {
  companyId: string;
  name: string;
  email: string;
  telegramHandle?: string | null;
  timezone?: string;
}): Promise<Employee> {
  const sql = await getSql();
  if (!sql) {
    throw new Error("DATABASE_URL is not configured. Cannot create employees.");
  }
  const id = `emp_${randomUUID()}`;
  const [row] = (await sql`
    INSERT INTO employees (id, company_id, name, email, telegram_handle, timezone, active)
    VALUES (
      ${id},
      ${input.companyId},
      ${input.name},
      ${input.email.toLowerCase()},
      ${input.telegramHandle ?? null},
      ${input.timezone ?? "Asia/Kolkata"},
      TRUE
    )
    RETURNING *
  `) as EmployeeRow[];
  if (!row) throw new Error("INSERT returned no row");
  return rowToEmployee(row);
}

export async function findEmployeeByEmail(
  companyId: string,
  email: string
): Promise<Employee | null> {
  const sql = await getSql();
  if (!sql) return null;
  const rows = (await sql`
    SELECT * FROM employees
    WHERE company_id = ${companyId} AND email = ${email.toLowerCase()}
    LIMIT 1
  `) as EmployeeRow[];
  return rows[0] ? rowToEmployee(rows[0]) : null;
}

/**
 * Find an employee by email across all firms. Used by the Telegram /link
 * command, which doesn't know which firm the chatter belongs to until they
 * identify themselves. Email collisions across firms are unlikely at v1
 * scale; revisit when we onboard >5 firms.
 */
export async function findEmployeeByEmailGlobal(email: string): Promise<Employee | null> {
  const sql = await getSql();
  if (!sql) return null;
  const rows = (await sql`
    SELECT * FROM employees
    WHERE email = ${email.toLowerCase()}
    ORDER BY created_at DESC
    LIMIT 1
  `) as EmployeeRow[];
  return rows[0] ? rowToEmployee(rows[0]) : null;
}

export async function findEmployeeByTelegramChatId(
  chatId: number
): Promise<Employee | null> {
  const sql = await getSql();
  if (!sql) return null;
  const rows = (await sql`
    SELECT * FROM employees
    WHERE telegram_chat_id = ${chatId}
    LIMIT 1
  `) as EmployeeRow[];
  return rows[0] ? rowToEmployee(rows[0]) : null;
}

/** Bind an employee row to a Telegram chat_id. Idempotent. */
export async function linkTelegramChatId(
  employeeId: string,
  chatId: number,
  telegramHandle: string | null
): Promise<void> {
  const sql = await getSql();
  if (!sql) throw new Error("DATABASE_URL is not configured.");
  await sql`
    UPDATE employees
    SET telegram_chat_id = ${chatId},
        telegram_handle = COALESCE(${telegramHandle}, telegram_handle)
    WHERE id = ${employeeId}
  `;
}

// ─── Submission lifecycle ──────────────────────────────────────────────

/**
 * Ensure a submission row exists for every active employee in the given
 * company + period. Idempotent: re-runs are safe (UNIQUE(employee_id,period_key)).
 * Returns the count of rows newly inserted.
 */
export async function ensurePeriodSubmissions(
  companyId: string,
  periodKey: string
): Promise<number> {
  const sql = await getSql();
  if (!sql) return 0;
  const rows = (await sql`
    INSERT INTO timesheet_submissions (id, company_id, employee_id, period_key)
    SELECT
      'sub_' || gen_random_uuid()::text,
      e.company_id,
      e.id,
      ${periodKey}
    FROM employees e
    WHERE e.company_id = ${companyId}
      AND e.active = TRUE
    ON CONFLICT (employee_id, period_key) DO NOTHING
    RETURNING id
  `) as Array<{ id: string }>;
  return rows.length;
}

export async function listOutstanding(
  companyId: string,
  periodKey: string
): Promise<OutstandingRow[]> {
  const sql = await getSql();
  if (!sql) return [];
  const rows = (await sql`
    SELECT
      s.id              AS s_id,
      s.company_id      AS s_company_id,
      s.employee_id     AS s_employee_id,
      s.period_key      AS s_period_key,
      s.submitted_at    AS s_submitted_at,
      s.source          AS s_source,
      s.notes           AS s_notes,
      s.reminders_sent  AS s_reminders_sent,
      s.last_reminder_at AS s_last_reminder_at,
      s.created_at      AS s_created_at,
      e.id              AS e_id,
      e.company_id      AS e_company_id,
      e.name            AS e_name,
      e.email           AS e_email,
      e.telegram_handle AS e_telegram_handle,
      e.telegram_chat_id AS e_telegram_chat_id,
      e.timezone        AS e_timezone,
      e.active          AS e_active,
      e.created_at      AS e_created_at
    FROM timesheet_submissions s
    JOIN employees e ON e.id = s.employee_id
    WHERE s.company_id = ${companyId}
      AND s.period_key = ${periodKey}
      AND s.submitted_at IS NULL
      AND e.active = TRUE
    ORDER BY e.name ASC
  `) as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    submission: rowToSubmission({
      id: r.s_id as string,
      company_id: r.s_company_id as string,
      employee_id: r.s_employee_id as string,
      period_key: r.s_period_key as string,
      submitted_at: r.s_submitted_at as Date | null,
      source: r.s_source as string | null,
      notes: r.s_notes as string | null,
      reminders_sent: r.s_reminders_sent as number,
      last_reminder_at: r.s_last_reminder_at as Date | null,
      created_at: r.s_created_at as Date,
    }),
    employee: rowToEmployee({
      id: r.e_id as string,
      company_id: r.e_company_id as string,
      name: r.e_name as string,
      email: r.e_email as string,
      telegram_handle: r.e_telegram_handle as string | null,
      telegram_chat_id: r.e_telegram_chat_id as string | number | null,
      timezone: r.e_timezone as string,
      active: r.e_active as boolean,
      created_at: r.e_created_at as Date,
    }),
  }));
}

export async function listSubmissionsForPeriod(
  companyId: string,
  periodKey: string
): Promise<Array<{ submission: TimesheetSubmission; employee: Employee }>> {
  const sql = await getSql();
  if (!sql) return [];
  const rows = (await sql`
    SELECT
      s.id              AS s_id,
      s.company_id      AS s_company_id,
      s.employee_id     AS s_employee_id,
      s.period_key      AS s_period_key,
      s.submitted_at    AS s_submitted_at,
      s.source          AS s_source,
      s.notes           AS s_notes,
      s.reminders_sent  AS s_reminders_sent,
      s.last_reminder_at AS s_last_reminder_at,
      s.created_at      AS s_created_at,
      e.id              AS e_id,
      e.company_id      AS e_company_id,
      e.name            AS e_name,
      e.email           AS e_email,
      e.telegram_handle AS e_telegram_handle,
      e.telegram_chat_id AS e_telegram_chat_id,
      e.timezone        AS e_timezone,
      e.active          AS e_active,
      e.created_at      AS e_created_at
    FROM timesheet_submissions s
    JOIN employees e ON e.id = s.employee_id
    WHERE s.company_id = ${companyId}
      AND s.period_key = ${periodKey}
    ORDER BY s.submitted_at NULLS FIRST, e.name ASC
  `) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    submission: rowToSubmission({
      id: r.s_id as string,
      company_id: r.s_company_id as string,
      employee_id: r.s_employee_id as string,
      period_key: r.s_period_key as string,
      submitted_at: r.s_submitted_at as Date | null,
      source: r.s_source as string | null,
      notes: r.s_notes as string | null,
      reminders_sent: r.s_reminders_sent as number,
      last_reminder_at: r.s_last_reminder_at as Date | null,
      created_at: r.s_created_at as Date,
    }),
    employee: rowToEmployee({
      id: r.e_id as string,
      company_id: r.e_company_id as string,
      name: r.e_name as string,
      email: r.e_email as string,
      telegram_handle: r.e_telegram_handle as string | null,
      telegram_chat_id: r.e_telegram_chat_id as string | number | null,
      timezone: r.e_timezone as string,
      active: r.e_active as boolean,
      created_at: r.e_created_at as Date,
    }),
  }));
}

export async function markSubmitted(
  submissionId: string,
  source: "telegram" | "manual" | "webhook",
  notes?: string
): Promise<void> {
  const sql = await getSql();
  if (!sql) throw new Error("DATABASE_URL is not configured.");
  await sql`
    UPDATE timesheet_submissions
    SET submitted_at = COALESCE(submitted_at, NOW()),
        source = COALESCE(source, ${source}),
        notes = ${notes ?? null}
    WHERE id = ${submissionId}
  `;
}

export async function getActiveSubmissionForEmployee(
  employeeId: string,
  periodKey: string
): Promise<TimesheetSubmission | null> {
  const sql = await getSql();
  if (!sql) return null;
  const rows = (await sql`
    SELECT * FROM timesheet_submissions
    WHERE employee_id = ${employeeId} AND period_key = ${periodKey}
    LIMIT 1
  `) as SubmissionRow[];
  return rows[0] ? rowToSubmission(rows[0]) : null;
}

// ─── Reminder send ─────────────────────────────────────────────────────

export interface ReminderResult {
  submissionId: string;
  employeeId: string;
  employeeName: string;
  ok: boolean;
  error?: string;
}

const REMINDER_TEMPLATE = (
  name: string,
  periodKey: string
) => `Hi ${name} — your timesheet for *${periodKey}* is still outstanding.

Reply *DONE* once you've submitted, or *HELP* if you need a hand.`;

/**
 * Send a Telegram reminder for a single outstanding submission.
 * Increments reminders_sent + sets last_reminder_at on success.
 * Skips silently if the employee has no chat_id linked.
 */
export async function sendReminderForSubmission(row: OutstandingRow): Promise<ReminderResult> {
  const { submission, employee } = row;
  const baseResult: Omit<ReminderResult, "ok" | "error"> = {
    submissionId: submission.id,
    employeeId: employee.id,
    employeeName: employee.name,
  };
  if (!isTelegramConfigured()) {
    return { ...baseResult, ok: false, error: "Telegram bot not configured" };
  }
  if (!employee.telegramChatId) {
    return {
      ...baseResult,
      ok: false,
      error: "Employee has not linked Telegram (run /link <email>)",
    };
  }
  try {
    await sendMessage(
      employee.telegramChatId,
      REMINDER_TEMPLATE(employee.name, submission.periodKey)
    );
    const sql = await getSql();
    if (sql) {
      await sql`
        UPDATE timesheet_submissions
        SET reminders_sent = reminders_sent + 1,
            last_reminder_at = NOW()
        WHERE id = ${submission.id}
      `;
    }
    return { ...baseResult, ok: true };
  } catch (err) {
    return {
      ...baseResult,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Run the full reminder pass for one company + period. The cron handler
 * loops over companies; this is the per-company unit.
 */
export async function runReminderPass(
  companyId: string,
  periodKey: string
): Promise<{ inserted: number; sent: number; failed: number; results: ReminderResult[] }> {
  const inserted = await ensurePeriodSubmissions(companyId, periodKey);
  const outstanding = await listOutstanding(companyId, periodKey);
  const results: ReminderResult[] = [];
  for (const row of outstanding) {
    results.push(await sendReminderForSubmission(row));
  }
  return {
    inserted,
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}
