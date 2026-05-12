/**
 * POST /api/timesheets/run-pass
 *
 * Manually triggers a reminder pass for the active firm + current period.
 * Useful while testing — admins can click "Send reminders now" instead of
 * waiting for cron. Auth via Clerk (gated by proxy.ts /api/timesheets/*).
 */

import { NextResponse } from "next/server";
import { resolveTenant } from "@/app/admin/_lib/resolve-tenant";
import { currentPeriodKey, runReminderPass } from "@/lib/timesheets";
import { recordRun } from "@/lib/reminder-schedule";

export async function POST() {
  const { firm } = await resolveTenant();
  const periodKey = currentPeriodKey();
  const result = await runReminderPass(firm.id, periodKey);
  // Even manual runs update last_run_at so the schedule card stays accurate.
  await recordRun(firm.id);
  return NextResponse.json({ periodKey, ...result });
}
