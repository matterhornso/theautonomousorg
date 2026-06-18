/**
 * Cron entry point for the Telegram timesheet reminder pass.
 *
 *   GET /api/cron/timesheet-reminders
 *   Authorization: Bearer <CRON_SECRET>     ← preferred
 *   x-cron-secret: <CRON_SECRET>            ← also accepted
 *
 * The secret is header-only — query-string tokens are no longer accepted
 * because query strings leak into access logs, proxies, and browser history.
 * The secret is compared in constant time.
 *
 * Ops:
 * - Railway: set CRON_SECRET, schedule a daily/weekly cron (e.g. Fri 17:00 IST)
 *   with `curl -H "Authorization: Bearer $CRON_SECRET" "$APP_BASE_URL/api/cron/timesheet-reminders"`.
 * - Vercel: vercel.json `crons` entry; pass the token via the Authorization header.
 *
 * v1: iterates every company that has at least one active employee. The
 * accounting firm scenario has one tenant; this still loops in case a second
 * firm signs on. No per-firm timezone / day-of-week gating in v1 — the
 * cron schedule itself enforces the wall-clock policy.
 */

import { NextRequest, NextResponse } from "next/server";
import { currentPeriodKey, runReminderPass } from "@/lib/timesheets";
import { getSchedule, recordRun } from "@/lib/reminder-schedule";
import { safeEqual } from "@/lib/secure-compare";

async function listCompaniesWithEmployees(): Promise<string[]> {
  if (!process.env.DATABASE_URL) return [];
  const { sql } = await import("@/lib/db-postgres");
  if (!sql) return [];
  const rows = (await sql`
    SELECT DISTINCT company_id FROM employees WHERE active = TRUE
  `) as Array<{ company_id: string }>;
  return rows.map((r) => r.company_id);
}

function authorize(request: NextRequest): NextResponse | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      {
        error:
          "CRON_SECRET is not configured. Set it in env to enable cron endpoints.",
      },
      { status: 503 }
    );
  }
  // Header-only: never accept the secret via query string (query strings
  // leak into access logs, proxies, and browser history).
  const headerToken = (() => {
    const auth = request.headers.get("authorization");
    if (auth?.startsWith("Bearer ")) return auth.slice(7);
    return request.headers.get("x-cron-secret");
  })();
  if (!safeEqual(headerToken, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const denied = authorize(request);
  if (denied) return denied;

  const periodKey = currentPeriodKey();
  const companyIds = await listCompaniesWithEmployees();

  const summaries = [];
  for (const companyId of companyIds) {
    try {
      const schedule = await getSchedule(companyId);
      if (schedule?.paused) {
        summaries.push({
          companyId,
          periodKey,
          skipped: "schedule paused",
        });
        continue;
      }
      const result = await runReminderPass(companyId, periodKey);
      // Record this run so the UI shows last_run_at.
      await recordRun(companyId);
      summaries.push({
        companyId,
        periodKey,
        ...result,
      });
    } catch (err) {
      summaries.push({
        companyId,
        periodKey,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return NextResponse.json({
    runAt: new Date().toISOString(),
    periodKey,
    companyCount: companyIds.length,
    summaries,
  });
}

// Allow POST too — Railway crons sometimes default to POST.
export const POST = GET;
