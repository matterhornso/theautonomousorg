/**
 * Quickly print the current tags on a Shopify product, for verifying that
 * a Plan + Apply round-trip actually mutated the live store.
 *
 * Usage:
 *   bun run scripts/shopify-tags.ts                      # default: Soma Sparkling Water
 *   bun run scripts/shopify-tags.ts "Some Other Title"   # any product title
 */

import { searchProducts } from "../src/lib/shopify";

const title = process.argv[2] ?? "Soma Sparkling Water";

const products = await searchProducts(`title:${title}`, 5);
if (products.length === 0) {
  console.error(`No products found for title:"${title}"`);
  process.exit(1);
}

for (const p of products) {
  console.log(`\n${p.title}  [${p.status}]`);
  console.log(`  handle:   ${p.handle}`);
  console.log(`  vendor:   ${p.vendor || "(none)"}`);
  console.log(`  type:     ${p.productType || "(none)"}`);
  console.log(`  tags:     [${p.tags.join(", ") || "(none)"}]`);
  console.log(`  variants: ${p.variants.length}`);
  for (const v of p.variants) {
    console.log(`    - ${v.title}: ${v.price}${v.compareAtPrice ? ` (was ${v.compareAtPrice})` : ""}`);
  }
}
process.exit(0);
