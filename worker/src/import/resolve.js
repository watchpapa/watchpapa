import { tmdbFetch, TmdbNotFound } from "../tmdb/client.js";
import { resolveTmdbIdFromLetterboxdUri } from "../lib/letterboxdUri.js";
import { TTL } from "../tmdb/lists.js";

// Extracted from the old POST /api/import/resolve route so the import-job
// cron handler (cron.js) can resolve chunks without an HTTP round trip.
export async function resolveOne(env, name, year, uri) {
  if (uri) {
    let tmdbId = null;
    try {
      tmdbId = await resolveTmdbIdFromLetterboxdUri(uri);
    } catch {
      tmdbId = null;
    }
    if (tmdbId) {
      try {
        return await tmdbFetch(env, `/movie/${tmdbId}`, {}, { ttl: TTL.movie });
      } catch (e) {
        if (!(e instanceof TmdbNotFound)) throw e;
      }
    }
  }
  try {
    const data = await tmdbFetch(
      env,
      "/search/movie",
      { query: name, year, include_adult: false, page: 1 },
      { ttl: TTL.search },
    );
    const results = data.results ?? [];
    const hit = results.find((r) => (r.release_date ?? "").startsWith(year)) ?? results[0] ?? null;
    return hit;
  } catch {
    return null;
  }
}

// Resolves a chunk of { name, year, uri? } items to TMDB ids, in order —
// out[i] is `{ tmdbId }` or `null` for items[i].
export async function resolveChunk(env, items) {
  const out = [];
  for (const it of items) {
    const match = await resolveOne(env, it.name.trim(), it.year, it.uri?.trim() || null);
    out.push(match ? { tmdbId: match.id } : null);
  }
  return out;
}
