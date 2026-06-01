// Used by:
// - app.js
import { Router } from "express";
import sequelize from "../db/database.js";
import { fastUpsertMovie } from "../services/searchService.js";
import { tmdbRateLimitedFetch } from "../scripts/tmdb_rate_limited_fetch.js";
import { dedupIngest } from "../lib/ingestionQueue.js";
import { ingestMovie } from "../scripts/inject_movie.js";
import { logScriptRun } from "../lib/logScriptRun.js";
import { resolveTmdbIdFromLetterboxdUri } from "../lib/letterboxdUri.js";

const router = Router();
const TMDB_API_KEY = process.env.TMDB_API_KEY_SECRET;

const MAX_ITEMS = 1000;

function escapePattern(q) {
  return "%" + String(q).replace(/[%_]/g, "\\$&") + "%";
}

function isPositiveInt(v) {
  return Number.isInteger(v) && v > 0;
}

function normalizeOptionalUri(uri) {
  if (uri == null || uri === "") return null;
  if (typeof uri !== "string") return { error: "uri must be a string" };
  const trimmed = uri.trim();
  if (trimmed.length > 500) return { error: "uri must be 500 characters or fewer" };
  if (!/^https?:\/\//i.test(trimmed)) return { error: "uri must be an http(s) URL" };
  return trimmed;
}

function validateImportItem(item, label) {
  if (typeof item.name !== "string" || !item.name.trim()) {
    return `${label}.name must be a non-empty string`;
  }
  if (item.name.trim().length > 300) {
    return `${label}.name must be 300 characters or fewer`;
  }
  if (typeof item.year !== "string" || !/^\d{4}$/.test(item.year)) {
    return `${label}.year must be a 4-digit string`;
  }
  const y = parseInt(item.year, 10);
  if (y < 1888 || y > 2200) {
    return `Year ${item.year} is out of valid range (1888–2200)`;
  }
  const uri = normalizeOptionalUri(item.uri);
  if (uri && typeof uri === "object" && uri.error) {
    return uri.error;
  }
  item.uri = uri || null;
  return null;
}

function normalizeOptionalRatedAt(ratedAt) {
  if (ratedAt == null || ratedAt === "") return null;
  if (typeof ratedAt !== "string") return { error: "ratedAt must be a string" };
  const trimmed = ratedAt.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return { error: "ratedAt must be YYYY-MM-DD" };
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return { error: "ratedAt is not a valid date" };
  return trimmed;
}

function validateRatingItem(item, label) {
  const err = validateImportItem(item, label);
  if (err) return err;
  const ratedAt = normalizeOptionalRatedAt(item.ratedAt);
  if (ratedAt && typeof ratedAt === "object" && ratedAt.error) return ratedAt.error;
  item.ratedAt = ratedAt || null;
  if (!Number.isInteger(item.value) || item.value < 1 || item.value > 10) {
    return `${label}.value must be an integer 1–10`;
  }
  return null;
}

function ratedAtTimestamp(ratedAt) {
  return ratedAt ? `${ratedAt}T00:00:00.000Z` : null;
}

async function insertRatingRows(profileId, ratingRows, conflictMode) {
  if (ratingRows.length === 0) return;

  const datedRows = ratingRows.filter((row) => row.ratedAt);
  const undatedRows = ratingRows.filter((row) => !row.ratedAt);

  async function runInsert(rows, { withDates, conflictClause }) {
    if (rows.length === 0) return;

    const placeholders = rows.map((row, i) => {
      if (withDates) {
        return `(:uid, :mid${i}, :val${i}, :ratedAt${i}::timestamptz, :ratedAt${i}::timestamptz)`;
      }
      return `(:uid, :mid${i}, :val${i}, now(), now())`;
    }).join(", ");

    const replacements = { uid: profileId };
    rows.forEach(({ localId, value, ratedAt }, i) => {
      replacements[`mid${i}`] = localId;
      replacements[`val${i}`] = value;
      if (withDates) replacements[`ratedAt${i}`] = ratedAtTimestamp(ratedAt);
    });

    await sequelize.query(
      `INSERT INTO user_rating (profile_id, movie_id, value, created_at, updated_at)
       VALUES ${placeholders}
       ON CONFLICT (profile_id, movie_id) WHERE movie_id IS NOT NULL
       ${conflictClause}`,
      { replacements }
    );
  }

  const datedConflict = conflictMode === "overwrite"
    ? "DO UPDATE SET value = EXCLUDED.value, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at"
    : "DO NOTHING";

  const undatedConflict = conflictMode === "overwrite"
    ? "DO UPDATE SET value = EXCLUDED.value, updated_at = now()"
    : "DO NOTHING";

  await runInsert(datedRows, { withDates: true, conflictClause: datedConflict });
  await runInsert(undatedRows, { withDates: false, conflictClause: undatedConflict });
}

function itemResolveKey(item) {
  if (item.uri) return item.uri.toLowerCase();
  return `${item.name.toLowerCase()}|||${item.year}`;
}

const uriTmdbCache = new Map();

async function getTmdbIdFromUri(uri) {
  const key = uri.trim().toLowerCase();
  if (uriTmdbCache.has(key)) return uriTmdbCache.get(key);

  let tmdbId = null;
  try {
    tmdbId = await resolveTmdbIdFromLetterboxdUri(uri);
  } catch (e) {
    console.warn("import: letterboxd uri resolve failed:", uri, e.message);
  }

  uriTmdbCache.set(key, tmdbId);
  return tmdbId;
}

function fireIngest(tmdbId) {
  const id = Number(tmdbId);
  if (!TMDB_API_KEY || !id) return;
  dedupIngest(`movie:${id}`, async () => {
    const startedAt = new Date();
    const scriptName = `inject_movie:${id}`;
    try {
      const result = await ingestMovie({ tmdbId: id, apiKey: TMDB_API_KEY, forceRefreshExisting: true });
      await logScriptRun({ scriptName, status: "success", batchSize: (result?.castLinked ?? 0) + (result?.crewLinked ?? 0), startedAt });
    } catch (e) {
      await logScriptRun({ scriptName, status: "failure", errorCode: e?.name, errorDetail: e?.message, startedAt });
      throw e;
    }
  }).catch((e) => console.warn(`import: ingest tmdb_id=${id}:`, e.message));
}

// Resolve a list of {name, year, uri?} items to local movie IDs.
// Prefers Letterboxd URI → TMDB id; falls back to title+year search.
router.post("/resolve", async (req, res) => {
  const { items } = req.body ?? {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items must be a non-empty array" });
  }
  if (items.length > MAX_ITEMS) {
    return res.status(400).json({ error: `Maximum ${MAX_ITEMS} items per resolve request` });
  }
  for (const item of items) {
    const err = validateImportItem(item, "Each item");
    if (err) return res.status(400).json({ error: err });
  }

  const resolved = [];
  const unresolved = [];

  for (const item of items) {
    const result = await resolveItem(item.name, item.year, item.uri);
    if (result) {
      resolved.push({
        name: item.name,
        year: item.year,
        localId: result.localId,
        title: result.title,
      });
    } else {
      unresolved.push({ name: item.name, year: item.year });
    }
  }

  res.json({ resolved, unresolved });
});

// Commit resolved items: batch-insert ratings and watchlist items.
router.post("/commit", async (req, res) => {
  const {
    ratings = [],
    watchlistItems = [],
    watchlistId: rawWatchlistId,
    newWatchlistName,
    conflictMode,
  } = req.body ?? {};

  const profileId = req.user.id;

  // Validate conflictMode
  if (!["skip", "overwrite"].includes(conflictMode)) {
    return res.status(400).json({ error: "conflictMode must be 'skip' or 'overwrite'" });
  }

  // Validate ratings
  if (!Array.isArray(ratings)) {
    return res.status(400).json({ error: "ratings must be an array" });
  }
  if (ratings.length > MAX_ITEMS) {
    return res.status(400).json({ error: `Maximum ${MAX_ITEMS} ratings per commit` });
  }
  for (const r of ratings) {
    if (!isPositiveInt(r.localId)) {
      return res.status(400).json({ error: "ratings[].localId must be a positive integer" });
    }
    if (!Number.isInteger(r.value) || r.value < 1 || r.value > 10) {
      return res.status(400).json({ error: "ratings[].value must be an integer 1–10" });
    }
    const ratedAt = normalizeOptionalRatedAt(r.ratedAt);
    if (ratedAt && typeof ratedAt === "object" && ratedAt.error) {
      return res.status(400).json({ error: ratedAt.error });
    }
    r.ratedAt = ratedAt || null;
  }

  // Validate watchlist items and their target
  if (!Array.isArray(watchlistItems)) {
    return res.status(400).json({ error: "watchlistItems must be an array" });
  }
  if (watchlistItems.length > MAX_ITEMS) {
    return res.status(400).json({ error: `Maximum ${MAX_ITEMS} watchlist items per commit` });
  }
  for (const w of watchlistItems) {
    if (!isPositiveInt(w.localId)) {
      return res.status(400).json({ error: "watchlistItems[].localId must be a positive integer" });
    }
    if (typeof w.watched !== "boolean") {
      return res.status(400).json({ error: "watchlistItems[].watched must be a boolean" });
    }
  }

  if (watchlistItems.length > 0 && rawWatchlistId == null && !newWatchlistName?.trim()) {
    return res.status(400).json({ error: "Provide watchlistId or newWatchlistName when importing watchlist items" });
  }

  if (ratings.length === 0 && watchlistItems.length === 0) {
    return res.json({ ratingsImported: 0, ratingsSkipped: 0, watchlistAdded: 0, watchlistSkipped: 0 });
  }

  let resolvedWatchlistId = rawWatchlistId != null ? Number(rawWatchlistId) : null;

  // If using an existing watchlist, verify it belongs to the current user.
  if (resolvedWatchlistId != null) {
    if (!isPositiveInt(resolvedWatchlistId)) {
      return res.status(400).json({ error: "watchlistId must be a positive integer" });
    }
    const [ownerRows] = await sequelize.query(
      `SELECT id FROM watchlist WHERE id = :id AND profile_id = :profileId`,
      { replacements: { id: resolvedWatchlistId, profileId } }
    );
    if (ownerRows.length === 0) {
      return res.status(403).json({ error: "Watchlist not found or does not belong to you" });
    }
  }

  // Create a new watchlist if requested.
  if (watchlistItems.length > 0 && resolvedWatchlistId == null && newWatchlistName?.trim()) {
    const name = newWatchlistName.trim().slice(0, 100);
    try {
      const [rows] = await sequelize.query(
        `INSERT INTO watchlist (profile_id, name, created_at, updated_at)
         VALUES (:profileId, :name, now(), now())
         RETURNING id`,
        { replacements: { profileId, name } }
      );
      resolvedWatchlistId = rows[0].id;
    } catch (e) {
      const msg = e.message ?? "";
      if (msg.includes("WATCHLIST_LIMIT_REACHED")) {
        return res.status(422).json({ error: msg.replace("WATCHLIST_LIMIT_REACHED: ", "") });
      }
      throw e;
    }
  }

  let ratingsImported = 0;
  let ratingsSkipped = 0;
  let watchlistAdded = 0;
  let watchlistSkipped = 0;

  // Batch insert ratings.
  if (ratings.length > 0) {
    await insertRatingRows(profileId, ratings, conflictMode);
    ratingsImported = ratings.length;
  }

  // Batch insert watchlist items.
  if (watchlistItems.length > 0 && resolvedWatchlistId != null) {
    const bind = [resolvedWatchlistId]; // $1 = watchlistId
    const valueClauses = watchlistItems.map(({ localId, watched }) => {
      const midIdx = bind.length + 1;
      const watchedIdx = bind.length + 2;
      bind.push(localId, watched);
      return `($1, 'movie', $${midIdx}, $${watchedIdx}, now())`;
    });

    const [, insertMeta] = await sequelize.query(
      `INSERT INTO watchlist_item (watchlist_id, media_type, movie_id, watched, added_at)
       VALUES ${valueClauses.join(", ")}
       ON CONFLICT (watchlist_id, movie_id) WHERE movie_id IS NOT NULL
       DO UPDATE SET watched = CASE WHEN EXCLUDED.watched = true THEN true ELSE watchlist_item.watched END`,
      { bind, type: sequelize.QueryTypes.INSERT }
    );

    const affected = insertMeta?.rowCount ?? insertMeta ?? 0;
    watchlistAdded = typeof affected === "number" ? affected : watchlistItems.length;
    watchlistSkipped = watchlistItems.length - watchlistAdded;
  }

  res.json({ ratingsImported, ratingsSkipped, watchlistAdded, watchlistSkipped });
});

// Resolve a single item to a local movie id.
// Prefers Letterboxd URI → TMDB id; falls back to title+year search.
async function resolveItemByTmdbId(tmdbId) {
  const [localRows] = await sequelize.query(
    `SELECT id, tmdb_id, title
     FROM movie
     WHERE deleted_at IS NULL AND tmdb_id = :tmdbId
     LIMIT 1`,
    { replacements: { tmdbId } }
  );

  if (localRows.length > 0) {
    return { localId: Number(localRows[0].id), title: localRows[0].title };
  }

  if (!TMDB_API_KEY) return null;

  try {
    const res = await tmdbRateLimitedFetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`
    );
    if (!res.ok) return null;
    const match = await res.json();

    const row = await fastUpsertMovie({
      source: "tmdb-only",
      type: "movie",
      localId: null,
      tmdbId: match.id,
      title: match.title ?? match.original_title ?? "",
      posterPath: match.poster_path ?? null,
      year: match.release_date?.slice(0, 4) ?? null,
      popularity: match.popularity ?? 0,
      originalTitle: match.original_title ?? match.title ?? "",
      overview: match.overview ?? "",
      releaseDate: match.release_date ?? null,
      originalLanguage: match.original_language ?? null,
      adult: match.adult ?? false,
      tmdbVoteAvg: match.vote_average ?? 0,
      tmdbVoteCount: match.vote_count ?? 0,
    });
    fireIngest(tmdbId);
    return {
      localId: Number(row.id),
      title: match.title ?? match.original_title ?? "",
    };
  } catch {
    return null;
  }
}

async function resolveItemByNameYear(name, year) {
  const pattern = escapePattern(name.trim());
  const yearPrefix = year + "%";

  const [localRows] = await sequelize.query(
    `SELECT id, tmdb_id, title
     FROM movie
     WHERE deleted_at IS NULL
       AND (title ILIKE :pattern OR original_title ILIKE :pattern)
       AND release_date::text LIKE :yearPrefix
     ORDER BY tmdb_popularity DESC
     LIMIT 1`,
    { replacements: { pattern, yearPrefix } }
  );

  if (localRows.length > 0) {
    return { localId: Number(localRows[0].id), title: localRows[0].title };
  }

  if (!TMDB_API_KEY) return null;

  try {
    const params = new URLSearchParams({
      query: name.trim(), year, api_key: TMDB_API_KEY,
      language: "en-US", include_adult: "false",
    });
    const data = await tmdbRateLimitedFetch(
      `https://api.themoviedb.org/3/search/movie?${params}`
    ).then((r) => (r.ok ? r.json() : { results: [] }));

    const results = data.results ?? [];
    const match = results.find((r) => r.release_date?.startsWith(year)) ?? results[0] ?? null;
    if (!match) return null;

    const row = await fastUpsertMovie({
      source: "tmdb-only", type: "movie", localId: null,
      tmdbId: match.id,
      title: match.title ?? match.original_title ?? "",
      posterPath: match.poster_path ?? null,
      year: match.release_date?.slice(0, 4) ?? year,
      popularity: match.popularity ?? 0,
      originalTitle: match.original_title ?? match.title ?? "",
      overview: match.overview ?? "",
      releaseDate: match.release_date ?? null,
      originalLanguage: match.original_language ?? null,
      adult: match.adult ?? false,
      tmdbVoteAvg: match.vote_average ?? 0,
      tmdbVoteCount: match.vote_count ?? 0,
    });
    fireIngest(match.id);
    return {
      localId: Number(row.id),
      title: match.title ?? match.original_title ?? name,
    };
  } catch {
    return null;
  }
}

