/**
 * GET  /api/timesheets/employees           — list employees in active firm
 * POST /api/timesheets/employees           — create employee
 *
 * Both require a Clerk session (proxy.ts gates /api/timesheets).
 * company_id is resolved from the active tenant; the client never sets it.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createEmployee,
  listEmployees,
} from "@/lib/timesheets";
import { resolveTenant } from "@/app/admin/_lib/resolve-tenant";

export async function GET() {
  const { firm } = await resolveTenant();
  const employees = await listEmployees(firm.id);
  return NextResponse.json({ employees });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email(),
  telegramHandle: z.string().trim().min(2).max(64).nullable().optional(),
  timezone: z.string().min(1).max(64).optional(),
});

export async function POST(request: NextRequest) {
  const { firm } = await resolveTenant();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  try {
    const employee = await createEmployee({
      companyId: firm.id,
      name: parsed.data.name,
      email: parsed.data.email,
      telegramHandle: parsed.data.telegramHandle ?? null,
      timezone: parsed.data.timezone,
    });
    return NextResponse.json({ employee }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("duplicate key")) {
      return NextResponse.json(
        { error: "An employee with this email already exists." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
