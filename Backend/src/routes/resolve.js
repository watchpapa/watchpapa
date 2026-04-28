import { Router } from "express";
import { tmdbRateLimitedFetch } from "../scripts/tmdb_rate_limited_fetch.js";
import { fastUpsertMovie, fastUpsertShow, fastUpsertPerson } from "../services/searchService.js";
import { ingestMovie } from "../scripts/inject_movie.js";
import { ingestTvShow } from "../scripts/inject_tv_show.js";
import { ingestPerson } from "../scripts/inject_person.js";
import sequelize from "../db/database.js";

const router = Router();
const API_KEY = process.env.TMDB_API_KEY_SECRET;
const BASE = "https://api.themoviedb.org/3";

async function findLocalId(table, tmdbId) {
  const [row] = await sequelize.query(
    `SELECT id FROM ${table} WHERE tmdb_id = :tmdbId AND deleted_at IS NULL LIMIT 1`,
    { replacements: { tmdbId }, type: sequelize.QueryTypes.SELECT }
  );
  return row?.id ?? null;
}

async function resolveMovie(tmdbId) {
  const existing = await findLocalId("movie", tmdbId);
  if (existing != null) return existing;

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
  return row.id;
}

async function resolveShow(tmdbId) {
  const existing = await findLocalId("show", tmdbId);
  if (existing != null) return existing;

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
  return row.id;
}

async function resolvePerson(tmdbId) {
  const existing = await findLocalId("person", tmdbId);
  if (existing != null) return existing;

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
  return row.id;
}

router.post("/", async (req, res) => {
  const { type, tmdbId: raw } = req.body ?? {};
  const tmdbId = Number(raw);
  if (!type || !tmdbId) return res.status(400).json({ error: "type and tmdbId required" });

  try {
    let localId;
    if (type === "movie") localId = await resolveMovie(tmdbId);
    else if (type === "show") localId = await resolveShow(tmdbId);
    else if (type === "person") localId = await resolvePerson(tmdbId);
    else return res.status(400).json({ error: "unknown type" });

    res.json({ localId });

    if (API_KEY) {
      if (type === "movie") ingestMovie({ tmdbId, apiKey: API_KEY, forceRefreshExisting: true }).catch((e) => console.warn(`bg inject movie ${tmdbId}:`, e.message));
      else if (type === "show") ingestTvShow({ tmdbTvId: tmdbId, apiKey: API_KEY, forceRefreshExisting: true }).catch((e) => console.warn(`bg inject show ${tmdbId}:`, e.message));
      else ingestPerson({ tmdbId, apiKey: API_KEY, forceRefreshExisting: true }).catch((e) => console.warn(`bg inject person ${tmdbId}:`, e.message));
    }
  } catch (e) {
    console.error("Resolve error:", e.message);
    res.status(500).json({ error: "resolve failed" });
  }
});

export default router;
