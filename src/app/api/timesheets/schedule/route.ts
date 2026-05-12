/**
 * GET  /api/timesheets/schedule  — fetch the active firm's reminder schedule
 * PUT  /api/timesheets/schedule  — update cron / timezone / paused state
 *
 * Both Clerk-gated. Tenant-scoped via resolveTenant.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveTenant } from "@/app/admin/_lib/resolve-tenant";
import {
  getOrCreateSchedule,
  updateSchedule,
  describeCron,
} from "@/lib/reminder-schedule";

export async function GET() {
  const { firm } = await resolveTenant();
  const schedule = await getOrCreateSchedule(firm.id);
  return NextResponse.json({
    schedule,
    description: describeCron(schedule.cron),
  });
}

const putSchema = z.object({
  cron: z
    .string()
    .trim()
    .regex(
      /^(\S+\s+){4}\S+$/,
      "cron must have exactly 5 space-separated fields"
    )
    .optional(),
  timezone: z.string().min(1).max(64).optional(),
  paused: z.boolean().optional(),
});

export async function PUT(request: NextRequest) {
  const { firm } = await resolveTenant();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  try {
    const updated = await updateSchedule(firm.id, parsed.data);
    return NextResponse.json({
      schedule: updated,
      description: describeCron(updated.cron),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
