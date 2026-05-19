/**
 * PATCH /api/companies/[id] — rename / edit a workspace owned by the
 * current Clerk user.
 *
 * Body: { name?, url?, industry?, stage? }
 * Returns: { company } on success.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  url: z.string().trim().min(1).max(500).optional(),
  industry: z.string().trim().max(120).optional(),
  stage: z.string().trim().max(60).optional(),
});

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
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
  // Only the owner can patch — scope by user_id.
  const rows = (await sql`
    UPDATE companies
    SET name = COALESCE(${data.name ?? null}, name),
        url = COALESCE(${data.url ?? null}, url),
        industry = COALESCE(${data.industry ?? null}, industry),
        stage = COALESCE(${data.stage ?? null}, stage)
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING *
  `) as Array<Record<string, unknown>>;
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Workspace not found or not owned by you" },
      { status: 404 }
    );
  }
  return NextResponse.json({ company: rows[0] });
}
