// Shared builder for every TMDB /discover/{movie,tv} call: the coming-soon rows,
// the "Available on your services" row, the discover-backed popular/top-rated list
// kinds (see tmdb/lists.js), and the standalone /api/content/discover/:type route.
// Centralizing this keeps NSFW exclusion, adult forwarding, and provider params
// consistent everywhere discover is used.

import { withoutKeywordsParam } from "./nsfw.js";
import { TTL } from "./lists.js";
import { tmdbFetch } from "./client.js";
import { toCard } from "./normalize.js";
import { filterNsfw } from "./nsfw.js";

const PROVIDER_ID_RE = /^\d+(\|\d+)*$/;
const MONETIZATION_VALUES = new Set(["flatrate", "free", "ads", "rent", "buy"]);
const REGION_RE = /^[A-Z]{2}$/;

// "8|337" -> [8, 337], capped at 50 ids, invalid -> [].
export function parseProviderIds(raw) {
  if (!raw || !PROVIDER_ID_RE.test(raw)) return [];
  return raw
    .split("|")
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 50);
}

// "flatrate|ads" -> "flatrate|ads" (only known values kept); "" when nothing valid.
export function parseMonetization(raw) {
  if (!raw) return "";
  return raw
    .split("|")
    .filter((v) => MONETIZATION_VALUES.has(v))
    .join("|");
}

export function isValidRegion(raw) {
  return typeof raw === "string" && REGION_RE.test(raw);
}

// { type, page, locale, withGenres, upcoming, extraParams, providerIds, watchRegion,
//   monetization, today } -> TMDB discover query params (deterministic key order).
export function discoverParams({
  type,
  page = 1,
  locale,
  withGenres,
  upcoming = false,
  extraParams = {},
  providerIds = [],
  watchRegion,
  monetization,
  today = new Date().toISOString().slice(0, 10),
}) {
  const params = {
    page,
    include_adult: locale.includeAdult,
    sort_by: extraParams.sort_by ?? "popularity.desc",
    with_genres: withGenres || undefined,
    ...extraParams,
  };
  if (type === "movie" && locale.region) params.region = locale.region;
  if (!locale.includeAdult) params.without_keywords = withoutKeywordsParam();

  if (upcoming) {
    if (type === "movie") {
      // With a region set, use the plain release-date window so it lines up with the
      // regional dates we surface elsewhere; otherwise fall back to TMDB's primary date.
      if (locale.region) params["release_date.gte"] = today;
      else params["primary_release_date.gte"] = today;
      params.with_release_type = "2|3"; // theatrical / theatrical-limited
    } else {
      params["first_air_date.gte"] = today;
    }
  }

  if (providerIds.length > 0 && watchRegion) {
    params.with_watch_providers = providerIds.join("|");
    params.watch_region = watchRegion;
    if (monetization) params.with_watch_monetization_types = monetization;
  }

  return params;
}

// Runs a discover call and shapes the result the same way /list/:kind and
// /discover/:type both return it.
export async function runDiscover(env, type, params, locale) {
  const raw = await tmdbFetch(env, `/discover/${type}`, params, {
    ttl: TTL.discover,
    language: locale.language,
  });
  const cardType = type === "tv" ? "show" : "movie";
  let results = raw.results ?? [];
  results = filterNsfw(results, locale.includeAdult, type === "tv" ? "tv" : "movie");
  return {
    page: raw.page ?? params.page ?? 1,
    total_pages: raw.total_pages ?? 1,
    results: results.map((r) => toCard(cardType, r, { native: locale.native, region: locale.region })),
  };
}