async function resolveItem(name, year, uri = null) {
  if (uri) {
    const tmdbId = await getTmdbIdFromUri(uri);
    if (tmdbId) {
      const resolved = await resolveItemByTmdbId(tmdbId);
      if (resolved) return resolved;
    }
  }
  return resolveItemByNameYear(name, year);
}

// Fire-and-forget import: validates and creates watchlist synchronously,
// returns 202 immediately, then resolves + commits everything in the background.
router.post("/run", async (req, res) => {
  const {
    ratings = [],
    watchlistItems = [],
    watchlistId: rawWatchlistId,
    newWatchlistName,
    conflictMode,
  } = req.body ?? {};

  const profileId = req.user.id;

  if (!["skip", "overwrite"].includes(conflictMode)) {
    return res.status(400).json({ error: "conflictMode must be 'skip' or 'overwrite'" });
  }

  if (!Array.isArray(ratings) || ratings.length > MAX_ITEMS) {
    return res.status(400).json({ error: `ratings must be an array of at most ${MAX_ITEMS} items` });
  }
  for (const r of ratings) {
    const err = validateRatingItem(r, "ratings[]");
    if (err) return res.status(400).json({ error: err });
  }

  if (!Array.isArray(watchlistItems) || watchlistItems.length > MAX_ITEMS) {
    return res.status(400).json({ error: `watchlistItems must be an array of at most ${MAX_ITEMS} items` });
  }
  for (const w of watchlistItems) {
    const err = validateImportItem(w, "watchlistItems[]");
    if (err) return res.status(400).json({ error: err });
    if (typeof w.watched !== "boolean") {
      return res.status(400).json({ error: "watchlistItems[].watched must be a boolean" });
    }
  }

  if (ratings.length === 0 && watchlistItems.length === 0) {
    return res.status(400).json({ error: "Nothing to import" });
  }

  if (watchlistItems.length > 0 && rawWatchlistId == null && !newWatchlistName?.trim()) {
    return res.status(400).json({ error: "Provide watchlistId or newWatchlistName when importing watchlist items" });
  }

  // Verify or create watchlist synchronously so we can surface tier errors before 202.
  let resolvedWatchlistId = rawWatchlistId != null ? Number(rawWatchlistId) : null;

  if (resolvedWatchlistId != null) {
    if (!isPositiveInt(resolvedWatchlistId)) {
      return res.status(400).json({ error: "watchlistId must be a positive integer" });
    }
    const [ownerRows] = await sequelize.query(
      `SELECT id FROM watchlist WHERE id = :id AND profile_id = :profileId`,
      { replacements: { id: resolvedWatchlistId, profileId } }
    );
    if (ownerRows.length === 0) {
      return res.status(403).json({ error: "Watchlist not found or does not belong to you" });
    }
  }

  if (watchlistItems.length > 0 && resolvedWatchlistId == null && newWatchlistName?.trim()) {
    try {
      const [rows] = await sequelize.query(
        `INSERT INTO watchlist (profile_id, name, created_at, updated_at)
         VALUES (:profileId, :name, now(), now()) RETURNING id`,
        { replacements: { profileId, name: newWatchlistName.trim().slice(0, 100) } }
      );
      resolvedWatchlistId = Number(rows[0].id);
    } catch (e) {
      const msg = e.message ?? "";
      if (msg.includes("WATCHLIST_LIMIT_REACHED")) {
        return res.status(422).json({ error: msg.replace("WATCHLIST_LIMIT_REACHED: ", "") });
      }
      throw e;
    }
  }

  // Return immediately — everything below runs in the background.
  res.status(202).json({ ok: true, total: ratings.length + watchlistItems.length });

  (async () => {
    // Build a per-movie work map so each unique film is resolved exactly once.
    // A film can have a rating, a watchlist entry, or both.
    const itemMap = new Map(); // resolveKey → { name, year, uri, rating?, watchlist? }

    for (const r of ratings) {
      const key = itemResolveKey(r);
      if (!itemMap.has(key)) itemMap.set(key, { name: r.name, year: r.year, uri: r.uri });
      itemMap.get(key).rating = { value: r.value, ratedAt: r.ratedAt };
    }
    for (const w of watchlistItems) {
      const key = itemResolveKey(w);
      if (!itemMap.has(key)) itemMap.set(key, { name: w.name, year: w.year, uri: w.uri });
      const entry = itemMap.get(key);
      // If the same film appears in both watchlist and watched, prefer watched: true.
      if (entry.watchlist) {
        entry.watchlist.watched = entry.watchlist.watched || w.watched;
      } else {
        entry.watchlist = { watched: w.watched };
      }
    }

    // Process each unique film: stub-upsert → commit user data immediately → fire full ingest.
    // Committing per-item means a mid-run crash only loses un-processed tail items.
    for (const [, item] of itemMap) {
      const result = await resolveItem(item.name, item.year, item.uri);
      if (!result) continue;

      const { localId } = result;

      if (item.rating) {
        try {
          await insertRatingRows(profileId, [{ localId, value: item.rating.value, ratedAt: item.rating.ratedAt }], conflictMode);
        } catch (e) {
          console.error("import/run rating insert error:", e.message);
        }
      }

      if (resolvedWatchlistId != null && item.watchlist) {
        try {
          await sequelize.query(
            `INSERT INTO watchlist_item (watchlist_id, media_type, movie_id, watched, added_at)
             VALUES (:wid, 'movie', :mid, :watched, now())
             ON CONFLICT (watchlist_id, movie_id) WHERE movie_id IS NOT NULL
             DO UPDATE SET watched = CASE WHEN EXCLUDED.watched = true THEN true ELSE watchlist_item.watched END`,
            { replacements: { wid: resolvedWatchlistId, mid: localId, watched: item.watchlist.watched } }
          );
        } catch (e) {
          console.error("import/run watchlist insert error:", e.message);
        }
      }
    }
  })().catch((e) => console.error("import/run background error:", e.message));
});

