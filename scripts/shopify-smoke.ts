/**
 * One-shot smoke test of the Shopify integration against the configured
 * live store. Exercises:
 *   1. loadShopifyConfig() reads env
 *   2. getAccessToken() exchanges client credentials → cached token
 *   3. searchProducts() calls the GraphQL Admin API
 *
 * Read-only — no mutations.
 *
 * Usage: bun run scripts/shopify-smoke.ts
 */

import {
  loadShopifyConfig,
  getAccessToken,
  searchProducts,
} from "../src/lib/shopify";

async function main() {
  const cfg = loadShopifyConfig();
  console.log(`Store:       ${cfg.storeDomain}`);
  console.log(`API version: ${cfg.apiVersion}`);
  console.log(`Client ID:   ${cfg.clientId.slice(0, 6)}…${cfg.clientId.slice(-4)}`);
  console.log();

  console.log("Exchanging client credentials → access token…");
  const token = await getAccessToken(cfg);
  console.log(`  shpat_…${token.slice(-8)}`);
  console.log();

  console.log("Fetching first 5 products…");
  const products = await searchProducts("", 5, cfg);
  console.log(`  ${products.length} products returned.`);
  for (const p of products) {
    console.log(`    - ${p.title} (${p.status}, ${p.variants.length} variant${p.variants.length === 1 ? "" : "s"})`);
  }
}

main().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
