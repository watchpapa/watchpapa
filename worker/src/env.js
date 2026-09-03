// Parse wrangler `vars` (all strings) into typed config with safe defaults.
// Every cap here is a wrangler var so the Free-plan limits can be raised on Paid
// without a code change.

function int(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function config(env) {
  return {
    allowedOrigins: (env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
    supabaseUrl: (env.SUPABASE_URL ?? "").replace(/\/$/, ""),
    tmdbKey: env.TMDB_API_KEY_SECRET ?? "",
    // Content batch hydration
    batchMax: int(env.BATCH_MAX, 18),
    batchSubreqBudget: int(env.BATCH_SUBREQ_BUDGET, 36),
    // Import resolve chunking (each row may cost up to 2 subrequests)
    importChunkMax: int(env.IMPORT_CHUNK_MAX, 10),
    // Calendar releases: shows resolved per request (frontend chunks the rest)
    releasesMaxShows: int(env.RELEASES_MAX_SHOWS, 12),
    // Sitemap: TMDB list pages fetched per sitemap file
    sitemapPages: int(env.SITEMAP_PAGES, 8),
  };
}
