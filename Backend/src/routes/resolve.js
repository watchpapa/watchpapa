// Used by:
// - app.js
import { Router } from "express";
import { tmdbRateLimitedFetch } from "../scripts/tmdb_rate_limited_fetch.js";
import { fastUpsertMovie, fastUpsertShow, fastUpsertPerson } from "../services/searchService.js";
import { ingestMovie } from "../scripts/inject_movie.js";
import { ingestTvShow } from "../scripts/inject_tv_show.js";
import { ingestPerson } from "../scripts/inject_person.js";
import { dedupIngest } from "../lib/ingestionQueue.js";
import { logScriptRun } from "../lib/logScriptRun.js";
import sequelize from "../db/database.js";

const router = Router();
const API_KEY = process.env.TMDB_API_KEY_SECRET;
const ALLOWED_TYPES = new Set(["movie", "show", "person"]);
const ALLOWED_KEYS = new Set(["type", "tmdbId"]);
const BASE = "https://api.themoviedb.org/3";

// Find an existing local database id by tmdb_id for a table.
async function findLocalId(table, tmdbId) {
  const [row] = await sequelize.query(
    `SELECT id FROM ${table} WHERE tmdb_id = :tmdbId AND deleted_at IS NULL LIMIT 1`,
    { replacements: { tmdbId }, type: sequelize.QueryTypes.SELECT }
  );
  return row?.id ?? null;
}

// Resolve a movie local id by reusing or upserting a database row.
async function resolveMovie(tmdbId) {
  const existing = await findLocalId("movie", tmdbId);
  if (existing != null) return { localId: existing, wasExisting: true };

  const res = await tmdbRateLimitedFetch(`${BASE}/movie/${tmdbId}?api_key=${API_KEY}&language=en-US`);
  if (!res.ok) throw new Error(`TMDB movie ${tmdbId}: ${res.status}`);
  const r = await res.json();

  const row = await fastUpsertMovie({
    tmdbId: r.id,
    title: r.title ?? r.original_title ?? "",
    originalTitle: r.original_title ?? r.title ?? "",
    posterPath: r.poster_path ?? null,
    popularity: r.popularity ?? 0,
    overview: r.overview ?? "",
    releaseDate: r.release_date ?? null,
    originalLanguage: r.original_language ?? null,
    adult: r.adult ?? false,
    tmdbVoteAvg: r.vote_average ?? 0,
    tmdbVoteCount: r.vote_count ?? 0,
  });
  return { localId: row.id, wasExisting: false };
}

// Resolve a show local id by reusing or upserting a database row.
async function resolveShow(tmdbId) {
  const existing = await findLocalId("show", tmdbId);
  if (existing != null) return { localId: existing, wasExisting: true };

  const res = await tmdbRateLimitedFetch(`${BASE}/tv/${tmdbId}?api_key=${API_KEY}&language=en-US`);
  if (!res.ok) throw new Error(`TMDB show ${tmdbId}: ${res.status}`);
  const r = await res.json();

  const row = await fastUpsertShow({
    tmdbId: r.id,
    title: r.name ?? r.original_name ?? "",
    originalName: r.original_name ?? r.name ?? "",
    posterPath: r.poster_path ?? null,
    popularity: r.popularity ?? 0,
    overview: r.overview ?? "",
    firstAirDate: r.first_air_date ?? null,
    originalLanguage: r.original_language ?? null,
    adult: r.adult ?? false,
    tmdbVoteAvg: r.vote_average ?? 0,
    tmdbVoteCount: r.vote_count ?? 0,
  });
  return { localId: row.id, wasExisting: false };
}

