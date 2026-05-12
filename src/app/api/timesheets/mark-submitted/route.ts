/**
 * POST /api/timesheets/mark-submitted
 *
 * Body: { submissionId: string }
 *
 * Manually flip a submission row to submitted. Used as a fallback when the
 * Telegram webhook isn't wired up (local demo without ngrok), and as a way
 * for an admin to override missed/manual submissions.
 *
 * Auth via Clerk (proxy.ts gates /api/timesheets/*). Tenant is implicitly
 * checked: we only update rows whose company_id matches the active firm.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveTenant } from "@/app/admin/_lib/resolve-tenant";

const bodySchema = z.object({
  submissionId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const { firm } = await resolveTenant();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "DATABASE_URL is not configured" },
      { status: 503 }
    );
  }
  const { sql } = await import("@/lib/db-postgres");
  if (!sql) {
    return NextResponse.json(
      { error: "DB connection unavailable" },
      { status: 503 }
    );
  }

  // Scope by company_id so admins can't mutate other firms' rows even with
  // a forged submissionId.
  const rows = (await sql`
    UPDATE timesheet_submissions
    SET submitted_at = COALESCE(submitted_at, NOW()),
        source = COALESCE(source, 'manual')
    WHERE id = ${parsed.data.submissionId}
      AND company_id = ${firm.id}
    RETURNING id, submitted_at, source
  `) as Array<{ id: string; submitted_at: Date; source: string }>;

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Submission not found in this firm" },
      { status: 404 }
    );
  }
  return NextResponse.json({ submission: rows[0] });
}
