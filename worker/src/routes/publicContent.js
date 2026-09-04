import { Hono } from "hono";
import { config } from "../env.js";
import { tmdbFetch, tmdbFetchAllSettled } from "../tmdb/client.js";
import { TTL } from "../tmdb/lists.js";
import { normalizeSearchResults } from "../tmdb/normalize.js";
import { readLocale } from "../tmdb/locale.js";
import { backfillShowStatus } from "../tmdb/discover.js";

// Search, posters, image proxy, sitemaps — the remaining public TMDB-backed routes.

export const search = new Hono();

function posInt(raw) {
  const n = Number.parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// GET /api/search?q=&page=&include_adult=&lang=&native=  (also accepts includeAdult=,
// kept for backward compatibility). Backed by TMDB's /search/multi — a single call
// that already returns movies/shows/people mixed together in TMDB's own relevance
// order (not split by type), and supports pagination, unlike running three separate
// typed searches and merging them ourselves.
search.get("/", async (c) => {
  const q = (c.req.query("q") ?? "").trim();
  if (q.length < 2) return c.json({ results: [], page: 1, total_pages: 1 });
  if (q.length > 100) return c.json({ error: "Query too long" }, 400);
  const loc = readLocale(c);
  const page = posInt(c.req.query("page")) ?? 1;

  const raw = await tmdbFetch(
    c.env,
    "/search/multi",
    { query: q, page, include_adult: loc.includeAdult },
    { ttl: TTL.search, language: loc.language },
  );

  const results = normalizeSearchResults(raw, loc.includeAdult, { native: loc.native });
  // TMDB's /search/multi rows never carry a show's `status` (only the full
  // /tv/{id} detail payload does) — without it, the frontend's follow-gating
  // can't tell an ended/canceled show from an active one. Same backfill used
  // for browse/discover rows (worker/src/tmdb/discover.js), keyed on
  // `tmdbId` since search results don't use the `id` field name.
  await backfillShowStatus(c.env, results, loc.language, config(c.env).showStatusBackfillMax, "tmdbId");
  return c.json(
    { results, page: raw.page ?? page, total_pages: raw.total_pages ?? 1 },
    200,
    { "Cache-Control": `public, s-maxage=${TTL.search}, max-age=30` },
  );
});

// GET /api/posters — poster paths for the auth-page background wall.
export const posters = new Hono();
posters.get("/", async (c) => {
  const [m1, m2, t1, t2] = await tmdbFetchAllSettled(c.env, [
    { path: "/movie/popular", params: { page: 1 }, opts: { ttl: TTL.sitemap } },
    { path: "/movie/popular", params: { page: 2 }, opts: { ttl: TTL.sitemap } },
    { path: "/tv/popular", params: { page: 1 }, opts: { ttl: TTL.sitemap } },
    { path: "/tv/popular", params: { page: 2 }, opts: { ttl: TTL.sitemap } },
  ]);
  const pick = (data) =>
    (data?.results ?? []).filter((r) => !r.adult && r.poster_path).map((r) => r.poster_path);
  const paths = [...pick(m1), ...pick(m2), ...pick(t1), ...pick(t2)].slice(0, 80);
  return c.json({ paths }, 200, { "Cache-Control": "public, s-maxage=86400, max-age=300" });
});

// GET /api/image-proxy?path=&size= — CORS-safe, streamed, edge-cached.
export const imageProxy = new Hono();
const VALID_SIZES = new Set(["w92", "w154", "w185", "w342", "w500", "w780", "original"]);
const SAFE_PATH = /^\/[a-zA-Z0-9/_.-]+\.(jpg|jpeg|png|webp)$/;
imageProxy.get("/", async (c) => {
  const path = c.req.query("path") ?? "";
  const size = c.req.query("size") ?? "w342";
  if (!SAFE_PATH.test(path) || !VALID_SIZES.has(size)) return c.body(null, 400);

  const upstream = await fetch(`https://image.tmdb.org/t/p/${size}${path}`, {
    cf: { cacheEverything: true, cacheTtl: 86400 },
  });
  if (!upstream.ok) return c.body(null, upstream.status === 404 ? 404 : 502);

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") || "image/jpeg",
      "Cache-Control": "public, max-age=86400, immutable",
      "Access-Control-Allow-Origin": "*",
    },
  });
});

