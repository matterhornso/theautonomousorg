/**
 * POST /api/shopify/apply
 *
 * Body: { plan: Plan }   // exactly the plan returned by /api/shopify/plan
 * Returns: { results: OperationResult[], successCount, failureCount }
 *
 * Applies the plan against Shopify. Operations run sequentially.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isShopifyConfigured } from "@/lib/shopify";
import { applyPlan } from "@/lib/shopify-apply";
import { planSchema } from "@/lib/shopify-planner";
import { z } from "zod";

const bodySchema = z.object({
  plan: planSchema,
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid plan", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  if (parsed.data.plan.operations.length === 0) {
    return NextResponse.json(
      { error: "Plan has no operations to apply." },
      { status: 400 }
    );
  }

  try {
    const result = await applyPlan(parsed.data.plan);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
