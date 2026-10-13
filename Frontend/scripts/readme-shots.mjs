#!/usr/bin/env node
// Regenerates the screenshots used in the root README.
//
//   cd Frontend
//   VITE_API_BASE_URL=https://api.watchpapa.tv npx vite --port 5173 &     # dev server against the live API
//   node scripts/readme-shots.mjs [--base http://localhost:5173] [--out ../Documentation/images/readme] [--only home,calendar]
//
// Two kinds of shot:
//   * public  — real pages, signed out, live TMDB data through the production Worker (read-only).
//   * demo    — signed-in screens. NOTHING is written to or read from the real database: every
//               Supabase request is intercepted and answered with a fixture profile / follow list
//               (real TMDB ids), while content (titles, posters, episode air dates) still comes
//               live from the Worker. They show a demo account, not a real user.
//
// The dev server must run on localhost:5173 or :4173 (the Worker's CORS allow-list). Output is WebP
// via sharp (a devDependency), which keeps the README light.

import { chromium } from "playwright";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith("--")) acc.push([a.slice(2), arr[i + 1]?.startsWith("--") || arr[i + 1] === undefined ? "true" : arr[i + 1]]);
    return acc;
  }, []),
);
const BASE = args.base ?? "http://localhost:5173";
const OUT = path.resolve(args.out ?? "../Documentation/images/readme");
const ONLY = args.only ? new Set(args.only.split(",")) : null;

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

// Supabase project the dev server points at (from Frontend/.env) — only used to build the
// session storage key and to intercept requests. No request ever reaches it.
const SUPABASE_REF = args.ref ?? "slflrvbmlrpwbndzhsjp";
const SUPABASE_HOST = `https://${SUPABASE_REF}.supabase.co`;
const UID = "00000000-0000-4000-8000-00000000d3a0";

// Real TMDB ids for the demo account.
const FOLLOWED_SHOWS = [1413, 247718, 4614, 95480, 456, 1416]; // AHS, MobLand, NCIS, Slow Horses, The Simpsons, Grey's
const FOLLOWED_MOVIES = [1400940, 1153576, 1255833, 1234139, 1381071]; // Clayface, Street Fighter, Whalefall, Jailer 2, Godzilla Minus Zero

// Demo ratings: [media_type, tmdb_id, value 1-10]
const RATINGS = [
  ["movie", 335984, 10], ["movie", 603, 10], ["show", 1396, 10], ["movie", 238, 9], ["movie", 496243, 9], ["show", 95396, 9],
  ["movie", 438631, 9], ["movie", 78, 9], ["show", 66732, 8], ["movie", 27205, 8], ["movie", 155, 9], ["show", 94997, 8],
  ["movie", 120, 8], ["movie", 680, 8], ["show", 1399, 7], ["movie", 157336, 9], ["movie", 129, 8], ["show", 100088, 8],
  ["movie", 329865, 7], ["movie", 872585, 8], ["movie", 693134, 8], ["show", 76479, 7], ["movie", 545611, 7], ["movie", 354912, 8],
];
const FAVOURITES = [[1, "movie", 335984], [2, "show", 1396], [3, "movie", 238], [4, "movie", 496243], [5, "show", 95396]];
const WATCHLIST_ITEMS = [
  ["movie", 1234139], ["show", 94997], ["movie", 1400940], ["show", 119051], ["movie", 872585], ["show", 84773],
  ["movie", 438631], ["movie", 1153576], ["show", 76479], ["movie", 693134],
];

const demoProfile = {
  id: UID, username: "demo", created_at: "2026-02-14T10:00:00Z", role: 0, is_adult: true, is_private: false, bio: "Slow-burn sci-fi, crime dramas and anything with a great soundtrack.",
  avatar_type: "default", avatar_poster_media_type: null, avatar_poster_tmdb_id: null, avatar_poster_path: null, avatar_upload_path: null,
  referral_code: "DEMO1234", date_of_birth: "1990-01-01", setting_display_adult_content: false, setting_show_adult_tab: false,
  setting_blur_nsfw_posters: true, setting_language: "en-US", setting_title_mode: "translated", setting_region: "US",
  setting_watch_regions: ["US"], setting_watch_providers: [], setting_home_row_order: [], setting_home_hidden_rows: [],
  setting_bottom_tab_middle: "search", setting_allow_profile_share: false, email_marketing_opt_in: false, deleted_at: null,
  banner_favourite_position: null, banner_crop: null,
};

