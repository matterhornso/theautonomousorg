/**
 * Render public/og-image.svg → public/og-image.png at 1200×630.
 *
 * Why: SVG is rejected by Facebook, LinkedIn, and Bing Copilot as an
 * Open Graph preview image. We keep the SVG (works on Twitter/X and
 * any client that accepts SVG), but also need a PNG.
 *
 * Run with: bun run scripts/og-image-from-svg.ts
 */

import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = resolve(process.cwd(), "public/og-image.svg");
const DEST = resolve(process.cwd(), "public/og-image.png");
const WIDTH = 1200;
const HEIGHT = 630;

async function main() {
  const svgRaw = readFileSync(SRC, "utf-8");

  // Wrap in an HTML doc so Chromium renders it at the exact viewport size.
  const html = `<!doctype html>
<html><head><style>
html,body{margin:0;padding:0;background:#FAF8F2;}
svg{display:block;width:${WIDTH}px;height:${HEIGHT}px;}
</style></head>
<body>${svgRaw}</body></html>`;

  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const buf = await page.screenshot({
      type: "png",
      omitBackground: false,
      clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
    });
    writeFileSync(DEST, buf);
    console.log(
      `  ✓ Wrote ${DEST} — ${(buf.length / 1024).toFixed(1)} KB at ${WIDTH}×${HEIGHT}`
    );
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("og-image-from-svg failed:", err);
  process.exit(1);
});
