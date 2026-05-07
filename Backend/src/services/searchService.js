// Used by:
// - Backend/src/routes/resolve.js
// - Backend/src/routes/search.js
import sequelize from "../db/database.js";
import { tmdbRateLimitedFetch } from "../scripts/tmdb_rate_limited_fetch.js";
import { sanitizeMovie, sanitizeShow, sanitizePerson } from "../lib/sanitizeTmdb.js";


// Escape wildcard characters for safe SQL ILIKE pattern matching.
function escapePattern(q) {
  return "%" + q.replace(/[%_]/g, "\\$&") + "%";
}

// Extract the 4-digit year from a date string.
function yearFrom(dateStr) {
  return typeof dateStr === "string" && dateStr.length >= 4
    ? dateStr.slice(0, 4)
    : null;
}

// Search local database tables for matching movies, shows, and people.
export async function searchLocal(query, perTypeLimit = 5, { includeAdult = false } = {}) {
  const pattern = escapePattern(query);
  const limit = perTypeLimit;
  const adultFilter = includeAdult ? "" : "AND adult = false";

  const [movieRows, showRows, personRows] = await Promise.all([
    sequelize.query(
      `SELECT id, tmdb_id, title, poster_path, tmdb_popularity, release_date
       FROM movie
       WHERE deleted_at IS NULL
         ${adultFilter}
         AND (title ILIKE :pattern OR original_title ILIKE :pattern)
       ORDER BY tmdb_popularity DESC
       LIMIT :limit`,
      { replacements: { pattern, limit }, type: sequelize.QueryTypes.SELECT }
    ),
    sequelize.query(
      `SELECT id, tmdb_id, name, poster_path, tmdb_popularity, first_air_date
       FROM show
       WHERE deleted_at IS NULL
         ${adultFilter}
         AND (name ILIKE :pattern OR original_name ILIKE :pattern)
       ORDER BY tmdb_popularity DESC
       LIMIT :limit`,
      { replacements: { pattern, limit }, type: sequelize.QueryTypes.SELECT }
    ),
    sequelize.query(
      `SELECT * FROM (
         SELECT DISTINCT ON (p.id) p.id, p.tmdb_id, p.name, p.profile_path, p.popularity
         FROM person p
         LEFT JOIN person_aka pa ON pa.person_id = p.id AND pa.deleted_at IS NULL
         WHERE p.deleted_at IS NULL
           ${adultFilter}
           AND (p.name ILIKE :pattern OR pa.nickname ILIKE :pattern)
         ORDER BY p.id, p.popularity DESC
       ) d
       ORDER BY popularity DESC
       LIMIT :limit`,
      { replacements: { pattern, limit }, type: sequelize.QueryTypes.SELECT }
    ),
  ]);

  const movies = (movieRows ?? []).map((r) => ({
    source: "local",
    type: "movie",
    localId: r.id,
    tmdbId: r.tmdb_id,
    title: r.title,
    posterPath: r.poster_path ?? null,
    year: yearFrom(r.release_date),
    popularity: r.tmdb_popularity ?? 0,
  }));

  const shows = (showRows ?? []).map((r) => ({
    source: "local",
    type: "show",
    localId: r.id,
    tmdbId: r.tmdb_id,
    title: r.name,
    posterPath: r.poster_path ?? null,
    year: yearFrom(r.first_air_date),
    popularity: r.tmdb_popularity ?? 0,
  }));

  const people = (personRows ?? []).map((r) => ({
    source: "local",
    type: "person",
    localId: r.id,
    tmdbId: r.tmdb_id,
    title: r.name,
    posterPath: r.profile_path ?? null,
    year: null,
    popularity: r.popularity ?? 0,
  }));

  return [...movies, ...shows, ...people];
}

const PER_TYPE = 15;

