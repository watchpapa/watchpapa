import { Hono } from "hono";
import { requireAuth } from "../auth.js";
import { withSql } from "../db.js";
import { mutationRateLimit } from "../ratelimit.js";
import { auditLog, setAudit } from "../audit.js";
import { runImportTickForJob } from "../cron.js";

// Background import: the client parses the CSV and dedupes to a film list,
// then hands it all to the Worker in one POST /jobs call. A Cloudflare Cron
// Trigger (cron.js) resolves + commits it in the background, chunk by chunk,
// so the import finishes even if the tab that started it gets closed. Movies
// only (Letterboxd is movies-only; the watchpapa CSV round-trips movies).

export const importRoutes = new Hono();
importRoutes.use("*", requireAuth);
// GET /jobs/:id is polled every few seconds while a job is in flight (both
// from ImportPage and the global ImportStatusBadge) — keep it off the
// mutation limiter so status polling can't itself exhaust a user's mutation
// budget. Every other route stays mutation-limited as before.
importRoutes.use("/jobs", mutationRateLimit);
importRoutes.use("/jobs/:id", async (c, next) => (c.req.method === "GET" ? next() : mutationRateLimit(c, next)));
importRoutes.use("/export", mutationRateLimit);

const MAX_FILMS = 5000;

function isPosInt(v) {
  return Number.isInteger(v) && v > 0;
}
function validYear(y) {
  return typeof y === "string" && /^\d{4}$/.test(y) && +y >= 1888 && +y <= 2200;
}
function validFilm(it) {
  return (
    it &&
    typeof it.name === "string" &&
    it.name.trim() &&
    it.name.length <= 300 &&
    validYear(it.year) &&
    (it.uri == null || (typeof it.uri === "string" && it.uri.length <= 500))
  );
}

// --- POST /api/import/jobs ---------------------------------------------------
// Body: { uniqueFilms: [{name, year, uri?}], ratingsSrc: [{name, year, uri?, value, ratedAt?}],
//         watchlistSrc: [{name, year, uri?, watched}], watchlistId?, newWatchlistName?,
//         conflictMode: 'skip'|'overwrite' }
// Returns: { jobId }

importRoutes.post("/jobs", auditLog("import_job_created"), async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Bad JSON" }, 400);
  }
  const {
    uniqueFilms,
    ratingsSrc = [],
    watchlistSrc = [],
    watchlistId: rawWatchlistId,
    newWatchlistName,
    conflictMode,
  } = body ?? {};

  if (!["skip", "overwrite"].includes(conflictMode)) {
    return c.json({ error: "conflictMode must be 'skip' or 'overwrite'" }, 400);
  }
  if (!Array.isArray(uniqueFilms) || uniqueFilms.length === 0) {
    return c.json({ error: "uniqueFilms must be a non-empty array" }, 400);
  }
  if (uniqueFilms.length > MAX_FILMS) {
    return c.json({ error: `Maximum ${MAX_FILMS} films per import` }, 400);
  }
  if (!Array.isArray(ratingsSrc) || ratingsSrc.length > MAX_FILMS) {
    return c.json({ error: `ratingsSrc must be an array of at most ${MAX_FILMS}` }, 400);
  }
  if (!Array.isArray(watchlistSrc) || watchlistSrc.length > MAX_FILMS) {
    return c.json({ error: `watchlistSrc must be an array of at most ${MAX_FILMS}` }, 400);
  }
  if (!uniqueFilms.every(validFilm)) {
    return c.json({ error: "each film needs a non-empty name (<=300 chars), a 4-digit year, and an optional uri (<=500 chars)" }, 400);
  }
  for (const r of ratingsSrc) {
    if (!validFilm(r)) return c.json({ error: "ratingsSrc[] has an invalid film" }, 400);
    if (!Number.isInteger(r.value) || r.value < 1 || r.value > 10) {
      return c.json({ error: "ratingsSrc[].value must be an integer 1-10" }, 400);
    }
    if (r.ratedAt != null && !/^\d{4}-\d{2}-\d{2}$/.test(r.ratedAt)) {
      return c.json({ error: "ratingsSrc[].ratedAt must be YYYY-MM-DD" }, 400);
    }
  }
  for (const w of watchlistSrc) {
    if (!validFilm(w)) return c.json({ error: "watchlistSrc[] has an invalid film" }, 400);
    if (typeof w.watched !== "boolean") return c.json({ error: "watchlistSrc[].watched must be a boolean" }, 400);
  }
  if (watchlistSrc.length > 0 && rawWatchlistId == null && !newWatchlistName?.trim()) {
    return c.json({ error: "Provide watchlistId or newWatchlistName" }, 400);
  }
  let watchlistId = rawWatchlistId != null ? Number(rawWatchlistId) : null;
  if (watchlistId != null && !isPosInt(watchlistId)) {
    return c.json({ error: "watchlistId must be a positive integer" }, 400);
  }

  const profileId = c.get("user").id;

  return withSql(c, async (sql) => {
    if (watchlistId != null) {
      const [owner] = await sql`SELECT id FROM public.watchlist WHERE id = ${watchlistId} AND profile_id = ${profileId}`;
      if (!owner) return c.json({ error: "Watchlist not found or does not belong to you" }, 403);
    }

    const payload = {
      uniqueFilms,
      ratingsSrc,
      watchlistSrc,
      watchlistId,
      newWatchlistName: newWatchlistName?.trim().slice(0, 100) || null,
      conflictMode,
    };
    const [row] = await sql`
      INSERT INTO public.import_job (profile_id, status, payload, total)
      VALUES (${profileId}, 'pending', ${sql.json(payload)}, ${uniqueFilms.length})
      RETURNING id
    `;

    setAudit(c, { extra: { total: uniqueFilms.length } });
    c.executionCtx.waitUntil(runImportTickForJob(c.env, row.id));

    return c.json({ jobId: row.id });
  });
});

// --- GET /api/import/jobs/:id -------------------------------------------------

importRoutes.get("/jobs/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!isPosInt(id)) return c.json({ error: "Invalid job id" }, 400);
  const profileId = c.get("user").id;

  return withSql(c, async (sql) => {
    const [job] = await sql`
      SELECT status, resolve_cursor, total, unresolved, result, error
      FROM public.import_job
      WHERE id = ${id} AND profile_id = ${profileId}
    `;
    if (!job) return c.json({ error: "Not found" }, 404);

    return c.json({
      status: job.status,
      done: job.resolve_cursor,
      total: job.total,
      unresolvedCount: Array.isArray(job.unresolved) ? job.unresolved.length : 0,
      unresolved: job.status === "done" ? job.unresolved : undefined,
      result: job.result,
      error: job.error,
    });
  });
});

// --- DELETE /api/import/jobs/:id ----------------------------------------------

importRoutes.delete("/jobs/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!isPosInt(id)) return c.json({ error: "Invalid job id" }, 400);
  const profileId = c.get("user").id;

  return withSql(c, async (sql) => {
    const rows = await sql`
      UPDATE public.import_job SET status = 'cancelled', updated_at = now()
      WHERE id = ${id} AND profile_id = ${profileId} AND status IN ('pending', 'resolving', 'committing')
      RETURNING id
    `;
    if (rows.length === 0) return c.json({ error: "Not found or already finished" }, 404);
    return c.json({ ok: true });
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
