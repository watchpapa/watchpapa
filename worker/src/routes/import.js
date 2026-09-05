import { Hono } from "hono";
import { requireAuth } from "../auth.js";
import { withSql, pgErrorMessage } from "../db.js";
import { mutationRateLimit } from "../ratelimit.js";
import { auditLog, setAudit } from "../audit.js";
import { config } from "../env.js";
import { tmdbFetch, TmdbNotFound } from "../tmdb/client.js";
import { resolveTmdbIdFromLetterboxdUri } from "../lib/letterboxdUri.js";
import { TTL } from "../tmdb/lists.js";

// Redesigned import: the client parses the CSV and drives resolve (chunked) + a single
// commit. No mirror, no background full-ingest. Movies only (Letterboxd is movies-only;
// the watchpapa CSV round-trips movies).

export const importRoutes = new Hono();
importRoutes.use("*", requireAuth, mutationRateLimit);

const MAX_COMMIT = 1000;

function isPosInt(v) {
  return Number.isInteger(v) && v > 0;
}
function validYear(y) {
  return typeof y === "string" && /^\d{4}$/.test(y) && +y >= 1888 && +y <= 2200;
}

// --- POST /api/import/resolve ------------------------------------------------
// Body: { items: [{ name, year, uri? }] }  (<= IMPORT_CHUNK_MAX)
// Returns: { resolved: [{ name, year, tmdbId, title, releaseYear, posterPath }], unresolved: [{ name, year }] }

importRoutes.post("/resolve", auditLog("import_resolved"), async (c) => {
  const { importChunkMax } = config(c.env);
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Bad JSON" }, 400);
  }
  const items = Array.isArray(body?.items) ? body.items : [];
  if (items.length === 0) return c.json({ error: "items must be a non-empty array" }, 400);
  if (items.length > importChunkMax) {
    return c.json({ error: `Maximum ${importChunkMax} items per resolve request` }, 400);
  }
  for (const it of items) {
    if (typeof it.name !== "string" || !it.name.trim() || it.name.length > 300) {
      return c.json({ error: "each item needs a non-empty name (<=300 chars)" }, 400);
    }
    if (!validYear(it.year)) return c.json({ error: "each item needs a 4-digit year string" }, 400);
    if (it.uri != null && (typeof it.uri !== "string" || it.uri.length > 500)) {
      return c.json({ error: "uri must be a string (<=500 chars)" }, 400);
    }
  }

  const resolved = [];
  const unresolved = [];

  for (const it of items) {
    const match = await resolveOne(c.env, it.name.trim(), it.year, it.uri?.trim() || null);
    if (match) {
      resolved.push({
        name: it.name,
        year: it.year,
        tmdbId: match.id,
        title: match.title ?? match.original_title ?? it.name,
        releaseYear: (match.release_date ?? "").slice(0, 4) || it.year,
        posterPath: match.poster_path ?? null,
      });
    } else {
      unresolved.push({ name: it.name, year: it.year });
    }
  }

  setAudit(c, { extra: { requested: items.length, resolved: resolved.length, unresolved: unresolved.length } });
  return c.json({ resolved, unresolved });
});

