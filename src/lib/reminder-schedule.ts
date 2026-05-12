/**
 * Reminder schedule domain logic.
 *
 * Stores one row per company in `reminder_schedules`. The cron endpoint
 * checks the row before firing — only sends if the schedule says it's time
 * AND the schedule isn't paused.
 *
 * v1 cadence parsing is intentionally minimal: we only support the cron
 * expression "M H * * *" (daily at H:M) and "M H * * <DOW>" (weekly).
 * Anything more exotic is treated as "always allow" — the Railway/Vercel
 * cron schedule itself is the source of truth for the wall-clock fire time.
 */

import { Cron } from "croner";

export interface ReminderSchedule {
  companyId: string;
  cron: string;
  timezone: string;
  paused: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Row {
  company_id: string;
  cron: string;
  timezone: string;
  paused: boolean;
  last_run_at: Date | null;
  next_run_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function rowToSchedule(r: Row): ReminderSchedule {
  return {
    companyId: r.company_id,
    cron: r.cron,
    timezone: r.timezone,
    paused: r.paused,
    lastRunAt: r.last_run_at,
    nextRunAt: r.next_run_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function getSql() {
  if (!process.env.DATABASE_URL) return null;
  const mod = await import("./db-postgres");
  return mod.sql;
}

const DEFAULT_CRON = "0 17 * * *";
const DEFAULT_TZ = "Asia/Kolkata";

export async function getSchedule(companyId: string): Promise<ReminderSchedule | null> {
  const sql = await getSql();
  if (!sql) return null;
  const rows = (await sql`
    SELECT * FROM reminder_schedules WHERE company_id = ${companyId} LIMIT 1
  `) as Row[];
  return rows[0] ? rowToSchedule(rows[0]) : null;
}

/** Returns the schedule, or creates a default one if missing. */
export async function getOrCreateSchedule(companyId: string): Promise<ReminderSchedule> {
  const existing = await getSchedule(companyId);
  if (existing) return existing;
  const sql = await getSql();
  if (!sql) {
    // Synthetic default for dev without DB — won't actually persist or fire.
    const now = new Date();
    return {
      companyId,
      cron: DEFAULT_CRON,
      timezone: DEFAULT_TZ,
      paused: false,
      lastRunAt: null,
      nextRunAt: computeNextRun(DEFAULT_CRON, DEFAULT_TZ, now),
      createdAt: now,
      updatedAt: now,
    };
  }
  const next = computeNextRun(DEFAULT_CRON, DEFAULT_TZ, new Date());
  const rows = (await sql`
    INSERT INTO reminder_schedules (company_id, cron, timezone, paused, next_run_at)
    VALUES (${companyId}, ${DEFAULT_CRON}, ${DEFAULT_TZ}, FALSE, ${next})
    ON CONFLICT (company_id) DO NOTHING
    RETURNING *
  `) as Row[];
  if (rows[0]) return rowToSchedule(rows[0]);
  // Lost the conflict race — re-read.
  const r = await getSchedule(companyId);
  if (!r) throw new Error("schedule disappeared after insert");
  return r;
}

export async function updateSchedule(
  companyId: string,
  patch: { cron?: string; timezone?: string; paused?: boolean }
): Promise<ReminderSchedule> {
  const sql = await getSql();
  if (!sql) throw new Error("DATABASE_URL is not configured.");
  const existing = await getOrCreateSchedule(companyId);
  const cron = patch.cron ?? existing.cron;
  const timezone = patch.timezone ?? existing.timezone;
  const paused = patch.paused ?? existing.paused;
  const nextRun = computeNextRun(cron, timezone, new Date());
  const rows = (await sql`
    UPDATE reminder_schedules
    SET cron = ${cron},
        timezone = ${timezone},
        paused = ${paused},
        next_run_at = ${nextRun},
        updated_at = NOW()
    WHERE company_id = ${companyId}
    RETURNING *
  `) as Row[];
  if (!rows[0]) throw new Error("schedule not found");
  return rowToSchedule(rows[0]);
}

export async function recordRun(companyId: string, at: Date = new Date()): Promise<void> {
  const sql = await getSql();
  if (!sql) return;
  const existing = await getSchedule(companyId);
  if (!existing) return;
  const next = computeNextRun(existing.cron, existing.timezone, at);
  await sql`
    UPDATE reminder_schedules
    SET last_run_at = ${at},
        next_run_at = ${next},
        updated_at = NOW()
    WHERE company_id = ${companyId}
  `;
}

/**
 * Compute the next fire timestamp from a cron expression in the given
 * timezone. Returns null if the cron string is invalid (treated as "no
 * scheduled fire" — the manual run-pass button still works).
 */
export function computeNextRun(cron: string, timezone: string, from: Date): Date | null {
  try {
    const job = new Cron(cron, { timezone, paused: true });
    const next = job.nextRun(from);
    return next ?? null;
  } catch {
    return null;
  }
}

/**
 * Human-readable summary of a cron expression. v1 covers the common cases:
 *   "0 17 * * *"      → "Daily at 5:00 PM"
 *   "0 17 * * 1-5"    → "Weekdays at 5:00 PM"
 *   "0 17 * * 1"      → "Mondays at 5:00 PM"
 * Falls back to the raw cron string for anything more exotic.
 */
export function describeCron(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;
  const [m, h, dom, mon, dow] = parts;
  if (dom !== "*" || mon !== "*") return cron;
  const time = formatTime(Number(h), Number(m));
  if (!time) return cron;
  if (dow === "*") return `Daily at ${time}`;
  if (dow === "1-5" || dow === "MON-FRI") return `Weekdays at ${time}`;
  if (dow === "0,6" || dow === "6,0") return `Weekends at ${time}`;
  const days: Record<string, string> = {
    "0": "Sundays",
    "1": "Mondays",
    "2": "Tuesdays",
    "3": "Wednesdays",
    "4": "Thursdays",
    "5": "Fridays",
    "6": "Saturdays",
  };
  if (days[dow]) return `${days[dow]} at ${time}`;
  return cron;
}

function formatTime(hour: number, minute: number): string | null {
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const mm = String(minute).padStart(2, "0");
  return `${h12}:${mm} ${ampm}`;
}
