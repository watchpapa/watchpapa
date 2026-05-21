import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = "https://watchpapa.tv";
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

async function fetchAllIds(table, idCol, updatedCol) {
  const db = getClient();
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await db
      .from(table)
      .select(`${idCol}, ${updatedCol}`)
      .is("deleted_at", null)
      .order("tmdb_popularity", { ascending: false, nullsLast: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
    if (rows.length >= 50000) break;
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

const STATIC_URLS = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/movies", changefreq: "daily", priority: "0.8" },
  { path: "/shows", changefreq: "daily", priority: "0.8" },
  { path: "/people", changefreq: "weekly", priority: "0.7" },
  { path: "/calendar", changefreq: "daily", priority: "0.7" },
  { path: "/updates", changefreq: "weekly", priority: "0.6" },
  { path: "/about", changefreq: "monthly", priority: "0.5" },
  { path: "/help", changefreq: "monthly", priority: "0.5" },
  { path: "/subscription", changefreq: "monthly", priority: "0.5" },
  { path: "/contact", changefreq: "monthly", priority: "0.4" },
  { path: "/terms", changefreq: "monthly", priority: "0.3" },
  { path: "/privacy", changefreq: "monthly", priority: "0.3" },
];

export async function sitemapHandler(_req, res) {
  try {
    const [movies, shows, people] = await Promise.all([
      fetchAllIds("movie", "id", "updated_at"),
      fetchAllIds("show", "id", "updated_at"),
      fetchAllIds("person", "id", "updated_at"),
    ]);

    const staticEntries = STATIC_URLS.map(({ path, changefreq, priority }) =>
      urlEntry(`${BASE_URL}${path}`, null, changefreq, priority)
    );

    const movieEntries = movies.map((r) =>
      urlEntry(`${BASE_URL}/movies/${r.id}`, r.updated_at, "monthly", "0.6")
    );
    const showEntries = shows.map((r) =>
      urlEntry(`${BASE_URL}/shows/${r.id}`, r.updated_at, "weekly", "0.7")
    );
    const personEntries = people.map((r) =>
      urlEntry(`${BASE_URL}/people/${r.id}`, r.updated_at, "monthly", "0.5")
    );

    const xml = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
      ...staticEntries,
      ...movieEntries,
      ...showEntries,
      ...personEntries,
      `</urlset>`,
    ].join("\n");

    res
      .set("Content-Type", "application/xml; charset=utf-8")
      .set("Cache-Control", "public, max-age=3600")
      .send(xml);
  } catch (err) {
    console.error("Sitemap generation failed:", err.message);
    res.status(500).send("Sitemap generation failed");
  }
}