async function resolveOne(env, name, year, uri) {
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

// --- POST /api/import/commit ------------------------------------------------
// Body: { ratings: [{ tmdbId, value, ratedAt? }], watchlistItems: [{ tmdbId, watched }],
//         watchlistId?, newWatchlistName?, conflictMode: 'skip'|'overwrite' }

importRoutes.post("/commit", auditLog("import_committed", ["conflictMode"]), async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Bad JSON" }, 400);
  }
  const {
    ratings = [],
    watchlistItems = [],
    watchlistId: rawWatchlistId,
    newWatchlistName,
    conflictMode,
  } = body ?? {};

  if (!["skip", "overwrite"].includes(conflictMode)) {
    return c.json({ error: "conflictMode must be 'skip' or 'overwrite'" }, 400);
  }
  if (!Array.isArray(ratings) || ratings.length > MAX_COMMIT) {
    return c.json({ error: `ratings must be an array of at most ${MAX_COMMIT}` }, 400);
  }
  if (!Array.isArray(watchlistItems) || watchlistItems.length > MAX_COMMIT) {
    return c.json({ error: `watchlistItems must be an array of at most ${MAX_COMMIT}` }, 400);
  }
  for (const r of ratings) {
    if (!isPosInt(r.tmdbId)) return c.json({ error: "ratings[].tmdbId must be a positive integer" }, 400);
    if (!Number.isInteger(r.value) || r.value < 1 || r.value > 10) {
      return c.json({ error: "ratings[].value must be an integer 1-10" }, 400);
    }
    if (r.ratedAt != null && !/^\d{4}-\d{2}-\d{2}$/.test(r.ratedAt)) {
      return c.json({ error: "ratings[].ratedAt must be YYYY-MM-DD" }, 400);
    }
  }
  for (const w of watchlistItems) {
    if (!isPosInt(w.tmdbId)) return c.json({ error: "watchlistItems[].tmdbId must be a positive integer" }, 400);
    if (typeof w.watched !== "boolean") return c.json({ error: "watchlistItems[].watched must be a boolean" }, 400);
  }
  if (watchlistItems.length > 0 && rawWatchlistId == null && !newWatchlistName?.trim()) {
    return c.json({ error: "Provide watchlistId or newWatchlistName" }, 400);
  }
  if (ratings.length === 0 && watchlistItems.length === 0) {
    return c.json({ ratingsImported: 0, ratingsSkipped: 0, watchlistAdded: 0, watchlistSkipped: 0 });
  }

  const profileId = c.get("user").id;

  return withSql(c, async (sql) => {
    let watchlistId = rawWatchlistId != null ? Number(rawWatchlistId) : null;

    if (watchlistId != null) {
      if (!isPosInt(watchlistId)) return c.json({ error: "watchlistId must be a positive integer" }, 400);
      const [owner] = await sql`SELECT id FROM public.watchlist WHERE id = ${watchlistId} AND profile_id = ${profileId}`;
      if (!owner) return c.json({ error: "Watchlist not found or does not belong to you" }, 403);
    }

    // The writes below happen inside one transaction so a single
    // `watchpapa.audit_skip` (SET LOCAL — scoped to this transaction only)
    // suppresses the per-row DB triggers for the whole batch; the worker's
    // own auditLog middleware records one `import_committed` summary row
    // instead (see the setAudit call below).
    try {
      const result = await sql.begin(async (tx) => {
        await tx`SELECT set_config('watchpapa.audit_skip', '1', true)`;

        let wlId = watchlistId;
        if (watchlistItems.length > 0 && wlId == null && newWatchlistName?.trim()) {
          const [row] = await tx`
            INSERT INTO public.watchlist (profile_id, name, created_at, updated_at)
            VALUES (${profileId}, ${newWatchlistName.trim().slice(0, 100)}, now(), now())
            RETURNING id
          `;
          wlId = Number(row.id);
        }

        let ratingsImported = 0;
        let watchlistAdded = 0;

        if (ratings.length > 0) {
          const values = ratings.map((r) => ({
            profile_id: profileId,
            media_type: "movie",
            tmdb_id: r.tmdbId,
            value: r.value,
            created_at: r.ratedAt ? `${r.ratedAt}T00:00:00.000Z` : new Date().toISOString(),
          }));
          const conflict =
            conflictMode === "overwrite"
              ? tx`DO UPDATE SET value = EXCLUDED.value, created_at = EXCLUDED.created_at, updated_at = now()`
              : tx`DO NOTHING`;
          const inserted = await tx`
            INSERT INTO public.user_rating ${tx(values, "profile_id", "media_type", "tmdb_id", "value", "created_at")}
            ON CONFLICT (profile_id, media_type, tmdb_id) ${conflict}
            RETURNING id
          `;
          ratingsImported = inserted.length;
        }

        if (watchlistItems.length > 0 && wlId != null) {
          const values = watchlistItems.map((w) => ({
            watchlist_id: wlId,
            media_type: "movie",
            tmdb_id: w.tmdbId,
            watched: w.watched,
          }));
          const inserted = await tx`
            INSERT INTO public.watchlist_item ${tx(values, "watchlist_id", "media_type", "tmdb_id", "watched")}
            ON CONFLICT (watchlist_id, media_type, tmdb_id)
            DO UPDATE SET watched = CASE WHEN EXCLUDED.watched THEN true ELSE public.watchlist_item.watched END
            RETURNING id
          `;
          watchlistAdded = inserted.length;
        }

        return { ratingsImported, watchlistAdded };
      });

      const ratingsSkipped = ratings.length - result.ratingsImported;
      const watchlistSkipped = watchlistItems.length - result.watchlistAdded;
      setAudit(c, {
        extra: {
          ratingsImported: result.ratingsImported,
          ratingsSkipped,
          watchlistAdded: result.watchlistAdded,
          watchlistSkipped,
        },
      });
      return c.json({
        ratingsImported: result.ratingsImported,
        ratingsSkipped,
        watchlistAdded: result.watchlistAdded,
        watchlistSkipped,
      });
    } catch (e) {
      const msg = pgErrorMessage(e);
      if (msg.includes("WATCHLIST_LIMIT_REACHED")) {
        return c.json({ error: msg.replace("WATCHLIST_LIMIT_REACHED: ", "") }, 422);
      }
      throw e;
    }
  });
});

// --- GET /api/import/export ------------------------------------------------
// Returns JSON rows keyed by tmdb_id; the frontend hydrates Name/Year via
// /api/content/batch and composes the watchpapa CSV client-side.

importRoutes.get("/export", async (c) => {
  const profileId = c.get("user").id;
  return withSql(c, async (sql) => {
    const ratings = await sql`
      SELECT tmdb_id, value, created_at
      FROM public.user_rating
      WHERE profile_id = ${profileId} AND media_type = 'movie'
      ORDER BY created_at DESC
    `;
    const watchlistItems = await sql`
      SELECT wi.tmdb_id, wi.watched, wi.added_at, w.name AS watchlist_name
      FROM public.watchlist_item wi
      JOIN public.watchlist w ON w.id = wi.watchlist_id
      WHERE w.profile_id = ${profileId} AND wi.media_type = 'movie'
      ORDER BY wi.added_at DESC
    `;
    return c.json({ ratings, watchlistItems });
  });
});
