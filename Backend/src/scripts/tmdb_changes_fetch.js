import { tmdbRateLimitedFetch } from "./tmdb_rate_limited_fetch.js";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_PAGE_SIZE = 20;

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function parseOptionalDate(raw, flagName) {
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error(`Invalid ${flagName} value "${raw}". Expected YYYY-MM-DD.`);
  }
  return raw;
}

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

export async function fetchChangedMovieIds(options) {
  return fetchChangedTmdbIds({ ...options, entityPath: "movie" });
}

export async function fetchChangedTvShowIds(options) {
  return fetchChangedTmdbIds({ ...options, entityPath: "tv" });
}

export async function fetchChangedPersonIds(options) {
  return fetchChangedTmdbIds({ ...options, entityPath: "person" });
}