// Search TMDB APIs for matching movies, shows, and people.
export async function searchTmdb(query, apiKey, { includeAdult = false } = {}) {
  if (!apiKey) return [];

  const params = new URLSearchParams({
    query,
    api_key: apiKey,
    language: "en-US",
    page: "1",
    include_adult: includeAdult ? "true" : "false",
  });
  const base = "https://api.themoviedb.org/3/search";

  let movieData, tvData, personData;
  try {
    [movieData, tvData, personData] = await Promise.all([
      tmdbRateLimitedFetch(`${base}/movie?${params}`).then((r) =>
        r.ok ? r.json() : { results: [] }
      ),
      tmdbRateLimitedFetch(`${base}/tv?${params}`).then((r) =>
        r.ok ? r.json() : { results: [] }
      ),
      tmdbRateLimitedFetch(`${base}/person?${params}`).then((r) =>
        r.ok ? r.json() : { results: [] }
      ),
    ]);
  } catch {
    return [];
  }

  // Filter out adult records when the request disallows adult content.
  const filterAdult = (results) =>
    includeAdult ? results : results.filter((r) => !r.adult);

  const movies = filterAdult(movieData.results ?? []).slice(0, PER_TYPE).map((r) => ({
    source: "tmdb-only",
    type: "movie",
    localId: null,
    tmdbId: r.id,
    title: r.title ?? r.original_title ?? "",
    posterPath: r.poster_path ?? null,
    year: yearFrom(r.release_date),
    popularity: r.popularity ?? 0,
    originalTitle: r.original_title ?? r.title ?? "",
    overview: r.overview ?? "",
    releaseDate: r.release_date ?? null,
    originalLanguage: r.original_language ?? null,
    adult: r.adult ?? false,
    tmdbVoteAvg: r.vote_average ?? 0,
    tmdbVoteCount: r.vote_count ?? 0,
  }));

  const shows = filterAdult(tvData.results ?? []).slice(0, PER_TYPE).map((r) => ({
    source: "tmdb-only",
    type: "show",
    localId: null,
    tmdbId: r.id,
    title: r.name ?? r.original_name ?? "",
    posterPath: r.poster_path ?? null,
    year: yearFrom(r.first_air_date),
    popularity: r.popularity ?? 0,
    originalName: r.original_name ?? r.name ?? "",
    overview: r.overview ?? "",
    firstAirDate: r.first_air_date ?? null,
    originalLanguage: r.original_language ?? null,
    adult: r.adult ?? false,
    tmdbVoteAvg: r.vote_average ?? 0,
    tmdbVoteCount: r.vote_count ?? 0,
  }));

  const people = filterAdult(personData.results ?? []).slice(0, PER_TYPE).map((r) => ({
    source: "tmdb-only",
    type: "person",
    localId: null,
    tmdbId: r.id,
    title: r.name ?? "",
    posterPath: r.profile_path ?? null,
    year: null,
    popularity: r.popularity ?? 0,
    adult: r.adult ?? false,
  }));

  return [...movies, ...shows, ...people];
}

// Merge local database matches with TMDB-only matches by tmdbId.
export function mergeResults(localResults, tmdbResults) {
  const localTmdbIds = new Set(localResults.map((r) => r.tmdbId));
  const tmdbOnly = tmdbResults.filter((r) => !localTmdbIds.has(r.tmdbId));
  return [...localResults, ...tmdbOnly];
}

