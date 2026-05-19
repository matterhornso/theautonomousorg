/**
 * POST /api/vault/reembed
 *
 * Body: { mode?: 'missing' | 'all' }  // default 'missing'
 *
 * Re-runs the embedding provider over vault_chunks for the active tenant.
 * Mode 'missing' is the safe default — only chunks with NULL embedding
 * (typically ingested before COHERE_API_KEY was set). Mode 'all' re-embeds
 * every chunk; use when switching embedding model.
 *
 * Returns the ReembedSummary from src/lib/vault.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { resolveTenant } from "@/app/admin/_lib/resolve-tenant";
import { reembedAllForCompany } from "@/lib/vault";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await resolveTenant();

  let mode: "missing" | "all" = "missing";
  try {
    const body = (await request.json().catch(() => ({}))) as { mode?: string };
    if (body.mode === "all") mode = "all";
  } catch {
    /* default to 'missing' */
  }

  try {
    const summary = await reembedAllForCompany(tenant.firm.id, { mode });
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
