/**
 * POST /api/timesheets/reset-submission
 *
 * Body: { submissionId: string }
 *
 * Clears submitted_at + source on a submission row so the employee appears
 * Outstanding again. Use when a "Mark submitted" was a mistake, or when the
 * employee actually hasn't submitted yet despite the system thinking they did.
 *
 * Auth via Clerk. Tenant-scoped via company_id.
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

  const rows = (await sql`
    UPDATE timesheet_submissions
    SET submitted_at = NULL,
        source = NULL,
        notes = NULL
    WHERE id = ${parsed.data.submissionId}
      AND company_id = ${firm.id}
    RETURNING id
  `) as Array<{ id: string }>;

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Submission not found in this firm" },
      { status: 404 }
    );
  }
  return NextResponse.json({ resetSubmissionId: rows[0]!.id });
}
