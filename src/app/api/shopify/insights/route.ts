/**
 * POST /api/shopify/insights
 *
 * No body required. Returns category-aware competitor insights + a
 * prioritised list of actionable suggestions for the merchant's catalog.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isShopifyConfigured } from "@/lib/shopify";
import { generateInsights } from "@/lib/shopify-insights";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isShopifyConfigured()) {
    return NextResponse.json(
      {
        error:
          "Shopify is not configured. Set SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID, and SHOPIFY_CLIENT_SECRET.",
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

  try {
    const result = await generateInsights();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