const day = 864e5;
const REST = {
  profile_favourite: FAVOURITES.map(([position, media_type, tmdb_id]) => ({ position, media_type, tmdb_id })),
  user_rating: RATINGS.map(([media_type, tmdb_id, value], i) => ({
    id: 1000 - i, profile_id: UID, media_type, tmdb_id, value, created_at: new Date(Date.now() - (i * 2 + 1) * day).toISOString(),
    updated_at: new Date(Date.now() - (i * 2 + 1) * day).toISOString(), tmdb_show_id: null, season_number: null, episode_number: null,
  })),
  watchlist: [
    { id: 1, name: "Up next", created_at: new Date(Date.now() - 30 * day).toISOString(), updated_at: new Date().toISOString() },
    { id: 2, name: "Weekend movies", created_at: new Date(Date.now() - 20 * day).toISOString(), updated_at: new Date().toISOString() },
  ],
  watchlist_item: WATCHLIST_ITEMS.map(([media_type, tmdb_id], i) => ({ id: i + 1, watchlist_id: 1, media_type, tmdb_id, watched: false, added_at: new Date(Date.now() - i * day).toISOString() })),
  profile: demoProfile,
  user_followed_shows: FOLLOWED_SHOWS.map((tmdb_id, i) => ({ tmdb_id, created_at: new Date(Date.now() - i * 864e5).toISOString() })),
  user_followed_movies: FOLLOWED_MOVIES.map((tmdb_id, i) => ({ tmdb_id, created_at: new Date(Date.now() - i * 864e5).toISOString() })),
  user_subscriptions: { tier: "pro", expires_at: null, is_early_adopter: false },
};
const RPC = {
  get_effective_tier: "pro",
  get_unread_notification_count: 0,
  get_observe_counts: { observers: 18, observing: 12 },
  can_view_ratings: true,
  get_notifications: [],
  get_limit_status: { show_count: FOLLOWED_SHOWS.length, movie_count: FOLLOWED_MOVIES.length, show_limit: 100, movie_limit: 100, watchlist_count: 0, watchlist_limit: 10 },
};

async function mockSupabase(context) {
  await context.route(`${SUPABASE_HOST}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const cors = {
      "access-control-allow-origin": req.headers().origin ?? "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "*",
      "access-control-expose-headers": "content-range",
    };
    const json = (status, body, extra = {}) =>
      route.fulfill({ status, contentType: "application/json", headers: { ...cors, ...extra }, body: JSON.stringify(body) });
    if (req.method() === "OPTIONS") return json(204, {});
    const user = { id: UID, aud: "authenticated", role: "authenticated", email: "demo@example.com", app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
    if (url.pathname.endsWith("/auth/v1/user")) return json(200, user);
    if (url.pathname.includes("/auth/v1/token")) return json(200, { access_token: "demo.access.token", refresh_token: "demo", token_type: "bearer", expires_in: 3600, user });
    if (url.pathname.includes("/auth/v1/")) return json(200, {});
    if (url.pathname.includes("/rest/v1/rpc/")) {
      const name = url.pathname.split("/").pop();
      return json(200, RPC[name] ?? null);
    }
    if (url.pathname.includes("/rest/v1/")) {
      const table = url.pathname.split("/").pop();
      const singular = (req.headers().accept ?? "").includes("pgrst.object");
      const fixture = REST[table];
      if (singular) {
        if (fixture && !Array.isArray(fixture)) return json(200, fixture);
        return json(406, { code: "PGRST116", details: "The result contains 0 rows", hint: null, message: "JSON object requested, multiple (or no) rows returned" });
      }
      const rows = fixture === undefined ? [] : Array.isArray(fixture) ? fixture : [fixture];
      return json(200, rows, { "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` });
    }
    return json(200, {});
  });
}

