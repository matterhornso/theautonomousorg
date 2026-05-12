/**
 * Live test of the insights flow against the merchant's catalog. Bypasses
 * Clerk by calling generateInsights() directly.
 *
 * Usage: bun run scripts/shopify-insights-test.ts
 */

import { generateInsights } from "../src/lib/shopify-insights";

const t0 = Date.now();
const result = await generateInsights();
const dt = Date.now() - t0;

console.log(`\n──── Generated in ${dt}ms · ${result.inputTokens} in / ${result.outputTokens} out tokens ────\n`);
console.log(`Shop:       ${result.shopName} (${result.productCount} products)`);
console.log(`Category:   ${result.insights.category}`);
console.log();
console.log("Market summary:");
console.log("  " + result.insights.marketSummary);
console.log();
console.log("Competitive landscape:");
console.log("  " + result.insights.competitiveLandscape);
console.log();
console.log("Differentiation gap:");
console.log("  " + result.insights.differentiationGap);
console.log();
console.log("Suggestions:");
result.insights.suggestions.forEach((s, i) => {
  console.log(`\n  ${i + 1}. [${s.priority.toUpperCase()}] [${s.category}] ${s.title}`);
  console.log(`     Action: ${s.suggestedAction}`);
  console.log(`     Why: ${s.rationale}`);
  if (s.suggestedPrompt) {
    console.log(`     Prompt: "${s.suggestedPrompt}"`);
  }
});
console.log();
process.exit(0);
