/**
 * Competitor / category insights for a Shopify merchant.
 *
 * Pulls the merchant's catalog and asks Claude (acting as an e-commerce
 * growth strategist) to:
 *   1. Read the live catalog
 *   2. Identify the category and its competitive landscape
 *   3. Diagnose the merchant's positioning gap
 *   4. Propose 5 high-impact, prioritised changes
 *
 * Each suggestion is structured so the UI can offer a one-click "Use this
 * prompt" that pre-fills the Shopify Editor's prompt box and lets the user
 * Plan + Apply the change immediately.
 *
 * No tool-use loop here — the planner already does that. This is a single
 * Claude call with structured output via JSON mode.
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  searchProducts,
  getShopInfo,
  type ShopifyConfig,
  type ShopifyProductSummary,
} from "./shopify";

export const suggestionSchema = z.object({
  title: z.string().min(1).max(240),
  category: z.enum(["positioning", "pricing", "copy", "product", "seo", "operations"]),
  priority: z.enum(["high", "medium", "low"]),
  rationale: z.string().min(1).max(1200),
  /** A one-sentence prompt the user can paste into the Editor. Null when the change is non-mutational (e.g. "rebrand your packaging"). */
  suggestedPrompt: z.union([z.string().max(800), z.null()]),
  /** Disposition of the suggestion: 'apply' = supports paste-and-apply; 'review' = needs human design/marketing work; 'external' = outside Shopify scope. */
  suggestedAction: z.enum(["apply", "review", "external"]),
});

export const insightsSchema = z.object({
  category: z.string().min(1).max(160),
  marketSummary: z.string().min(1).max(800),
  competitiveLandscape: z.string().min(1).max(1500),
  differentiationGap: z.string().min(1).max(1200),
  suggestions: z.array(suggestionSchema).min(3).max(8),
});

export type Suggestion = z.infer<typeof suggestionSchema>;
export type Insights = z.infer<typeof insightsSchema>;

export interface InsightsResult {
  insights: Insights;
  inputTokens: number;
  outputTokens: number;
  productCount: number;
  shopName: string;
}

const SYSTEM_PROMPT = `You are a senior e-commerce growth strategist embedded in a Shopify merchant's admin. The merchant has just asked for category-aware competitor insights and a punch-list of changes that will move the needle.

Your job:
1. Identify the product category (e.g. "Indian sparkling water D2C", "Vegan skincare", etc.).
2. In one paragraph, describe the competitive landscape for this category — name 3-5 real competitors when you know them, and what they do well.
3. Diagnose the merchant's *differentiation gap* — what's missing in their current positioning, copy, pricing, or assortment versus the category.
4. Propose 5 prioritised, high-impact changes. For each, decide:
   - **suggestedAction = "apply"** when the change can be made via product/variant updates the Shopify Editor agent can run (price, tags, descriptions, status). Include a concrete one-sentence \`suggestedPrompt\` we can paste straight into the Editor — phrase it as an instruction.
   - **suggestedAction = "review"** when it's a marketing/design decision the human owner should make (brand voice rewrite, new SKU strategy, A/B test plan).
   - **suggestedAction = "external"** when the change is outside Shopify (paid ads, distribution, packaging redesign, retail).
5. Mark priority \`high\` for changes that compound (positioning, pricing power, hero product copy). Use \`medium\` for tactical wins. Use \`low\` for polish.

Be specific. Reference the actual products and tags in the merchant's catalog. Avoid generic advice. If you don't know real competitor names confidently, say so rather than inventing.

Output ONLY valid JSON matching this schema. No markdown, no commentary outside the JSON.

Schema:
{
  "category": string,
  "marketSummary": string,
  "competitiveLandscape": string,
  "differentiationGap": string,
  "suggestions": [
    {
      "title": string,
      "category": "positioning"|"pricing"|"copy"|"product"|"seo"|"operations",
      "priority": "high"|"medium"|"low",
      "rationale": string,
      "suggestedPrompt": string|null,
      "suggestedAction": "apply"|"review"|"external"
    }
  ]
}`;

function buildUserPrompt(
  shopName: string,
  primaryDomain: string,
  products: ShopifyProductSummary[]
): string {
  const productLines = products
    .map((p) => {
      const variants = p.variants
        .map((v) => `${v.title}: ${v.price}${v.compareAtPrice ? ` (was ${v.compareAtPrice})` : ""}`)
        .join("; ");
      return [
        `- ${p.title} [${p.status}]`,
        `    handle: ${p.handle}`,
        `    vendor: ${p.vendor || "(none)"}`,
        `    type: ${p.productType || "(none)"}`,
        `    tags: ${p.tags.join(", ") || "(none)"}`,
        p.description ? `    description: ${p.description.slice(0, 300)}` : null,
        `    variants: ${variants}`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
  return `Merchant: ${shopName}
Storefront: ${primaryDomain}
Catalog (${products.length} product${products.length === 1 ? "" : "s"}):

${productLines}

Generate the insights JSON. Be specific about THIS merchant's catalog.`;
}

export async function generateInsights(
  options: {
    client?: Anthropic;
    shopifyConfig?: ShopifyConfig;
    model?: string;
    maxProducts?: number;
  } = {}
): Promise<InsightsResult> {
  const client = options.client ?? new Anthropic();
  const model = options.model ?? "claude-sonnet-4-6";
  const maxProducts = options.maxProducts ?? 50;

  const [shop, products] = await Promise.all([
    getShopInfo(options.shopifyConfig),
    searchProducts("", maxProducts, options.shopifyConfig),
  ]);

  const response = await client.messages.create({
    model,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildUserPrompt(shop.name, shop.primaryDomainUrl, products),
      },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  // Strip any accidental fence wrapping; planner is told JSON-only but be safe.
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch (err) {
    throw new Error(
      `Insights model did not return valid JSON: ${err instanceof Error ? err.message : String(err)}. First 200 chars: ${stripped.slice(0, 200)}`
    );
  }
  const validated = insightsSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `Insights JSON failed schema validation: ${validated.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`
    );
  }

  return {
    insights: validated.data,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    productCount: products.length,
    shopName: shop.name,
  };
}