// Insert or update a movie row in the local database.
export async function fastUpsertMovie(item) {
  const s = sanitizeMovie(item);
  const [rows] = await sequelize.query(
    `INSERT INTO movie (
       tmdb_id, title, original_title, poster_path, tmdb_popularity,
       overview, release_date, original_language, adult, tmdb_vote_avg, tmdb_vote_count,
       budget, revenue, runtime, status, tagline
     ) VALUES (
       :tmdbId, :title, :originalTitle, :posterPath, :tmdbPopularity,
       :overview, :releaseDate, :originalLanguage, :adult, :tmdbVoteAvg, :tmdbVoteCount,
       0, 0, 0, '', ''
     )
     ON CONFLICT (tmdb_id) DO UPDATE SET
       title             = EXCLUDED.title,
       original_title    = EXCLUDED.original_title,
       poster_path       = COALESCE(EXCLUDED.poster_path, movie.poster_path),
       tmdb_popularity   = EXCLUDED.tmdb_popularity,
       overview          = EXCLUDED.overview,
       release_date      = EXCLUDED.release_date,
       original_language = EXCLUDED.original_language,
       adult             = EXCLUDED.adult,
       tmdb_vote_avg     = EXCLUDED.tmdb_vote_avg,
       tmdb_vote_count   = EXCLUDED.tmdb_vote_count,
       updated_at        = now()
     RETURNING id`,
    {
      replacements: {
        tmdbId: s.tmdbId,
        title: s.title,
        originalTitle: s.originalTitle,
        posterPath: s.posterPath,
        tmdbPopularity: s.popularity,
        overview: s.overview,
        releaseDate: s.releaseDate,
        originalLanguage: s.originalLanguage,
        adult: s.adult,
        tmdbVoteAvg: s.tmdbVoteAvg,
        tmdbVoteCount: s.tmdbVoteCount,
      },
    }
  );
  return rows[0];
}

// Insert or update a show row in the local database.
export async function fastUpsertShow(item) {
  const s = sanitizeShow(item);
  const [rows] = await sequelize.query(
    `INSERT INTO show (
       tmdb_id, name, original_name, poster_path, tmdb_popularity,
       overview, first_air_date, original_language, adult, tmdb_vote_avg, tmdb_vote_count,
       episode_run_time, in_production, last_air_date,
       number_of_episodes, number_of_seasons, status, tagline, type
     ) VALUES (
       :tmdbId, :name, :originalName, :posterPath, :tmdbPopularity,
       :overview, :firstAirDate, :originalLanguage, :adult, :tmdbVoteAvg, :tmdbVoteCount,
       0, false, NULL,
       0, 0, '', '', ''
     )
     ON CONFLICT (tmdb_id) DO UPDATE SET
       name              = EXCLUDED.name,
       original_name     = EXCLUDED.original_name,
       poster_path       = COALESCE(EXCLUDED.poster_path, show.poster_path),
       tmdb_popularity   = EXCLUDED.tmdb_popularity,
       overview          = EXCLUDED.overview,
       first_air_date    = EXCLUDED.first_air_date,
       original_language = EXCLUDED.original_language,
       adult             = EXCLUDED.adult,
       tmdb_vote_avg     = EXCLUDED.tmdb_vote_avg,
       tmdb_vote_count   = EXCLUDED.tmdb_vote_count,
       updated_at        = now()
     RETURNING id`,
    {
      replacements: {
        tmdbId: s.tmdbId,
        name: s.title,
        originalName: s.originalName,
        posterPath: s.posterPath,
        tmdbPopularity: s.popularity,
        overview: s.overview,
        firstAirDate: s.firstAirDate,
        originalLanguage: s.originalLanguage,
        adult: s.adult,
        tmdbVoteAvg: s.tmdbVoteAvg,
        tmdbVoteCount: s.tmdbVoteCount,
      },
    }
  );
  return rows[0];
}

// Insert or update a person row in the local database.
export async function fastUpsertPerson(item) {
  const s = sanitizePerson(item);
  const [rows] = await sequelize.query(
    `INSERT INTO person (
       tmdb_id, name, profile_path, popularity, adult, gender
     ) VALUES (
       :tmdbId, :name, :profilePath, :popularity, :adult, 0
     )
     ON CONFLICT (tmdb_id) DO UPDATE SET
       name         = EXCLUDED.name,
       profile_path = COALESCE(EXCLUDED.profile_path, person.profile_path),
       popularity   = EXCLUDED.popularity,
       adult        = EXCLUDED.adult,
       updated_at   = now()
     RETURNING id`,
    {
      replacements: {
        tmdbId: s.tmdbId,
        name: s.title,
        profilePath: s.posterPath,
        popularity: s.popularity,
        adult: s.adult,
      },
    }
  );
  return rows[0];
}
