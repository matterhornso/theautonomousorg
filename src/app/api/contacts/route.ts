/**
 * GET  /api/contacts   — list contacts in the active firm
 * POST /api/contacts   — create a single contact
 *
 * Both require a Clerk session (proxy.ts gates /api/contacts).
 * company_id is resolved from the active tenant; the client never sets it.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listContacts, createContact } from "@/lib/contacts";
import { resolveTenant } from "@/app/admin/_lib/resolve-tenant";

export async function GET() {
  const { firm } = await resolveTenant();
  const contacts = await listContacts(firm.id);
  return NextResponse.json({ contacts });
}

const createSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.string().email().nullable().optional(),
    phone: z.string().trim().min(3).max(40).nullable().optional(),
  })
  .refine((d) => Boolean(d.email) || Boolean(d.phone), {
    message: "A contact needs an email or a phone number.",
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
    const contact = await createContact({
      companyId: firm.id,
      name: parsed.data.name,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
    });
    return NextResponse.json({ contact }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("duplicate key")) {
      return NextResponse.json(
        { error: "A contact with this email already exists." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