// Resolve a person local id by reusing or upserting a database row.
async function resolvePerson(tmdbId) {
  const existing = await findLocalId("person", tmdbId);
  if (existing != null) return { localId: existing, wasExisting: true };

  const res = await tmdbRateLimitedFetch(`${BASE}/person/${tmdbId}?api_key=${API_KEY}&language=en-US`);
  if (!res.ok) throw new Error(`TMDB person ${tmdbId}: ${res.status}`);
  const r = await res.json();

  const row = await fastUpsertPerson({
    tmdbId: r.id,
    title: r.name ?? "",
    posterPath: r.profile_path ?? null,
    popularity: r.popularity ?? 0,
    adult: r.adult ?? false,
  });
  return { localId: row.id, wasExisting: false };
}

// Validate resolve input and return the matching local database id.
router.post("/", async (req, res) => {
  const body = req.body ?? {};
  const extraKeys = Object.keys(body).filter((k) => !ALLOWED_KEYS.has(k));
  if (extraKeys.length > 0) {
    return res.status(400).json({ error: `Unknown fields: ${extraKeys.join(", ")}` });
  }

  const { type, tmdbId: raw } = body;
  const tmdbId = Number(raw);
  if (!ALLOWED_TYPES.has(type) || !Number.isInteger(tmdbId) || tmdbId <= 0 || tmdbId > 9_999_999) {
    return res.status(400).json({ error: "type must be movie|show|person and tmdbId must be a positive integer" });
  }

  try {
    let localId;
    let wasExisting = false;
    if (type === "movie") {
      const resolved = await resolveMovie(tmdbId);
      localId = resolved.localId;
      wasExisting = resolved.wasExisting;
    } else if (type === "show") {
      const resolved = await resolveShow(tmdbId);
      localId = resolved.localId;
      wasExisting = resolved.wasExisting;
    } else if (type === "person") {
      const resolved = await resolvePerson(tmdbId);
      localId = resolved.localId;
      wasExisting = resolved.wasExisting;
    } else return res.status(400).json({ error: "unknown type" });

    res.json({ localId });

    if (API_KEY && !wasExisting) {
      if (type === "movie") {
        dedupIngest(`movie:${tmdbId}`, async () => {
          const startedAt = new Date();
          const scriptName = `inject_movie:${tmdbId}`;
          try {
            const result = await ingestMovie({ tmdbId, apiKey: API_KEY, forceRefreshExisting: true });
            await logScriptRun({ scriptName, status: "success", batchSize: (result?.castLinked ?? 0) + (result?.crewLinked ?? 0), startedAt });
          } catch (e) {
            await logScriptRun({ scriptName, status: "failure", errorCode: e?.name, errorDetail: e?.message, startedAt });
            throw e;
          }
        }).catch((e) => console.warn(`bg inject movie ${tmdbId}:`, e.message));
      } else if (type === "show") {
        dedupIngest(`show:${tmdbId}`, async () => {
          const startedAt = new Date();
          const scriptName = `inject_tv_show:${tmdbId}`;
          try {
            const result = await ingestTvShow({ tmdbTvId: tmdbId, apiKey: API_KEY, forceRefreshExisting: true });
            await logScriptRun({ scriptName, status: "success", batchSize: result?.creditsLinked ?? null, startedAt });
          } catch (e) {
            await logScriptRun({ scriptName, status: "failure", errorCode: e?.name, errorDetail: e?.message, startedAt });
            throw e;
          }
        }).catch((e) => console.warn(`bg inject show ${tmdbId}:`, e.message));
      } else if (type === "person") {
        dedupIngest(`person:${tmdbId}`, async () => {
          const startedAt = new Date();
          const scriptName = `inject_person:${tmdbId}`;
          try {
            await ingestPerson({ tmdbId, apiKey: API_KEY, forceRefreshExisting: true });
            await logScriptRun({ scriptName, status: "success", batchSize: 1, startedAt });
          } catch (e) {
            await logScriptRun({ scriptName, status: "failure", errorCode: e?.name, errorDetail: e?.message, startedAt });
            throw e;
          }
        }).catch((e) => console.warn(`bg inject person ${tmdbId}:`, e.message));
      }
    }
  } catch (e) {
    console.error("Resolve error:", e.message);
    res.status(500).json({ error: "resolve failed" });
  }
});

export default router;