// --- sitemaps --------------------------------------------------------------

const BASE_URL = "https://watchpapa.tv";

const STATIC_URLS = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/movies", changefreq: "daily", priority: "0.8" },
  { path: "/shows", changefreq: "daily", priority: "0.8" },
  { path: "/people", changefreq: "daily", priority: "0.7" },
  { path: "/calendar", changefreq: "daily", priority: "0.7" },
  { path: "/updates", changefreq: "weekly", priority: "0.6" },
  { path: "/about", changefreq: "monthly", priority: "0.5" },
  { path: "/help", changefreq: "monthly", priority: "0.5" },
  { path: "/subscription", changefreq: "monthly", priority: "0.5" },
  { path: "/contact", changefreq: "monthly", priority: "0.4" },
  { path: "/terms", changefreq: "monthly", priority: "0.3" },
  { path: "/privacy", changefreq: "monthly", priority: "0.3" },
];

function urlEntry(loc, changefreq, priority) {
  return `  <url>\n    <loc>${loc}</loc>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}
function urlset(entries) {
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...entries,
    `</urlset>`,
  ].join("\n");
}
function xml(c, body, ttl = 86400) {
  return c.body(body, 200, {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": `public, s-maxage=${ttl}, max-age=3600`,
  });
}

// Pull up to `pages` pages of a TMDB list and return de-duped ids.
async function listIds(env, paths, pages) {
  const reqs = [];
  for (const path of paths) {
    for (let p = 1; p <= pages; p += 1) reqs.push({ path, params: { page: p }, opts: { ttl: 86400 } });
  }
  const results = await tmdbFetchAllSettled(env, reqs);
  const ids = new Set();
  for (const r of results) for (const item of r?.results ?? []) if (item.id) ids.add(item.id);
  return [...ids];
}

export const sitemap = new Hono();

sitemap.get("/sitemap.xml", (c) =>
  xml(
    c,
    [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
      `  <sitemap><loc>${BASE_URL}/sitemap-static.xml</loc></sitemap>`,
      `  <sitemap><loc>${BASE_URL}/sitemap-movies.xml</loc></sitemap>`,
      `  <sitemap><loc>${BASE_URL}/sitemap-shows.xml</loc></sitemap>`,
      `  <sitemap><loc>${BASE_URL}/sitemap-people.xml</loc></sitemap>`,
      `</sitemapindex>`,
    ].join("\n"),
  ),
);

sitemap.get("/sitemap-static.xml", (c) =>
  xml(c, urlset(STATIC_URLS.map((u) => urlEntry(`${BASE_URL}${u.path}`, u.changefreq, u.priority)))),
);

sitemap.get("/sitemap-movies.xml", async (c) => {
  const { sitemapPages } = config(c.env);
  const ids = await listIds(c.env, ["/movie/popular", "/movie/top_rated"], sitemapPages);
  return xml(c, urlset(ids.map((id) => urlEntry(`${BASE_URL}/movies/${id}`, "weekly", "0.6"))));
});

sitemap.get("/sitemap-shows.xml", async (c) => {
  const { sitemapPages } = config(c.env);
  const ids = await listIds(c.env, ["/tv/popular", "/tv/top_rated"], sitemapPages);
  return xml(c, urlset(ids.map((id) => urlEntry(`${BASE_URL}/shows/${id}`, "weekly", "0.7"))));
});

sitemap.get("/sitemap-people.xml", async (c) => {
  const { sitemapPages } = config(c.env);
  const ids = await listIds(c.env, ["/person/popular"], sitemapPages);
  return xml(c, urlset(ids.map((id) => urlEntry(`${BASE_URL}/people/${id}`, "monthly", "0.5"))));
});
