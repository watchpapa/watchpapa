// Used by:
// - Backend/src/scripts/inject_genres.js
// - Backend/src/scripts/inject_jobs_and_departments.js
// - Backend/src/scripts/inject_movie.js
// - Backend/src/scripts/inject_person.js
// - Backend/src/scripts/inject_tv_show.js
// - Backend/src/services/searchService.js


// Normalize string values before saving to database text columns.
export function str(v, maxLen) {
  if (v == null) return "";
  return String(v).slice(0, maxLen);
}

// Normalize optional string values and return null for empty values.
export function strOrNull(v, maxLen) {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s.slice(0, maxLen);
}

// Clamp numeric values into safe ranges for database numeric columns.
export function clampedNum(v, fallback, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

// Same shape as clampedNum but truncates to a safe integer range, intended for
// Postgres bigint columns where the input may be a float or out-of-range value
// from TMDB.
// Clamp and truncate values for database integer/bigint columns.
export function clampedInt(v, fallback, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

// Convert truthy/falsy input into strict boolean value for DB flags.
export function strictBool(v) {
  return v === true;
}

// Validate YYYY-MM-DD values for database date columns.
export function isoDate(v) {
  if (!v || typeof v !== "string") return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null;
}

// Validate language codes for database language fields.
export function isoLang(v) {
  if (!v || typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  return /^[a-z]{2}(-[a-z]{2})?$/.test(s) ? s : null;
}

// Sanitize movie payload values before local database upsert.
export function sanitizeMovie(item) {
  return {
    tmdbId: item.tmdbId,
    title: str(item.title, 500) || str(item.originalTitle, 500) || "Unknown",
    originalTitle: str(item.originalTitle || item.title, 500) || "Unknown",
    posterPath: strOrNull(item.posterPath, 500),
    popularity: clampedNum(item.popularity, 0, 0, 9_999_999),
    overview: str(item.overview, 5000),
    releaseDate: isoDate(item.releaseDate),
    originalLanguage: isoLang(item.originalLanguage),
    adult: strictBool(item.adult),
    tmdbVoteAvg: clampedNum(item.tmdbVoteAvg, 0, 0, 10),
    tmdbVoteCount: clampedNum(item.tmdbVoteCount, 0, 0, 99_999_999),
  };
}

// Sanitize show payload values before local database upsert.
export function sanitizeShow(item) {
  return {
    tmdbId: item.tmdbId,
    title: str(item.title, 500) || str(item.originalName, 500) || "Unknown",
    originalName: str(item.originalName || item.title, 500) || "Unknown",
    posterPath: strOrNull(item.posterPath, 500),
    popularity: clampedNum(item.popularity, 0, 0, 9_999_999),
    overview: str(item.overview, 5000),
    firstAirDate: isoDate(item.firstAirDate),
    originalLanguage: isoLang(item.originalLanguage),
    adult: strictBool(item.adult),
    tmdbVoteAvg: clampedNum(item.tmdbVoteAvg, 0, 0, 10),
    tmdbVoteCount: clampedNum(item.tmdbVoteCount, 0, 0, 99_999_999),
  };
}

// Sanitize person payload values before local database upsert.
export function sanitizePerson(item) {
  return {
    tmdbId: item.tmdbId,
    title: str(item.title, 500) || "Unknown",
    posterPath: strOrNull(item.posterPath, 500),
    popularity: clampedNum(item.popularity, 0, 0, 9_999_999),
    adult: strictBool(item.adult),
  };
}
