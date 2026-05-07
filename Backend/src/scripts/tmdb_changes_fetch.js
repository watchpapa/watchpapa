import { tmdbRateLimitedFetch } from "./tmdb_rate_limited_fetch.js";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_PAGE_SIZE = 100;

// Convert a Date object to a YYYY-MM-DD string.
function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

// Validate an optional date flag and return it when present.
function parseOptionalDate(raw, flagName) {
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error(`Invalid ${flagName} value "${raw}". Expected YYYY-MM-DD.`);
  }
  return raw;
}

// Resolve a default or user-provided 24-hour date window.
export function resolve24hDateWindow({ startDate, endDate } = {}) {
  const parsedStart = parseOptionalDate(startDate, "--start-date");
  const parsedEnd = parseOptionalDate(endDate, "--end-date");
  if (parsedStart && parsedEnd && parsedStart > parsedEnd) {
    throw new Error(
      `Invalid date range: --start-date=${parsedStart} is after --end-date=${parsedEnd}.`
    );
  }
  if (parsedStart || parsedEnd) {
    return {
      startDate: parsedStart ?? parsedEnd,
      endDate: parsedEnd ?? parsedStart,
    };
  }

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return {
    startDate: toIsoDate(yesterday),
    endDate: toIsoDate(now),
  };
}

