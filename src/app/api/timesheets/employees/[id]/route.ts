/**
 * DELETE /api/timesheets/employees/[id] — remove an employee from the roster.
 *
 * Cascade: deleting the row also wipes their timesheet_submissions (per the
 * ON DELETE CASCADE foreign key in migration 005). They stop receiving
 * reminders immediately.
 *
 * Auth via Clerk. Tenant-scoped: only employees belonging to the active firm
 * can be deleted, regardless of whose id is passed.
 */

import { NextResponse } from "next/server";
import { resolveTenant } from "@/app/admin/_lib/resolve-tenant";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const { firm } = await resolveTenant();
  const { id } = await ctx.params;

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
    DELETE FROM employees
    WHERE id = ${id} AND company_id = ${firm.id}
    RETURNING id, name, email
  `) as Array<{ id: string; name: string; email: string }>;

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Employee not found in this firm" },
      { status: 404 }
    );
  }
  return NextResponse.json({ deleted: rows[0] });
}