async function newContext(browser, { viewport, mobile = false, signedIn = false }) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: mobile ? 3 : 2,
    isMobile: mobile,
    hasTouch: mobile,
    colorScheme: "dark",
    reducedMotion: "reduce",
  });
  // Answer the cookie banner ("declined" => session lives in sessionStorage).
  await context.addCookies([{ name: "cookie_consent", value: "declined", url: BASE }]);
  if (signedIn) {
    await mockSupabase(context);
    await context.addInitScript(({ key, uid }) => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const user = { id: uid, aud: "authenticated", role: "authenticated", email: "demo@example.com", app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
      sessionStorage.setItem(key, JSON.stringify({ access_token: "demo.access.token", refresh_token: "demo", token_type: "bearer", expires_in: 3600, expires_at: exp, user }));
    }, { key: `sb-${SUPABASE_REF}-auth-token`, uid: UID });
  }
  return context;
}

async function settle(page, ms = 1800) {
  await page.waitForLoadState("networkidle").catch(() => {});
  // let the images that are actually on screen finish (offscreen lazy ones never load — don't wait for them)
  await page.evaluate(async () => {
    const vh = window.innerHeight;
    const visible = [...document.images].filter((i) => {
      const r = i.getBoundingClientRect();
      return r.bottom > 0 && r.top < vh && r.width > 0 && !i.complete;
    });
    await Promise.race([
      Promise.all(visible.map((i) => new Promise((r) => { i.onload = i.onerror = r; }))),
      new Promise((r) => setTimeout(r, 6000)),
    ]);
  });
  // hide the floating bug-report button so it doesn't sit on top of every shot
  await page.evaluate(() => {
    for (const el of document.querySelectorAll("button, a")) if (el.textContent?.trim() === "Report a bug") el.style.display = "none";
  });
  await page.waitForTimeout(ms);
}

async function save(name, buffer) {
  await mkdir(OUT, { recursive: true });
  const out = await sharp(buffer).webp({ quality: 86, effort: 5 }).toBuffer();
  await writeFile(path.join(OUT, `${name}.webp`), out);
  console.log(`  ${name}.webp  ${(out.length / 1024).toFixed(0)} kB`);
}

// ── shot definitions ────────────────────────────────────────────────────────────
// Each: { name, kind, viewport, mobile?, path, prepare?(page), fullPage?, clip? }
const SHOTS = [
  { name: "home", kind: "public", viewport: DESKTOP, path: "/" },
  { name: "movie", kind: "public", viewport: { width: 1440, height: 1130 }, path: "/movies/603", prepare: (p) => p.selectOption("select", "US").then(() => p.waitForTimeout(600)) },
  { name: "search", kind: "public", viewport: DESKTOP, path: "/search?q=blade%20runner" },
  { name: "mobile-home", kind: "public", viewport: PHONE, mobile: true, path: "/" },
  { name: "mobile-movie", kind: "public", viewport: PHONE, mobile: true, path: "/movies/603" },
  { name: "calendar", kind: "demo", viewport: DESKTOP, path: "/calendar" },
  { name: "mobile-calendar", kind: "demo", viewport: PHONE, mobile: true, path: "/calendar" },
  { name: "profile", kind: "demo", viewport: { width: 1440, height: 1130 }, path: "/u/demo" },
  { name: "watchlists", kind: "demo", viewport: { width: 1440, height: 760 }, path: "/watchlists" },
];

const browser = await chromium.launch();
const contexts = {};
for (const shot of SHOTS) {
  if (ONLY && !ONLY.has(shot.name)) continue;
  const ckey = `${shot.kind}-${shot.mobile ? "m" : "d"}`;
  contexts[ckey] ??= await newContext(browser, { viewport: shot.viewport, mobile: shot.mobile, signedIn: shot.kind === "demo" });
  const page = await contexts[ckey].newPage();
  await page.setViewportSize(shot.viewport); // contexts are shared per kind, so size each page itself
  try {
    await page.goto(`${BASE}${shot.path}`, { waitUntil: "domcontentloaded" });
    await settle(page);
    if (shot.prepare) await shot.prepare(page);
    await save(shot.name, await page.screenshot({ fullPage: shot.fullPage ?? false, clip: shot.clip }));
  } catch (err) {
    console.error(`  ${shot.name}: FAILED — ${err.message}`);
  } finally {
    await page.close();
  }
}
await browser.close();
