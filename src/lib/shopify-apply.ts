/**
 * Apply a previously-planned Shopify edit. Runs operations sequentially.
 * If one fails, subsequent operations still run (we report all results) —
 * the merchant sees a partial-success report rather than mystery half-state.
 */

import {
  loadShopifyConfig,
  type ShopifyConfig,
  updateProduct,
  updateVariantPrices,
} from "./shopify";
import type { Plan, PlanOperation } from "./shopify-planner";

export interface OperationResult {
  index: number;
  kind: PlanOperation["kind"];
  productTitle: string;
  ok: boolean;
  error?: string;
  details?: string;
}

export interface ApplyResult {
  results: OperationResult[];
  successCount: number;
  failureCount: number;
}

export async function applyPlan(
  plan: Plan,
  config?: ShopifyConfig
): Promise<ApplyResult> {
  const cfg = config ?? loadShopifyConfig();
  const results: OperationResult[] = [];

  for (let i = 0; i < plan.operations.length; i++) {
    const op = plan.operations[i]!;
    try {
      if (op.kind === "update_product") {
        await updateProduct(
          {
            id: op.productId,
            title: op.changes.title,
            descriptionHtml: op.changes.descriptionHtml,
            tags: op.changes.tags,
            status: op.changes.status,
            vendor: op.changes.vendor,
            productType: op.changes.productType,
          },
          cfg
        );
        results.push({
          index: i,
          kind: op.kind,
          productTitle: op.productTitle,
          ok: true,
          details: `Updated fields: ${Object.keys(op.changes).join(", ")}`,
        });
      } else if (op.kind === "update_variant_prices") {
        const variants = op.variants.map((v) => ({
          id: v.variantId,
          price: v.newPrice,
          ...(v.compareAtPrice !== undefined
            ? { compareAtPrice: v.compareAtPrice }
            : {}),
        }));
        await updateVariantPrices(op.productId, variants, cfg);
        results.push({
          index: i,
          kind: op.kind,
          productTitle: op.productTitle,
          ok: true,
          details: `Updated ${op.variants.length} variant price(s)`,
        });
      }
    } catch (err) {
      results.push({
        index: i,
        kind: op.kind,
        productTitle: op.productTitle,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    results,
    successCount: results.filter((r) => r.ok).length,
    failureCount: results.filter((r) => !r.ok).length,
  };
}
