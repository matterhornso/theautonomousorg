/**
 * POST /api/companies — create a workspace company for the current Clerk user.
 *
 * Called by onboarding's final step. Without this, /admin's resolveTenant()
 * sees zero companies and bounces the user back to /onboarding (infinite loop).
 *
 * Body: { name, url, industry?, description?, stage? }
 * Returns: { company } on success.
 *
 * Idempotent: if the user already has a company with the same (user_id, name),
 * we return the existing row instead of inserting a duplicate.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { randomUUID } from "crypto";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(160),
  url: z.string().trim().min(1).max(500),
  industry: z.string().trim().max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  stage: z.string().trim().max(60).optional(),
});

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

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

  const data = parsed.data;
  // Normalise URL: prepend https:// if missing.
  const url = /^https?:\/\//i.test(data.url) ? data.url : `https://${data.url}`;

  // Idempotency: same user + same name → return existing row.
  const existing = (await sql`
    SELECT * FROM companies
    WHERE user_id = ${userId} AND lower(name) = lower(${data.name})
    ORDER BY created_at DESC
    LIMIT 1
  `) as Array<Record<string, unknown>>;
  if (existing.length > 0) {
    return NextResponse.json({ company: existing[0], reused: true });
  }

  const id = `co_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const rows = (await sql`
    INSERT INTO companies (
      id, user_id, name, url, industry, description, stage, provisioning_state
    )
    VALUES (
      ${id},
      ${userId},
      ${data.name},
      ${url},
      ${data.industry ?? null},
      ${data.description ?? null},
      ${data.stage ?? null},
      'ready'
    )
    RETURNING *
  `) as Array<Record<string, unknown>>;
  return NextResponse.json({ company: rows[0] }, { status: 201 });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ companies: [] });
  }
  const { sql } = await import("@/lib/db-postgres");
  if (!sql) return NextResponse.json({ companies: [] });
  const rows = (await sql`
    SELECT id, name, url, industry, stage, provisioning_state, created_at
    FROM companies
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `) as Array<Record<string, unknown>>;
  return NextResponse.json({ companies: rows });
}
