/**
 * POST /api/shopify/plan
 *
 * Body: { prompt: string }
 * Returns: { plan: Plan, toolCalls: [...], usage: {...} }
 *
 * Pure planning step. NO mutations. The returned plan is shown to the
 * human in /admin/shopify, who can choose to /api/shopify/apply.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { isShopifyConfigured } from "@/lib/shopify";
import { planShopifyEdit } from "@/lib/shopify-planner";

const bodySchema = z.object({
  prompt: z.string().trim().min(1).max(2000),
});

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isShopifyConfigured()) {
    return NextResponse.json(
      {
        error:
          "Shopify is not configured. Set SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_TOKEN in your environment.",
      },
      { status: 503 }
    );
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured." },
      { status: 503 }
    );
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

  try {
    const result = await planShopifyEdit(parsed.data.prompt);
    return NextResponse.json({
      plan: result.plan,
      toolCalls: result.toolCalls,
      usage: {
        modelStops: result.modelStops,
        inputTokens: result.totalInputTokens,
        outputTokens: result.totalOutputTokens,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