// Fetch one page of changed entity ids from TMDB.
async function fetchChangesPage({
  apiKey,
  entityPath,
  page,
  startDate,
  endDate,
}) {
  const url = new URL(`${TMDB_BASE_URL}/${entityPath}/changes`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("page", String(page));
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);

  const response = await tmdbRateLimitedFetch(url, {
    method: "GET",
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    const errorText = await response.text();
    const err = new Error(
      `TMDB ${entityPath} changes request failed: ${response.status} ${response.statusText} - ${errorText}`
    );
    err.status = response.status;
    throw err;
  }

  const payload = await response.json();
  return {
    results: Array.isArray(payload?.results) ? payload.results : [],
    totalPages: Number.isFinite(payload?.total_pages) ? payload.total_pages : 1,
  };
}

// Fetch changed TMDB ids for an entity type within a date window.
export async function fetchChangedTmdbIds({
  apiKey,
  entityPath,
  startDate,
  endDate,
  limit,
}) {
  if (typeof limit !== "number" || !Number.isFinite(limit) || limit <= 0) {
    throw new Error("fetchChangedTmdbIds requires a positive numeric `limit`.");
  }

  const targetPages = Math.max(1, Math.ceil(limit / TMDB_PAGE_SIZE));
  const out = [];
  const seen = new Set();
  let page = 1;
  let maxPages = targetPages;

  while (page <= maxPages && out.length < limit) {
    const { results, totalPages } = await fetchChangesPage({
      apiKey,
      entityPath,
      page,
      startDate,
      endDate,
    });
    maxPages = Math.min(Math.max(targetPages, 1), Math.max(totalPages, 1));

    for (const row of results) {
      const tmdbId = row?.id;
      if (!Number.isFinite(tmdbId) || seen.has(tmdbId)) continue;
      seen.add(tmdbId);
      out.push(tmdbId);
      if (out.length >= limit) break;
    }

    page += 1;
  }

  return out;
}

// Fetch changed movie ids within a date window.
export async function fetchChangedMovieIds(options) {
  return fetchChangedTmdbIds({ ...options, entityPath: "movie" });
}

// Fetch changed TV show ids within a date window.
export async function fetchChangedTvShowIds(options) {
  return fetchChangedTmdbIds({ ...options, entityPath: "tv" });
}

// Fetch changed person ids within a date window.
export async function fetchChangedPersonIds(options) {
  return fetchChangedTmdbIds({ ...options, entityPath: "person" });
}

/**
 * Fetches the per-entity changes payload (`/{entityPath}/{tmdbId}/changes`)
 * which lists which fields changed for that single entity in the given window.
 *
 * Returns `{ changes }` where `changes` is the raw TMDB array of `{ key, items }`.
 * Returns an empty array on 404 (entity not found / no changes).
 */
// Fetch raw field-level changes for a single TMDB entity.
export async function fetchTmdbEntityChanges({
  apiKey,
  entityPath,
  tmdbId,
  startDate,
  endDate,
}) {
  if (typeof tmdbId !== "number" || !Number.isFinite(tmdbId)) {
    throw new Error("fetchTmdbEntityChanges requires a numeric `tmdbId`.");
  }
  if (typeof entityPath !== "string" || !entityPath) {
    throw new Error("fetchTmdbEntityChanges requires a non-empty `entityPath`.");
  }

  const url = new URL(`${TMDB_BASE_URL}/${entityPath}/${tmdbId}/changes`);
  url.searchParams.set("api_key", apiKey);
  if (startDate) url.searchParams.set("start_date", startDate);
  if (endDate) url.searchParams.set("end_date", endDate);

  const response = await tmdbRateLimitedFetch(url, {
    method: "GET",
    headers: { accept: "application/json" },
  });

  if (response.status === 404) return { changes: [] };

  if (!response.ok) {
    const errorText = await response.text();
    const err = new Error(
      `TMDB ${entityPath}/${tmdbId}/changes request failed: ${response.status} ${response.statusText} - ${errorText}`
    );
    err.status = response.status;
    throw err;
  }

  const payload = await response.json();
  return {
    changes: Array.isArray(payload?.changes) ? payload.changes : [],
  };
}

// Extract unique change keys from a TMDB changes payload.
export function extractChangeKeys(changes) {
  const keys = new Set();
  if (!Array.isArray(changes)) return keys;
  for (const change of changes) {
    if (change && typeof change.key === "string" && change.key) {
      keys.add(change.key);
    }
  }
  return keys;
}

const MOVIE_KEY_CATEGORIES = Object.freeze({
  details: new Set([
    "title",
    "original_title",
    "overview",
    "tagline",
    "runtime",
    "status",
    "release_date",
    "release_dates",
    "original_language",
    "adult",
    "budget",
    "revenue",
    "poster_path",
    "popularity",
    "homepage",
    "imdb_id",
    "video",
  ]),
  genres: new Set(["genres"]),
  credits: new Set(["cast", "crew"]),
});

const TV_KEY_CATEGORIES = Object.freeze({
  details: new Set([
    "name",
    "original_name",
    "overview",
    "tagline",
    "episode_run_time",
    "first_air_date",
    "in_production",
    "last_air_date",
    "languages",
    "networks",
    "number_of_episodes",
    "number_of_seasons",
    "origin_country",
    "original_language",
    "popularity",
    "poster_path",
    "production_companies",
    "production_countries",
    "spoken_languages",
    "status",
    "type",
    "homepage",
    "adult",
  ]),
  genres: new Set(["genres"]),
  credits: new Set(["cast", "crew", "created_by"]),
  seasons: new Set(["season", "season_regular", "season_number"]),
  episodes: new Set(["episode", "episode_number"]),
});

const PERSON_KEY_CATEGORIES = Object.freeze({
  details: new Set([
    "name",
    "biography",
    "birthday",
    "deathday",
    "gender",
    "homepage",
    "place_of_birth",
    "popularity",
    "profile_path",
    "known_for_department",
    "imdb_id",
    "adult",
  ]),
  aka: new Set(["also_known_as"]),
});

// Merge all category key sets into a single lookup set.
function unionCategorySets(categories) {
  const all = new Set();
  for (const set of Object.values(categories)) {
    for (const k of set) all.add(k);
  }
  return all;
}

// Check whether any extracted key appears in a candidate set.
function hasAnyKey(keys, candidates) {
  for (const k of keys) {
    if (candidates.has(k)) return true;
  }
  return false;
}

// Map extracted keys to a category-based refresh classification.
function classifyKeysAgainstCategories(keys, categories) {
  const allRecognized = unionCategorySets(categories);
  const fullScope = {};
  for (const cat of Object.keys(categories)) fullScope[cat] = true;

  if (keys.size === 0) {
    const empty = {};
    for (const cat of Object.keys(categories)) empty[cat] = false;
    return { fullSync: false, hasChanges: false, scope: empty };
  }

  let unrecognized = false;
  for (const k of keys) {
    if (!allRecognized.has(k)) {
      unrecognized = true;
      break;
    }
  }

  if (unrecognized) {
    return { fullSync: true, hasChanges: true, scope: fullScope };
  }

  const scope = {};
  for (const [cat, set] of Object.entries(categories)) {
    scope[cat] = hasAnyKey(keys, set);
  }
  return { fullSync: false, hasChanges: true, scope };
}

/**
 * Classifies a movie's per-entity changes payload into a refresh scope.
 *
 * Movies are treated as a single coupled unit: cast/crew credits MUST always
 * be re-fetched together with the movie row whenever anything changes. There
 * is no scenario where we refresh a movie's overview without also re-syncing
 * its credits, because the user requires credits and the parent object to
 * stay in sync. We therefore collapse any detected change into a full sync.
 */
// Classify movie changes into a safe refresh strategy.
export function classifyMovieChanges(changes) {
  const keys = extractChangeKeys(changes);
  const base = classifyKeysAgainstCategories(keys, MOVIE_KEY_CATEGORIES);
  if (!base.hasChanges) return base;

  return {
    fullSync: true,
    hasChanges: true,
    scope: {
      details: true,
      genres: true,
      credits: true,
    },
  };
}

/**
 * Classifies a person's per-entity changes payload into a refresh scope.
 *
 * People have no associated credits in this scope (credits are always owned by
 * the movie/show side), so granular `details` / `aka` flags can stay decoupled.
 */
// Classify person changes into a refresh scope.
export function classifyPersonChanges(changes) {
  const keys = extractChangeKeys(changes);
  return classifyKeysAgainstCategories(keys, PERSON_KEY_CATEGORIES);
}

const FULL_TV_SCOPE = Object.freeze({
  details: true,
  genres: true,
  credits: true,
  seasons: true,
  episodes: true,
  episodeCredits: true,
});

const EMPTY_TV_SCOPE = Object.freeze({
  details: false,
  genres: false,
  credits: false,
  seasons: false,
  episodes: false,
  episodeCredits: false,
});

const TARGETED_EPISODES_SCOPE = Object.freeze({
  details: false,
  genres: false,
  credits: false,
  seasons: false,
  episodes: true,
  episodeCredits: true,
});

/**
 * Classifies a TV show's per-entity changes payload into a refresh scope.
 *
 * Credits MUST always travel together with their parent entity (per product
 * requirement), so granularity is restricted to two well-defined cases:
 *
 *   1. **Targeted episode refresh** — when the ONLY detected changes are
 *      `episode` items that carry parsable season/episode numbers, we refresh
 *      just those episodes (and their per-episode credits) without touching
 *      the show row, show credits, seasons, or other episodes.
 *
 *   2. **Full sync** — any other detected change (show details, genres, show
 *      credits, season-level keys, or `episode` keys without usable
 *      identifiers) triggers a full refresh of the show + show credits +
 *      every season and every episode (with their credits). This guarantees
 *      cast/crew never drifts out of sync with the parent entity.
 *
 * Returns:
 *   - `{ fullSync, hasChanges, scope, targetedEpisodes }`
 *   - `targetedEpisodes` is `null` unless the targeted-episode path applied;
 *     when applied it lists `[{ seasonNumber, episodeNumber, episodeTmdbId }]`.
 */
// Classify TV changes into full, scoped, or targeted episode refresh.
export function classifyTvChanges(changes) {
  const keys = extractChangeKeys(changes);
  const base = classifyKeysAgainstCategories(keys, TV_KEY_CATEGORIES);

  if (!base.hasChanges) {
    return {
      fullSync: false,
      hasChanges: false,
      scope: { ...EMPTY_TV_SCOPE },
      targetedEpisodes: null,
    };
  }

  const targetedEpisodes = tryExtractTargetedEpisodes(base, keys, changes);
  if (targetedEpisodes && targetedEpisodes.length > 0) {
    return {
      fullSync: false,
      hasChanges: true,
      scope: { ...TARGETED_EPISODES_SCOPE },
      targetedEpisodes,
    };
  }

  return {
    fullSync: true,
    hasChanges: true,
    scope: { ...FULL_TV_SCOPE },
    targetedEpisodes: null,
  };
}

// Extract targeted episode coordinates when only episode-level changes exist.
function tryExtractTargetedEpisodes(base, keys, changes) {
  if (base.fullSync) return null;
  if (!base.scope.episodes) return null;
  if (
    base.scope.seasons ||
    base.scope.details ||
    base.scope.genres ||
    base.scope.credits
  ) {
    return null;
  }

  for (const k of keys) {
    if (!TV_KEY_CATEGORIES.episodes.has(k)) return null;
  }

  const collected = [];
  let saw = false;
  for (const change of changes) {
    if (!change || typeof change.key !== "string") continue;
    if (!TV_KEY_CATEGORIES.episodes.has(change.key)) continue;
    const items = Array.isArray(change.items) ? change.items : [];
    if (items.length === 0) return null;
    saw = true;
    for (const item of items) {
      const value = item?.value ?? {};
      const seasonNumber = Number(value?.season_number);
      const episodeNumber = Number(value?.episode_number);
      const episodeTmdbId = Number(value?.episode_id ?? value?.id);
      if (
        !Number.isFinite(seasonNumber) ||
        seasonNumber <= 0 ||
        !Number.isFinite(episodeNumber) ||
        episodeNumber <= 0
      ) {
        return null;
      }
      collected.push({
        seasonNumber,
        episodeNumber,
        episodeTmdbId:
          Number.isFinite(episodeTmdbId) && episodeTmdbId > 0
            ? episodeTmdbId
            : null,
      });
    }
  }

  if (!saw || collected.length === 0) return null;

  const seen = new Set();
  const deduped = [];
  for (const ep of collected) {
    const key = `${ep.seasonNumber}|${ep.episodeNumber}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(ep);
  }
  return deduped;
}

export const TV_CHANGE_CATEGORIES = TV_KEY_CATEGORIES;
export const MOVIE_CHANGE_CATEGORIES = MOVIE_KEY_CATEGORIES;
export const PERSON_CHANGE_CATEGORIES = PERSON_KEY_CATEGORIES;
