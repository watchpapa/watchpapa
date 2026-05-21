import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = "https://watchpapa.tv";
const API_URL = "https://api.watchpapa.tv";
const PAGE_SIZE = 1000;

let supabase = null;

function getClient() {
  if (!supabase) {
    supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }
  return supabase;
}

async function fetchAllRows(table, updatedCol, popularityCol) {
  const db = getClient();
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await db
      .from(table)
      .select(`slug, ${updatedCol}`)
      .is("deleted_at", null)
      .not("slug", "is", null)
      .order(popularityCol, { ascending: false, nullsLast: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
    if (rows.length >= 49000) break;
  }

  return rows;
}

function urlEntry(loc, lastmod, changefreq, priority) {
  const lastmodTag = lastmod ? `\n    <lastmod>${lastmod.slice(0, 10)}</lastmod>` : "";
  return `  <url>
    <loc>${loc}</loc>${lastmodTag}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

function buildUrlset(entries) {
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...entries,
    `</urlset>`,
  ].join("\n");
}

function sendXml(res, xml) {
  res
    .set("Content-Type", "application/xml; charset=utf-8")
    .set("Cache-Control", "public, max-age=3600")
    .send(xml);
}

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

// Sitemap index — lists all child sitemaps
export function sitemapIndexHandler(_req, res) {
  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    `  <sitemap><loc>${BASE_URL}/sitemap-static.xml</loc></sitemap>`,
    `  <sitemap><loc>${BASE_URL}/sitemap-movies.xml</loc></sitemap>`,
    `  <sitemap><loc>${BASE_URL}/sitemap-shows.xml</loc></sitemap>`,
    `  <sitemap><loc>${BASE_URL}/sitemap-people.xml</loc></sitemap>`,
    `</sitemapindex>`,
  ].join("\n");
  sendXml(res, xml);
}

export function sitemapStaticHandler(_req, res) {
  const entries = STATIC_URLS.map(({ path, changefreq, priority }) =>
    urlEntry(`${BASE_URL}${path}`, null, changefreq, priority)
  );
  sendXml(res, buildUrlset(entries));
}

export async function sitemapMoviesHandler(_req, res) {
  try {
    const rows = await fetchAllRows("movie", "updated_at", "tmdb_popularity");
    const entries = rows.map((r) =>
      urlEntry(`${BASE_URL}/movies/${r.slug}`, r.updated_at, "monthly", "0.6")
    );
    sendXml(res, buildUrlset(entries));
  } catch (err) {
    console.error("Sitemap movies failed:", err.message);
    res.status(500).send("Sitemap generation failed");
  }
}

export async function sitemapShowsHandler(_req, res) {
  try {
    const rows = await fetchAllRows("show", "updated_at", "tmdb_popularity");
    const entries = rows.map((r) =>
      urlEntry(`${BASE_URL}/shows/${r.slug}`, r.updated_at, "weekly", "0.7")
    );
    sendXml(res, buildUrlset(entries));
  } catch (err) {
    console.error("Sitemap shows failed:", err.message);
    res.status(500).send("Sitemap generation failed");
  }
}

export async function sitemapPeopleHandler(_req, res) {
  try {
    const rows = await fetchAllRows("person", "updated_at", "popularity");
    const entries = rows.map((r) =>
      urlEntry(`${BASE_URL}/people/${r.slug}`, r.updated_at, "monthly", "0.5")
    );
    sendXml(res, buildUrlset(entries));
  } catch (err) {
    console.error("Sitemap people failed:", err.message);
    res.status(500).send("Sitemap generation failed");
  }
}
