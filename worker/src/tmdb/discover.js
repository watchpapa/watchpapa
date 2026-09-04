// Shared builder for every TMDB /discover/{movie,tv} call: the coming-soon rows,
// the "Available on your services" row, the discover-backed popular/top-rated list
// kinds (see tmdb/lists.js), and the standalone /api/content/discover/:type route.
// Centralizing this keeps NSFW exclusion, adult forwarding, and provider params
// consistent everywhere discover is used.

import { withoutKeywordsParam, withKeywordsParam } from "./nsfw.js";
import { TTL } from "./lists.js";
import { tmdbFetch } from "./client.js";
import { toCard } from "./normalize.js";
import { filterNsfw } from "./nsfw.js";
import { config } from "../env.js";

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

// User-facing sort keys for the standalone /discover/:type route (the /adult
// page's sort control). Mapped to TMDB sort_by per media type; "rated" also
// adds a vote_count floor so a title with two 10/10 votes doesn't top the list.
const DISCOVER_SORTS = {
  popular: { movie: "popularity.desc", tv: "popularity.desc" },
  rated: { movie: "vote_average.desc", tv: "vote_average.desc", minVotes: 20 },
  newest: { movie: "primary_release_date.desc", tv: "first_air_date.desc" },
};

// "rated" -> "rated"; unknown/empty -> null (caller keeps the default sort).
export function parseDiscoverSort(raw) {
  return raw && Object.hasOwn(DISCOVER_SORTS, raw) ? raw : null;
}

// { type, page, locale, withGenres, upcoming, extraParams, providerIds, watchRegion,
//   monetization, adultOnly, keywordIds, sort, today } -> TMDB discover query params
//   (deterministic key order).
//
// adultOnly flips the NSFW keyword filter from exclusion to inclusion
// (`with_keywords` = the curated set, or just `keywordIds` — a validated subset
// — for one category). discoverParams still adds its own `without_keywords`
// whenever include_adult is off, and since both carry ids from the same set that
// collapses to zero matches: an adult-only request is naturally empty unless the
// caller already has adult content on. No separate gate needed.
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
  adultOnly = false,
  keywordIds = null,
  sort = null,
  today = new Date().toISOString().slice(0, 10),
}) {
  const sortSpec = sort ? DISCOVER_SORTS[sort] : null;
  const params = {
    page,
    include_adult: locale.includeAdult,
    sort_by: extraParams.sort_by ?? sortSpec?.[type] ?? "popularity.desc",
    with_genres: withGenres || undefined,
    ...extraParams,
  };
  if (sortSpec?.minVotes) params["vote_count.gte"] = sortSpec.minVotes;
  if (type === "movie" && locale.region) params.region = locale.region;
  if (adultOnly) params.with_keywords = keywordIds ?? withKeywordsParam();
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

// TMDB's list/discover/recommendations endpoints never return a show's `status`
// (or `in_production`/`last_air_date`) — those only exist on the full detail
// payload. Without `status`, lib/followGate.js's showFollowBlock() on the
// frontend can't tell an ended/canceled show from an active one, so "Follow"
// stays clickable even on something like Better Call Saul. Backfill it with one
// extra `/tv/{id}` lookup per card missing it — edge-cached at TTL.show, so
// after the first cold hit for a given (popular) title it's effectively free.
// Mutates `cards` in place; capped by `maxChecks` to stay inside the Worker's
// per-request subrequest budget. `idKey` lets callers whose cards key the
// tmdb id under a different property (search results use `tmdbId`, not `id`)
// reuse this without reshaping their objects first.
export async function backfillShowStatus(env, cards, language, maxChecks, idKey = "id") {
  const targets = cards.filter((c) => c.type === "show" && c.status == null).slice(0, maxChecks);
  if (targets.length === 0) return;
  const details = await Promise.all(
    targets.map((c) => tmdbFetch(env, `/tv/${c[idKey]}`, {}, { ttl: TTL.show, language }).catch(() => null)),
  );
  const byId = new Map(targets.map((c, i) => [c[idKey], details[i]]));
  for (const c of cards) {
    const raw = byId.get(c[idKey]);
    if (!raw) continue;
    c.status = raw.status ?? null;
    c.in_production = raw.in_production ?? null;
    c.last_air_date = raw.last_air_date || null;
  }
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
  const cards = results.map((r) => toCard(cardType, r, { native: locale.native, region: locale.region }));
  if (cardType === "show") {
    await backfillShowStatus(env, cards, locale.language, config(env).showStatusBackfillMax);
  }
  return {
    page: raw.page ?? params.page ?? 1,
    total_pages: raw.total_pages ?? 1,
    results: cards,
  };
}
