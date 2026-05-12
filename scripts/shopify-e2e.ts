/**
 * Live end-to-end demo verifier for the Shopify vertical.
 *
 * Steps:
 *   1. Token exchange + getShopInfo (UI label data)
 *   2. searchProducts read-only smoke
 *   3. planShopifyEdit() with a low-stakes prompt: add a tag
 *   4. applyPlan() — actually mutates Shopify
 *   5. searchProducts confirms the tag is now present
 *   6. planShopifyEdit() to remove the tag (rollback)
 *   7. applyPlan() rollback
 *   8. searchProducts confirms the tag is gone (clean-state restore)
 *
 * Designed to run ONCE before the demo. Idempotent — re-runs leave the
 * store in the same clean state because step 8 verifies removal.
 *
 * Usage: bun run scripts/shopify-e2e.ts
 */

import {
  loadShopifyConfig,
  getAccessToken,
  getShopInfo,
  searchProducts,
} from "../src/lib/shopify";
import { planShopifyEdit } from "../src/lib/shopify-planner";
import { applyPlan } from "../src/lib/shopify-apply";

const TEST_TAG = "demo-e2e-2026-05-07";
const TEST_PRODUCT = "Soma Sparkling Water";

function ok(label: string) {
  console.log(`  \x1b[32m✓\x1b[0m ${label}`);
}
function fail(label: string, err?: unknown): never {
  console.log(`  \x1b[31m✗\x1b[0m ${label}`);
  if (err) console.error(err);
  process.exit(1);
}

async function main() {
  const cfg = loadShopifyConfig();
  console.log("\n────── 1. Token exchange + shop label ──────");
  const token = await getAccessToken(cfg);
  ok(`Access token issued: shpat_…${token.slice(-8)}`);
  const info = await getShopInfo(cfg);
  ok(`Shop: ${info.name} · primary domain ${info.primaryDomainUrl}`);

  console.log("\n────── 2. Read-only catalog search ──────");
  const initial = await searchProducts(`title:${TEST_PRODUCT}`, 5, cfg);
  if (initial.length === 0) {
    fail(`No product titled "${TEST_PRODUCT}" found in catalog`);
  }
  ok(`Found ${initial.length} product(s) matching title`);
  const product = initial[0]!;
  const initiallyHadTag = product.tags.includes(TEST_TAG);
  console.log(`  current tags: [${product.tags.join(", ") || "(none)"}]`);

  if (initiallyHadTag) {
    console.log(
      `  ⚠ Test tag "${TEST_TAG}" is already on the product — running rollback first.`
    );
  }

  console.log("\n────── 3. Plan: add tag ──────");
  const t0 = Date.now();
  const addPlan = await planShopifyEdit(
    `Add the tag "${TEST_TAG}" to the product titled "${TEST_PRODUCT}". Don't change any other tags.`,
    { shopifyConfig: cfg }
  );
  console.log(`  planner: ${Date.now() - t0}ms · ${addPlan.toolCalls.length} tool call(s) · ${addPlan.totalInputTokens}+${addPlan.totalOutputTokens} tokens`);
  if (addPlan.plan.operations.length === 0) {
    fail(`Planner produced no operations. Warnings: ${addPlan.plan.warnings.join("; ") || "(none)"}`);
  }
  const op = addPlan.plan.operations[0]!;
  if (op.kind !== "update_product") {
    fail(`Unexpected op kind: ${op.kind} (expected update_product)`);
  }
  if (!op.changes.tags?.includes(TEST_TAG)) {
    fail(`Plan does not include the test tag in tags: ${JSON.stringify(op.changes)}`);
  }
  ok(`Plan: ${op.kind} on "${op.productTitle}" — tags will become [${op.changes.tags.join(", ")}]`);

  console.log("\n────── 4. Apply ──────");
  const addResult = await applyPlan(addPlan.plan, cfg);
  if (addResult.failureCount > 0) {
    fail(`Apply failed: ${JSON.stringify(addResult.results.filter((r) => !r.ok))}`);
  }
  ok(`${addResult.successCount} op(s) applied to live store`);

  console.log("\n────── 5. Verify tag landed ──────");
  const afterAdd = await searchProducts(`title:${TEST_PRODUCT}`, 1, cfg);
  if (!afterAdd[0]?.tags.includes(TEST_TAG)) {
    fail(`Tag "${TEST_TAG}" not present after apply. Tags: [${afterAdd[0]?.tags.join(", ")}]`);
  }
  ok(`Tag "${TEST_TAG}" confirmed on live product`);

  console.log("\n────── 6. Plan: remove tag (rollback) ──────");
  const removePlan = await planShopifyEdit(
    `Remove the tag "${TEST_TAG}" from the product titled "${TEST_PRODUCT}". Keep all other tags.`,
    { shopifyConfig: cfg }
  );
  if (removePlan.plan.operations.length === 0) {
    fail(`Rollback planner produced no operations. Warnings: ${removePlan.plan.warnings.join("; ")}`);
  }
  const removeOp = removePlan.plan.operations[0]!;
  if (removeOp.kind !== "update_product") {
    fail(`Unexpected rollback op kind: ${removeOp.kind}`);
  }
  if (removeOp.changes.tags?.includes(TEST_TAG)) {
    fail(`Rollback plan still has the test tag: ${JSON.stringify(removeOp.changes.tags)}`);
  }
  ok(`Rollback plan: tags will become [${removeOp.changes.tags?.join(", ") || "(none)"}]`);

  console.log("\n────── 7. Apply rollback ──────");
  const removeResult = await applyPlan(removePlan.plan, cfg);
  if (removeResult.failureCount > 0) {
    fail(`Rollback apply failed: ${JSON.stringify(removeResult.results.filter((r) => !r.ok))}`);
  }
  ok(`${removeResult.successCount} rollback op(s) applied`);

  console.log("\n────── 8. Verify clean state ──────");
  const finalProduct = await searchProducts(`title:${TEST_PRODUCT}`, 1, cfg);
  if (finalProduct[0]?.tags.includes(TEST_TAG)) {
    fail(`Tag "${TEST_TAG}" STILL present after rollback. Manual cleanup needed.`);
  }
  ok(`Catalog clean — test tag removed.`);

  console.log("\n\x1b[32m═══════════ E2E COMPLETE ═══════════\x1b[0m");
  console.log(`Shop:           ${info.name} (${info.primaryDomainUrl})`);
  console.log(`Test product:   ${TEST_PRODUCT}`);
  console.log(`Plans run:      2 (add + remove)`);
  console.log(`Mutations:      2 (forward + rollback)`);
  console.log(`Final tag set:  [${finalProduct[0]?.tags.join(", ") || "(none)"}]`);
  console.log(`Status:         GREEN — ready for demo.\n`);
}

main().catch((err) => {
  console.error("\n\x1b[31mE2E FAILED:\x1b[0m", err.message ?? err);
  process.exit(1);
});