// Return counts of recent inject_movie script log entries (last 24 h).
// Used by Settings to show background sync progress after an import.
router.get("/sync-status", async (req, res) => {
  const [rows] = await sequelize.query(
    `SELECT status, COUNT(*) AS count, MAX(finished_at) AS last_run
     FROM script_logs
     WHERE script_name LIKE 'inject_movie:%'
       AND started_at > NOW() - INTERVAL '24 hours'
     GROUP BY status`,
    { type: sequelize.QueryTypes.SELECT }
  );

  const summary = { success: 0, failure: 0, lastRunAt: null };
  for (const row of rows) {
    const n = Number(row.count);
    if (row.status === "success") { summary.success = n; }
    else if (row.status === "failure") { summary.failure = n; }
    if (row.last_run && (!summary.lastRunAt || row.last_run > summary.lastRunAt)) {
      summary.lastRunAt = row.last_run;
    }
  }
  res.json(summary);
});

// Export all user data as watchpapa CSV format.
// Returns CSV text directly with Content-Disposition header for download.
router.get("/export", async (req, res) => {
  const profileId = req.user.id;

  const [ratingRows] = await sequelize.query(
    `SELECT
       ur.created_at,
       ur.value,
       m.title,
       EXTRACT(YEAR FROM m.release_date)::text AS year
     FROM user_rating ur
     JOIN movie m ON m.id = ur.movie_id
     WHERE ur.profile_id = :profileId
       AND ur.movie_id IS NOT NULL
     ORDER BY ur.created_at DESC`,
    { replacements: { profileId } }
  );

  const [watchlistRows] = await sequelize.query(
    `SELECT
       wi.added_at,
       wi.watched,
       w.name AS watchlist_name,
       m.title,
       EXTRACT(YEAR FROM m.release_date)::text AS year,
       m.id AS movie_id
     FROM watchlist_item wi
     JOIN watchlist w ON w.id = wi.watchlist_id
     JOIN movie m ON m.id = wi.movie_id
     WHERE w.profile_id = :profileId
     ORDER BY wi.added_at DESC`,
    { replacements: { profileId } }
  );

  // Build a map of movie_id → rating value for merging.
  const ratingByTitle = new Map();
  for (const r of ratingRows) {
    ratingByTitle.set(`${r.title}|||${r.year}`, { value: r.value, date: r.created_at });
  }

  const rows = [];
  const seenWatchlistMovies = new Set();

  // Watchlist items (merged with rating if exists).
  for (const w of watchlistRows) {
    const key = `${w.title}|||${w.year}`;
    seenWatchlistMovies.add(key);
    const ratingInfo = ratingByTitle.get(key);
    rows.push({
      date: (w.added_at ?? "").slice(0, 10),
      name: w.title,
      year: w.year ?? "",
      mediaType: "movie",
      watchlistName: w.watchlist_name,
      rating: ratingInfo?.value ?? "",
      watched: w.watched ? "true" : "false",
    });
  }

  // Rating-only rows (not in any watchlist).
  for (const r of ratingRows) {
    const key = `${r.title}|||${r.year}`;
    if (!seenWatchlistMovies.has(key)) {
      rows.push({
        date: (r.created_at ?? "").slice(0, 10),
        name: r.title,
        year: r.year ?? "",
        mediaType: "movie",
        watchlistName: "",
        rating: r.value,
        watched: "",
      });
    }
  }

  function escapeCsvField(v) {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  const header = "Date,Name,Year,MediaType,WatchlistName,Rating,Watched\n";
  const csv = rows
    .map((r) =>
      [r.date, r.name, r.year, r.mediaType, r.watchlistName, r.rating, r.watched]
        .map(escapeCsvField)
        .join(",")
    )
    .join("\n");

  const today = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="watchpapa-export-${today}.csv"`);
  res.send(header + csv);
});

export default router;
