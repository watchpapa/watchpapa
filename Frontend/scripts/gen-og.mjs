// Generates public/og-default.png (1200x630) — the default Open Graph / Twitter
// card image. Run locally (`node scripts/gen-og.mjs`); the output is committed.
// Not part of the build — do not wire this into CI.
import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "public", "og-default.png");

const html = `<!doctype html>
<html><head><meta charset="utf-8" /><style>
  @font-face {
    font-family: "sys";
    src: local("Arial");
  }
  * { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; }
  html, body { width: 1200px; height: 630px; overflow: hidden; }
  body {
    background: radial-gradient(1200px 630px at 15% 10%, #1b1f33 0%, #111320 55%, #0b0c15 100%);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    padding: 90px 100px;
    position: relative;
  }
  .grid {
    position: absolute; inset: 0;
    background-image: linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
    background-size: 48px 48px;
    mask-image: radial-gradient(900px 500px at 20% 30%, black, transparent);
  }
  .accent {
    position: absolute; right: -120px; top: -120px; width: 560px; height: 560px;
    border-radius: 9999px; background: radial-gradient(circle, rgba(124,92,255,0.35), transparent 70%);
  }
  .wordmark {
    font-size: 96px; font-weight: 800; color: #f5f5fa; letter-spacing: -0.02em; z-index: 1;
  }
  .wordmark span { color: #8b7bff; }
  .tagline {
    margin-top: 22px; font-size: 32px; font-weight: 500; color: #a9adc4; max-width: 820px; z-index: 1;
  }
  .pill {
    margin-top: 40px; display: inline-flex; gap: 14px; z-index: 1;
  }
  .pill div {
    padding: 10px 22px; border-radius: 9999px; background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12); color: #d6d8e6; font-size: 22px; font-weight: 600;
  }
</style></head>
<body>
  <div class="grid"></div>
  <div class="accent"></div>
  <div class="wordmark">watch<span>papa</span></div>
  <div class="tagline">Discover and track films, shows, and people — all in one place.</div>
  <div class="pill"><div>Movies</div><div>TV Shows</div><div>People</div></div>
</body></html>`;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
const page = await context.newPage();
await page.setContent(html);
// eslint-disable-next-line no-undef -- runs inside the browser page, not Node
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(150);
const buf = await page.screenshot({ type: "png" });
await writeFile(OUT, buf);
await browser.close();
console.log(`wrote ${OUT}`);
