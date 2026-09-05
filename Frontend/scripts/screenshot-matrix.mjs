#!/usr/bin/env node
// Responsive screenshot matrix for the redesign.
//
//   node scripts/screenshot-matrix.mjs [--base http://localhost:5173] [--out shots]
//        [--paths /,/movies] [--devices phone,tablet,desktop,landscape,zoom]
//        [--email x --password y]   (signs in first via the /login form)
//
// Emits <out>/<path-slug>/<WxH[-zoom]>.png plus a report.json listing any page
// whose document is wider than its viewport (horizontal overflow).

import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith("--")) acc.push([a.slice(2), arr[i + 1]?.startsWith("--") || arr[i + 1] === undefined ? "true" : arr[i + 1]]);
    return acc;
  }, []),
);

const BASE = args.base ?? "http://localhost:5173";
const OUT = args.out ?? "shots";
const ONLY = args.devices ? args.devices.split(",") : null;

const DEVICES = {
  phone: [
    [320, 568, "floor"], [344, 882, "fold-cover"], [360, 640, "small-android"], [375, 667, "iphone-se"],
    [375, 812, "iphone-x"], [390, 844, "iphone-12-pro"], [393, 852, "iphone-15"], [402, 874, "iphone-17"],
    [412, 915, "s25-ultra"], [430, 932, "iphone-15-pro-max"], [440, 956, "iphone-17-pro-max"],
  ],
  tablet: [
    [744, 1133, "ipad-mini"], [770, 900, "fold-inner"], [800, 1280, "galaxy-tab"], [820, 1180, "ipad-10"],
    [834, 1194, "ipad-pro-11"], [912, 1368, "surface-pro"], [1024, 1366, "ipad-pro-13"],
  ],
  landscape: [
    [667, 375, "iphone-se-land"], [844, 390, "iphone-12-land"], [956, 440, "iphone-17-max-land"],
    [1133, 744, "ipad-mini-land"], [1180, 820, "ipad-land"], [1366, 1024, "ipad-pro-land"],
  ],
  desktop: [
    [1280, 720, "hd"], [1366, 768, "laptop-hd"], [1440, 900, "macbook"], [1536, 864, "win-125"],
    [1680, 1050, "laptop-l"], [1920, 1080, "fhd"], [2560, 1440, "qhd"], [3440, 1440, "ultrawide"], [3840, 1600, "superwide"],
  ],
  zoom: [
    [390, 844, "iphone-12-zoom150", 1.5], [1366, 768, "laptop-zoom150", 1.5],
  ],
};

const DEFAULT_PATHS = [
  "/", "/movies", "/shows", "/people", "/search?q=matrix", "/collections", "/my-services",
  "/movies/603", "/shows/1396", "/people/6384", "/calendar", "/subscription", "/about", "/help",
  "/login", "/register", "/forgot-password", "/verify-email?email=test%40example.com",
  "/settings", "/watchlists", "/follows", "/profile/edit", "/feed", "/users", "/notifications", "/import", "/admin", "/admin/audit-log",
];
const PATHS = args.paths ? args.paths.split(",") : DEFAULT_PATHS;

const slug = (p) => p.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "home";

const browser = await chromium.launch();
const context = await browser.newContext({ colorScheme: "dark", reducedMotion: "reduce" });
const page = await context.newPage();

// Pre-accept the cookie banner so it doesn't cover every screenshot.
await context.addInitScript(() => {
  try { localStorage.setItem("wp_cookie_consent", "accepted"); } catch { /* ignore */ }
});

if (args.email && args.password) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', args.email);
  await page.fill('input[type="password"]', args.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }).catch(() => {});
}

const report = [];
for (const [group, list] of Object.entries(DEVICES)) {
  if (ONLY && !ONLY.includes(group)) continue;
  for (const [w, h, name, zoom = 1] of list) {
    await page.setViewportSize({ width: w, height: h });
    for (const p of PATHS) {
      const dir = path.join(OUT, slug(p));
      await mkdir(dir, { recursive: true });
      try {
        await page.goto(`${BASE}${p}`, { waitUntil: "networkidle", timeout: 30000 });
      } catch {
        await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded" }).catch(() => {});
      }
      if (zoom !== 1) await page.evaluate((z) => { document.documentElement.style.zoom = String(z); }, zoom);
      await page.waitForTimeout(600);
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        url: location.pathname,
      }));
      const file = path.join(dir, `${w}x${h}-${name}${zoom !== 1 ? `-zoom${zoom}` : ""}.png`);
      await page.screenshot({ path: file, fullPage: true });
      const bad = overflow.scrollWidth > overflow.clientWidth + 1;
      report.push({ path: p, landed: overflow.url, device: name, width: w, height: h, zoom, overflow: bad, file });
      if (bad) console.log(`OVERFLOW ${p} @ ${w}x${h} (${name}): ${overflow.scrollWidth} > ${overflow.clientWidth}`);
    }
  }
}

await writeFile(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
const bad = report.filter((r) => r.overflow);
console.log(`\n${report.length} screenshots, ${bad.length} with horizontal overflow → ${OUT}/report.json`);
await browser.close();
