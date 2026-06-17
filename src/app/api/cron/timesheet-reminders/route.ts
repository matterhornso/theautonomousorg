/**
 * Cron entry point for the Telegram timesheet reminder pass.
 *
 *   GET /api/cron/timesheet-reminders
 *   Authorization: Bearer <CRON_SECRET>     ← preferred
 *
 * A `?token=<CRON_SECRET>` query param is also accepted for runners that can't
 * set headers, but prefer the Bearer header: query strings leak into access
 * logs, proxies, and browser history. The secret is compared in constant time.
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
import { timingSafeEqual } from "crypto";
import { currentPeriodKey, runReminderPass } from "@/lib/timesheets";
import { getSchedule, recordRun } from "@/lib/reminder-schedule";

/** Constant-time string compare to avoid leaking the secret via timing. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

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
  const headerToken = (() => {
    const auth = request.headers.get("authorization");
    if (auth?.startsWith("Bearer ")) return auth.slice(7);
    return null;
  })();
  const queryToken = request.nextUrl.searchParams.get("token");
  const token = headerToken ?? queryToken;
  if (!token || !safeEqual(token, expected)) {
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
