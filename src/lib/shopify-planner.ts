/**
 * Shopify edit planner — turns a natural-language prompt into a structured
 * plan of mutations. The plan is reviewed by a human before any mutation
 * actually runs (see /admin/shopify and /api/shopify/apply).
 *
 * Flow:
 *   1. Caller provides a user prompt ("raise prices on all hoodies by 10%").
 *   2. Planner runs a Claude tool-use loop. Tools are READ-ONLY at this stage.
 *   3. Once Claude has enough context, it emits a `submit_plan` final tool
 *      call with a list of structured operations.
 *   4. We validate the plan against a Zod schema and return it.
 *   5. The /apply route executes each operation against the Shopify Admin
 *      API in the order Claude proposed.
 *
 * No mutations happen here. Apply is a separate, deliberate, human-gated step.
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  searchProducts,
  type ShopifyConfig,
  type ShopifyProductSummary,
} from "./shopify";

// ─── Plan schema (mirror to API) ─────────────────────────────────────────

export const updateProductOpSchema = z.object({
  kind: z.literal("update_product"),
  productId: z.string().regex(/^gid:\/\/shopify\/Product\/\d+$/),
  productTitle: z.string(),
  changes: z
    .object({
      title: z.string().optional(),
      descriptionHtml: z.string().optional(),
      tags: z.array(z.string()).optional(),
      status: z.enum(["ACTIVE", "ARCHIVED", "DRAFT"]).optional(),
      vendor: z.string().optional(),
      productType: z.string().optional(),
    })
    .refine(
      (c) => Object.keys(c).length > 0,
      "At least one field must change"
    ),
  rationale: z.string().min(1),
});

export const updateVariantPricesOpSchema = z.object({
  kind: z.literal("update_variant_prices"),
  productId: z.string().regex(/^gid:\/\/shopify\/Product\/\d+$/),
  productTitle: z.string(),
  variants: z
    .array(
      z.object({
        variantId: z.string().regex(/^gid:\/\/shopify\/ProductVariant\/\d+$/),
        variantTitle: z.string(),
        currentPrice: z.string(),
        newPrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
        compareAtPrice: z
          .union([z.string().regex(/^\d+(\.\d{1,2})?$/), z.null()])
          .optional(),
      })
    )
    .min(1),
  rationale: z.string().min(1),
});

export const planOperationSchema = z.discriminatedUnion("kind", [
  updateProductOpSchema,
  updateVariantPricesOpSchema,
]);

export const planSchema = z.object({
  summary: z.string().min(1),
  operations: z.array(planOperationSchema),
  warnings: z.array(z.string()).default([]),
});

export type PlanOperation = z.infer<typeof planOperationSchema>;
export type Plan = z.infer<typeof planSchema>;

// ─── Tools exposed to Claude during planning ─────────────────────────────

const PLANNER_TOOLS: Anthropic.Tool[] = [
  {
    name: "search_products",
    description:
      "Search the merchant's product catalog using Shopify's query syntax. " +
      "Examples: `tag:hoodie`, `vendor:Nike status:active`, `title:*tee*`, `product_type:Apparel`. " +
      "Returns up to `first` products with their variants, current prices, tags, and status. " +
      "USE THIS to discover what products exist and their current state before proposing edits.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Shopify product query syntax. Empty string returns the most recent products.",
        },
        first: {
          type: "integer",
          description: "Max products to return (1-50). Default 25.",
          default: 25,
          minimum: 1,
          maximum: 50,
        },
      },
      required: ["query"],
    },
  },
  {
    name: "submit_plan",
    description:
      "Submit the final structured plan once you have enough information. " +
      "ONLY call this once, as your last action. Each operation MUST reference a real productId you saw " +
      "via search_products. Never invent product IDs. Always include a clear rationale per operation.",
    input_schema: {
      type: "object" as const,
      properties: {
        summary: {
          type: "string",
          description:
            "One-sentence human-readable summary of what this plan does. Shown at the top of the review UI.",
        },
        operations: {
          type: "array",
          description:
            "Ordered list of operations to apply. Apply runs them sequentially.",
          items: {
            oneOf: [
              {
                type: "object",
                properties: {
                  kind: { const: "update_product" },
                  productId: { type: "string" },
                  productTitle: { type: "string" },
                  changes: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      descriptionHtml: { type: "string" },
                      tags: { type: "array", items: { type: "string" } },
                      status: { enum: ["ACTIVE", "ARCHIVED", "DRAFT"] },
                      vendor: { type: "string" },
                      productType: { type: "string" },
                    },
                  },
                  rationale: { type: "string" },
                },
                required: [
                  "kind",
                  "productId",
                  "productTitle",
                  "changes",
                  "rationale",
                ],
              },
              {
                type: "object",
                properties: {
                  kind: { const: "update_variant_prices" },
                  productId: { type: "string" },
                  productTitle: { type: "string" },
                  variants: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        variantId: { type: "string" },
                        variantTitle: { type: "string" },
                        currentPrice: { type: "string" },
                        newPrice: { type: "string" },
                        compareAtPrice: { type: ["string", "null"] },
                      },
                      required: [
                        "variantId",
                        "variantTitle",
                        "currentPrice",
                        "newPrice",
                      ],
                    },
                  },
                  rationale: { type: "string" },
                },
                required: [
                  "kind",
                  "productId",
                  "productTitle",
                  "variants",
                  "rationale",
                ],
              },
            ],
          },
        },
        warnings: {
          type: "array",
          description:
            "Anything the human reviewer should double-check (large price jumps, status flips, etc.).",
          items: { type: "string" },
        },
      },
      required: ["summary", "operations"],
    },
  },
];

const PLANNER_SYSTEM_PROMPT = `You are the Shopify Editor for getsoma.store. The merchant gives you a natural-language instruction. Your job is to:

1. Use \`search_products\` to discover the relevant products and their current state.
2. Plan the smallest set of changes that fulfils the instruction safely.
3. Call \`submit_plan\` exactly once with a structured operation list.

Rules:
- NEVER invent product IDs, variant IDs, or current prices. Only use values you saw in tool results.
- For price changes, always include both \`currentPrice\` and \`newPrice\` so the human reviewer can spot mistakes.
- If the instruction is ambiguous (e.g. "raise prices" with no amount), make a reasonable assumption and put your interpretation in \`warnings\`.
- If the instruction would touch >25 products, add a warning so the human can confirm bulk scope.
- If you can't fulfil the instruction (e.g. it asks for a tool you don't have, or no matching products exist), still call \`submit_plan\` with an empty operations list and explain in \`warnings\`.
- Keep \`rationale\` to one short sentence per operation.
- Use Shopify GID format throughout: \`gid://shopify/Product/12345\`, \`gid://shopify/ProductVariant/12345\`.`;

// ─── Tool dispatch ───────────────────────────────────────────────────────

interface PlannerToolDispatcher {
  search_products: (input: {
    query: string;
    first?: number;
  }) => Promise<ShopifyProductSummary[]>;
}

function buildDispatcher(config?: ShopifyConfig): PlannerToolDispatcher {
  return {
    search_products: ({ query, first }) =>
      searchProducts(query, first ?? 25, config),
  };
}

// ─── Public entry point ──────────────────────────────────────────────────

export interface PlannerResult {
  plan: Plan;
  toolCalls: Array<{
    name: string;
    input: unknown;
    summary: string;
  }>;
  modelStops: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

export interface PlannerOptions {
  client?: Anthropic;
  shopifyConfig?: ShopifyConfig;
  model?: string;
  maxIterations?: number;
}

export async function planShopifyEdit(
  prompt: string,
  options: PlannerOptions = {}
): Promise<PlannerResult> {
  const client = options.client ?? new Anthropic();
  const dispatcher = buildDispatcher(options.shopifyConfig);
  const model = options.model ?? "claude-sonnet-4-6";
  const maxIterations = options.maxIterations ?? 8;

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: prompt },
  ];

  const toolCalls: PlannerResult["toolCalls"] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let modelStops = 0;

  for (let i = 0; i < maxIterations; i++) {
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system: PLANNER_SYSTEM_PROMPT,
      tools: PLANNER_TOOLS,
      messages,
    });
    modelStops += 1;
    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

    // Look for a submit_plan tool call → terminal.
    const submitBlock = response.content.find(
      (b): b is Anthropic.ToolUseBlock =>
        b.type === "tool_use" && b.name === "submit_plan"
    );
    if (submitBlock) {
      const parsed = planSchema.safeParse(submitBlock.input);
      if (!parsed.success) {
        throw new Error(
          `Planner returned an invalid plan: ${parsed.error.issues
            .map((iss) => `${iss.path.join(".")}: ${iss.message}`)
            .join("; ")}`
        );
      }
      return {
        plan: parsed.data,
        toolCalls,
        modelStops,
        totalInputTokens,
        totalOutputTokens,
      };
    }

    // Otherwise dispatch any read-only tools and loop.
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );
    if (toolUseBlocks.length === 0) {
      // Model produced text without a tool call — coax it back to the contract.
      messages.push({ role: "assistant", content: response.content });
      messages.push({
        role: "user",
        content:
          "Please continue. If you have enough information, call `submit_plan` now. If you need more product data, call `search_products`.",
      });
      continue;
    }

    messages.push({ role: "assistant", content: response.content });
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      if (block.name !== "search_products") {
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: `Unknown tool: ${block.name}. Available tools: search_products, submit_plan.`,
          is_error: true,
        });
        continue;
      }
      try {
        const input = block.input as { query: string; first?: number };
        const products = await dispatcher.search_products(input);
        toolCalls.push({
          name: block.name,
          input,
          summary: `Found ${products.length} products for query "${input.query}".`,
        });
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(products, null, 2),
        });
      } catch (err) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: `Tool error: ${err instanceof Error ? err.message : String(err)}`,
          is_error: true,
        });
      }
    }
    messages.push({ role: "user", content: toolResults });
  }

  throw new Error(
    `Shopify planner did not converge after ${maxIterations} iterations. ` +
      `The instruction may be too broad — try narrowing it.`
  );
}
