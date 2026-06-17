/**
 * Human-friendly cron helpers for the schedule editor's visual builder.
 *
 * We only model the subset of cron the timesheet reminder scheduler actually
 * uses: a single fire time (minute + hour) on a day-of-week selection, every
 * day-of-month, every month — i.e. `M H * * DOW`. Anything outside that shape
 * (ranges/steps on minute/hour, specific day-of-month, etc.) is treated as an
 * advanced expression the builder can't represent, and callers fall back to the
 * raw cron text input.
 *
 * Day-of-week is standard cron: 0 = Sunday … 6 = Saturday (7 is normalised to
 * 0 on parse).
 */

export type CronFrequency = "daily" | "weekdays" | "weekends" | "custom";

export interface CronParts {
  /** 0–59 */
  minute: number;
  /** 0–23 */
  hour: number;
  frequency: CronFrequency;
  /** Selected days of week, 0 (Sun)–6 (Sat), sorted. */
  days: number[];
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKENDS = [0, 6];

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function sortedUnique(days: number[]): number[] {
  return [...new Set(days)].sort((a, b) => a - b);
}

function sameSet(a: number[], b: number[]): boolean {
  const sa = sortedUnique(a);
  const sb = sortedUnique(b);
  return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
}

function dowField(frequency: CronFrequency, days: number[]): string {
  switch (frequency) {
    case "daily":
      return "*";
    case "weekdays":
      return "1-5";
    case "weekends":
      return "0,6";
    case "custom": {
      const uniq = sortedUnique(days);
      if (uniq.length === 0 || uniq.length === 7) return "*";
      return uniq.join(",");
    }
  }
}

/** Build a 5-field cron expression from structured parts. */
export function buildCron(parts: CronParts): string {
  const minute = clamp(parts.minute, 0, 59);
  const hour = clamp(parts.hour, 0, 23);
  return `${minute} ${hour} * * ${dowField(parts.frequency, parts.days)}`;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Math.trunc(n)));
}

function toInt(token: string): number | null {
  return /^\d+$/.test(token) ? Number(token) : null;
}

/** Parse a comma list of single day-of-week integers (e.g. "1,3,5"). */
function parseDowList(token: string): number[] | null {
  const out: number[] = [];
  for (const raw of token.split(",")) {
    const n = toInt(raw);
    if (n === null || n < 0 || n > 7) return null;
    out.push(n === 7 ? 0 : n);
  }
  return out.length ? out : null;
}

/**
 * Parse a cron expression into builder parts, or null if it falls outside the
 * shape the builder can represent (caller should then use the raw text input).
 */
export function parseCron(cron: string): CronParts | null {
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) return null;
  const [min, hr, dom, mon, dow] = fields;
  if (dom !== "*" || mon !== "*") return null;

  const minute = toInt(min);
  const hour = toInt(hr);
  if (minute === null || minute < 0 || minute > 59) return null;
  if (hour === null || hour < 0 || hour > 23) return null;

  if (dow === "*") {
    return { minute, hour, frequency: "daily", days: [...ALL_DAYS] };
  }
  if (dow === "1-5") {
    return { minute, hour, frequency: "weekdays", days: [...WEEKDAYS] };
  }

  const days = parseDowList(dow);
  if (!days) return null;
  const set = sortedUnique(days);
  if (set.length === 7) {
    return { minute, hour, frequency: "daily", days: [...ALL_DAYS] };
  }
  if (sameSet(set, WEEKENDS)) {
    return { minute, hour, frequency: "weekends", days: [...WEEKENDS] };
  }
  if (sameSet(set, WEEKDAYS)) {
    return { minute, hour, frequency: "weekdays", days: [...WEEKDAYS] };
  }
  return { minute, hour, frequency: "custom", days: set };
}

/** Format 24h time as e.g. "5:00 PM". */
export function formatTime(hour: number, minute: number): string {
  const h = clamp(hour, 0, 23);
  const m = clamp(minute, 0, 59);
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function daysLabel(days: number[]): string {
  return sortedUnique(days)
    .map((d) => DAY_LABELS[d])
    .join(", ");
}

/**
 * Human summary of a cron expression, e.g. "Weekdays at 5:00 PM".
 * Falls back to the raw expression for shapes the builder can't model.
 */
export function humanizeCron(cron: string): string {
  const p = parseCron(cron);
  if (!p) return cron;
  const time = formatTime(p.hour, p.minute);
  switch (p.frequency) {
    case "daily":
      return `Every day at ${time}`;
    case "weekdays":
      return `Weekdays at ${time}`;
    case "weekends":
      return `Weekends at ${time}`;
    case "custom":
      return `${daysLabel(p.days)} at ${time}`;
  }
}
