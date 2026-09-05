#!/usr/bin/env node
// Screenshots of the header overlays (drawer, account sheet/popover, search
// panel, More menu, notifications) that the page-level matrix can't capture.
//
//   node scripts/overlay-shots.mjs --out shots/overlays [--base http://localhost:5173] --email x --password y

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith("--")) acc.push([a.slice(2), arr[i + 1]?.startsWith("--") || arr[i + 1] === undefined ? "true" : arr[i + 1]]);
    return acc;
  }, []),
);
const BASE = args.base ?? "http://localhost:5173";
const OUT = args.out ?? "shots/overlays";
await mkdir(OUT, { recursive: true });

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
await ctx.addInitScript(() => { document.cookie = "cookie_consent=accepted; path=/; max-age=31536000"; });
const p = await ctx.newPage();
const shot = (name) => p.screenshot({ path: `${OUT}/${name}.png` });
const esc = async () => { await p.keyboard.press("Escape"); await p.waitForTimeout(250); };

if (args.email && args.password) {
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await p.fill('input[type="email"]', args.email);
  await p.fill('input[type="password"]', args.password);
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }).catch(() => {});
} else {
  await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
}
await p.waitForTimeout(800);

// Phone
await p.click('button[aria-label="Open menu"]'); await p.waitForTimeout(400); await shot("drawer-390"); await esc();
if (args.email) { await p.click('nav[aria-label="Primary"] button[aria-label="You"]'); await p.waitForTimeout(400); await shot("you-sheet-390"); await esc(); }
await p.click('button[aria-label="Search"]'); await p.waitForTimeout(300); await shot("search-390"); await esc();

// Tablet (md) — text nav appears
await p.setViewportSize({ width: 800, height: 1280 }); await p.waitForTimeout(300); await shot("header-800");
await p.click('button:has-text("More")'); await p.waitForTimeout(300); await shot("more-800"); await esc();

// Desktop
await p.setViewportSize({ width: 1280, height: 720 }); await p.waitForTimeout(300);
if (args.email) {
  await p.click('button[aria-label="Account menu"]'); await p.waitForTimeout(400); await shot("account-popover-1280"); await esc();
  await p.click('button[aria-label="Notifications"]'); await p.waitForTimeout(600); await shot("bell-1280"); await esc();
}
await p.click('button:has-text("More")'); await p.waitForTimeout(300); await shot("more-1280"); await esc();

// Rotated phone — sheets become side panels, no tab bar
await p.setViewportSize({ width: 844, height: 390 }); await p.waitForTimeout(300); await shot("header-landscape-844");
if (args.email) { await p.click('button[aria-label="Account menu"]'); await p.waitForTimeout(400); await shot("account-landscape-844"); await esc(); }
await p.setViewportSize({ width: 667, height: 375 }); await p.waitForTimeout(300);
await p.click('button[aria-label="Open menu"]'); await p.waitForTimeout(400); await shot("drawer-landscape-667"); await esc();

console.log(`overlay shots → ${OUT}`);
await b.close();
