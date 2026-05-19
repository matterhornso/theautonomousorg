/**
 * POST /api/shopify/insights
 *
 * No body required. Returns category-aware competitor insights + a
 * prioritised list of actionable suggestions for the merchant's catalog.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  isShopifyConfigured,
  loadShopifyConfigForCompany,
} from "@/lib/shopify";
import { generateInsights } from "@/lib/shopify-insights";
import { resolveTenant } from "@/app/admin/_lib/resolve-tenant";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tenant = await resolveTenant();
  const shopifyConfig = await loadShopifyConfigForCompany(tenant.firm.id);
  if (!shopifyConfig && !isShopifyConfigured()) {
    return NextResponse.json(
      {
        error:
          "Shopify is not configured for this workspace. Add credentials via POST /api/user-keys with serviceName='shopify_credentials' or set the SHOPIFY_* env vars.",
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
    const result = await generateInsights({
      shopifyConfig: shopifyConfig ?? undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
