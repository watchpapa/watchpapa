import { Hono } from "hono";
import { config } from "../env.js";
import { tmdbFetch, tmdbFetchAllSettled, TmdbNotFound } from "../tmdb/client.js";
import { LIST_KINDS, TTL } from "../tmdb/lists.js";
import { readLocale } from "../tmdb/locale.js";
import {
  discoverParams,
  runDiscover,
  parseProviderIds,
  parseMonetization,
  isValidRegion,
} from "../tmdb/discover.js";
import { filterNsfw, isNsfw } from "../tmdb/nsfw.js";
import {
  normalizeMovie,
  normalizeShow,
  normalizeSeason,
  normalizeEpisode,
  normalizePerson,
  toCard,
} from "../tmdb/normalize.js";

export const content = new Hono();

const cache = (ttl) => ({ "Cache-Control": `public, s-maxage=${ttl}, max-age=60` });

function posInt(raw) {
  const n = Number.parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}
function nonNegInt(raw) {
  const n = Number.parseInt(raw, 10);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

// --- detail endpoints -------------------------------------------------------

content.get("/movie/:id", async (c) => {
  const id = posInt(c.req.param("id"));
  if (!id) return c.json({ error: "Bad id" }, 400);
  const loc = readLocale(c);
  const raw = await tmdbFetch(
    c.env,
    `/movie/${id}`,
    { append_to_response: "credits,release_dates,keywords,watch/providers" },
    { ttl: TTL.movie, language: loc.language },
  );
  const out = normalizeMovie(raw, { native: loc.native, region: loc.region });

  // TMDB has no fallback for `overview`/`tagline` — a missing translation comes back
  // as "". One extra (edge-cached) en-US fetch fills it in, same append set as the
  // batch route so it shares that cache entry.
  if (loc.language !== "en-US" && !out.overview) {
    try {
      const enRaw = await tmdbFetch(
        c.env,
        `/movie/${id}`,
        { append_to_response: "release_dates,keywords" },
        { ttl: TTL.movie, language: "en-US" },
      );
      out.overview = enRaw.overview ?? "";
      out.tagline = enRaw.tagline ?? "";
      if (out.overview) out.overview_fallback = "en-US";
    } catch {
      /* non-fatal — leave overview empty */
    }
  }
  return c.json(out, 200, cache(TTL.movie));
});

content.get("/show/:id", async (c) => {
  const id = posInt(c.req.param("id"));
  if (!id) return c.json({ error: "Bad id" }, 400);
  const loc = readLocale(c);
  const raw = await tmdbFetch(
    c.env,
    `/tv/${id}`,
    { append_to_response: "aggregate_credits,keywords,watch/providers" },
    { ttl: TTL.show, language: loc.language },
  );
  const out = normalizeShow(raw, { native: loc.native, region: loc.region });

  if (loc.language !== "en-US" && !out.overview) {
    try {
      const enRaw = await tmdbFetch(
        c.env,
        `/tv/${id}`,
        { append_to_response: "keywords" },
        { ttl: TTL.show, language: "en-US" },
      );
      out.overview = enRaw.overview ?? "";
      out.tagline = enRaw.tagline ?? "";
      if (out.overview) out.overview_fallback = "en-US";
    } catch {
      /* non-fatal */
    }
  }
  return c.json(out, 200, cache(TTL.show));
});

content.get("/show/:id/season/:n", async (c) => {
  const id = posInt(c.req.param("id"));
  const n = nonNegInt(c.req.param("n"));
  if (!id || n === null) return c.json({ error: "Bad id" }, 400);
  const loc = readLocale(c);
  const raw = await tmdbFetch(c.env, `/tv/${id}/season/${n}`, {}, { ttl: TTL.season, language: loc.language });
  return c.json(normalizeSeason(raw, id), 200, cache(TTL.season));
});

content.get("/show/:id/season/:n/episode/:m", async (c) => {
  const id = posInt(c.req.param("id"));
  const n = nonNegInt(c.req.param("n"));
  const m = posInt(c.req.param("m"));
  if (!id || n === null || !m) return c.json({ error: "Bad id" }, 400);
  const loc = readLocale(c);
  const raw = await tmdbFetch(
    c.env,
    `/tv/${id}/season/${n}/episode/${m}`,
    { append_to_response: "credits" },
    { ttl: TTL.episode, language: loc.language },
  );
  return c.json(normalizeEpisode(raw, id), 200, cache(TTL.episode));
});

content.get("/person/:id", async (c) => {
  const id = posInt(c.req.param("id"));
  if (!id) return c.json({ error: "Bad id" }, 400);
  const loc = readLocale(c);
  const raw = await tmdbFetch(
    c.env,
    `/person/${id}`,
    { append_to_response: "combined_credits" },
    { ttl: TTL.person, language: loc.language },
  );
  return c.json(normalizePerson(raw, { native: loc.native }), 200, cache(TTL.person));
});

// --- browse endpoints ------------------------------------------------------

content.get("/genres", async (c) => {
  const loc = readLocale(c);
  const [movie, tv] = await tmdbFetchAllSettled(c.env, [
    { path: "/genre/movie/list", opts: { ttl: TTL.genres, language: loc.language } },
    { path: "/genre/tv/list", opts: { ttl: TTL.genres, language: loc.language } },
  ]);
  return c.json({ movie: movie?.genres ?? [], tv: tv?.genres ?? [] }, 200, cache(TTL.genres));
});

content.get("/list/:kind", async (c) => {
  const spec = LIST_KINDS[c.req.param("kind")];
  if (!spec) return c.json({ error: "Unknown list kind" }, 404);
  const loc = readLocale(c);
  const page = posInt(c.req.query("page")) ?? 1;

  if (spec.discover) {
    const params = discoverParams({
      type: spec.discover.type,
      page,
      locale: loc,
      extraParams: spec.discover.params,
    });
    const out = await runDiscover(c.env, spec.discover.type, params, loc);
    return c.json(out, 200, cache(spec.ttl));
  }

  const raw = await tmdbFetch(
    c.env,
    spec.path,
    { page, include_adult: loc.includeAdult, region: spec.regional ? loc.region : undefined },
    { ttl: spec.ttl, language: loc.language },
  );
  let results = raw.results ?? [];
  results = filterNsfw(results, loc.includeAdult, spec.media === "show" ? "tv" : "movie");
  return c.json(
    {
      page: raw.page ?? page,
      total_pages: raw.total_pages ?? 1,
      results: results.map((r) => toCard(spec.media, r, { native: loc.native, region: loc.region })),
    },
    200,
    cache(spec.ttl),
  );
});

content.get("/discover/:type", async (c) => {
  const type = c.req.param("type");
  if (type !== "movie" && type !== "tv") return c.json({ error: "Bad type" }, 400);
  const loc = readLocale(c);
  const page = posInt(c.req.query("page")) ?? 1;
  const withGenres = c.req.query("with_genres");
  const upcoming = c.req.query("upcoming") === "1";

  const providerIds = parseProviderIds(c.req.query("with_watch_providers") ?? "");
  const watchRegion = c.req.query("watch_region") || loc.region || undefined;
  const monetization = parseMonetization(c.req.query("with_watch_monetization_types") ?? "");
  if (providerIds.length > 0 && !isValidRegion(watchRegion ?? "")) {
    return c.json({ error: "with_watch_providers requires a valid watch_region" }, 400);
  }

  const params = discoverParams({
    type,
    page,
    locale: loc,
    withGenres,
    upcoming,
    providerIds,
    watchRegion,
    monetization,
  });
  const out = await runDiscover(c.env, type, params, loc);
  return c.json(out, 200, cache(TTL.discover));
});

// --- watch providers ---------------------------------------------------------

content.get("/watch/regions", async (c) => {
  const loc = readLocale(c);
  const raw = await tmdbFetch(c.env, "/watch/providers/regions", {}, { ttl: TTL.watch, language: loc.language });
  const regions = (raw.results ?? [])
    .map((r) => ({ code: r.iso_3166_1, name: r.english_name, nativeName: r.native_name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return c.json({ regions }, 200, cache(TTL.watch));
});

content.get("/watch/providers", async (c) => {
  const loc = readLocale(c);
  const region = c.req.query("region") || loc.region;
  if (!isValidRegion(region ?? "")) return c.json({ error: "Bad or missing region" }, 400);
  const type = c.req.query("type") ?? "all";

  const paths = [];
  if (type === "movie" || type === "all") paths.push("/watch/providers/movie");
  if (type === "tv" || type === "all") paths.push("/watch/providers/tv");
  if (paths.length === 0) return c.json({ error: "Bad type" }, 400);

  const results = await tmdbFetchAllSettled(
    c.env,
    paths.map((path) => ({ path, params: { watch_region: region }, opts: { ttl: TTL.watch, language: loc.language } })),
  );

  const byId = new Map();
  for (const data of results) {
    for (const p of data?.results ?? []) {
      const priority = p.display_priorities?.[region] ?? p.display_priority ?? 9999;
      const existing = byId.get(p.provider_id);
      if (!existing || priority < existing.priority) {
        byId.set(p.provider_id, { id: p.provider_id, name: p.provider_name, logo_path: p.logo_path ?? null, priority });
      }
    }
  }
  const providers = [...byId.values()].sort((a, b) => a.priority - b.priority);
  return c.json({ region, providers }, 200, cache(TTL.watch));
});

// --- locale config -----------------------------------------------------------

content.get("/config/locales", async (c) => {
  const loc = readLocale(c);
  const [translations, countries] = await tmdbFetchAllSettled(c.env, [
    { path: "/configuration/primary_translations", opts: { ttl: TTL.config, language: loc.language } },
    { path: "/configuration/countries", opts: { ttl: TTL.config, language: loc.language } },
  ]);
  const languages = Array.isArray(translations) ? translations : [];
  const countryList = (Array.isArray(countries) ? countries : [])
    .map((cc) => ({ code: cc.iso_3166_1, name: cc.english_name, nativeName: cc.native_name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return c.json({ languages, countries: countryList }, 200, cache(TTL.config));
});

// --- batch card hydration --------------------------------------------------
//
// Body: { items: [{ type, id, showId?, seasonNumber?, episodeNumber? }] }
// Returns: { cards: { "<key>": card }, missing: ["<key>"] }
// key: movie:ID | show:ID | person:ID | season:SHOW:N | episode:SHOW:N:M

function itemKey(it) {
  if (it.type === "season") return `season:${it.showId}:${it.seasonNumber}`;
  if (it.type === "episode") return `episode:${it.showId}:${it.seasonNumber}:${it.episodeNumber}`;
  return `${it.type}:${it.id}`;
}

content.post("/batch", async (c) => {
  const cfg = config(c.env);
  const loc = readLocale(c);
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Bad JSON" }, 400);
  }
  const items = Array.isArray(body?.items) ? body.items.slice(0, cfg.batchMax) : [];
  if (items.length === 0) return c.json({ cards: {}, missing: [] });

  const cards = {};
  const missing = [];
  let fetches = 0;
  const cardOpts = { native: loc.native, region: loc.region };

  // Per-request memo so repeated show/season fetches within a batch cost once.
  const memo = new Map();
  const memoFetch = (key, path, params, ttl) => {
    if (!memo.has(key)) {
      fetches += 1;
      memo.set(
        key,
        tmdbFetch(c.env, path, params, { ttl, language: loc.language }).catch((e) => {
          if (e instanceof TmdbNotFound) return null;
          throw e;
        }),
      );
    }
    return memo.get(key);
  };

  for (const it of items) {
    const key = itemKey(it);
    const cost =
      it.type === "movie" || it.type === "show" || it.type === "person" ? 1 : 2;
    if (fetches + cost > cfg.batchSubreqBudget) {
      missing.push(key);
      continue;
    }
    try {
      if (it.type === "movie") {
        const m = await memoFetch(
          `movie:${it.id}`,
          `/movie/${it.id}`,
          { append_to_response: "release_dates,keywords" },
          TTL.movie,
        );
        if (m) cards[key] = toCard("movie", m, cardOpts);
        else missing.push(key);
      } else if (it.type === "show") {
        const s = await memoFetch(`tv:${it.id}`, `/tv/${it.id}`, { append_to_response: "keywords" }, TTL.show);
        if (s) cards[key] = toCard("show", s, cardOpts);
        else missing.push(key);
      } else if (it.type === "person") {
        const p = await memoFetch(`person:${it.id}`, `/person/${it.id}`, {}, TTL.person);
        if (p) cards[key] = toCard("person", p, cardOpts);
        else missing.push(key);
      } else if (it.type === "season") {
        const [show, se] = await Promise.all([
          memoFetch(`tv:${it.showId}`, `/tv/${it.showId}`, { append_to_response: "keywords" }, TTL.show),
          memoFetch(
            `season:${it.showId}:${it.seasonNumber}`,
            `/tv/${it.showId}/season/${it.seasonNumber}`,
            {},
            TTL.season,
          ),
        ]);
        if (se) {
          cards[key] = toCard("season", se, {
            ...cardOpts,
            showId: it.showId,
            showTitle: show?.name ?? null,
            adult: Boolean(show?.adult),
            nsfw: show ? isNsfw(show, "tv") : Boolean(show?.adult),
          });
        } else missing.push(key);
      } else if (it.type === "episode") {
        const [show, se] = await Promise.all([
          memoFetch(`tv:${it.showId}`, `/tv/${it.showId}`, { append_to_response: "keywords" }, TTL.show),
          memoFetch(
            `season:${it.showId}:${it.seasonNumber}`,
            `/tv/${it.showId}/season/${it.seasonNumber}`,
            {},
            TTL.season,
          ),
        ]);
        const ep = se?.episodes?.find((e) => e.episode_number === it.episodeNumber);
        if (ep) {
          cards[key] = toCard("episode", ep, {
            ...cardOpts,
            showId: it.showId,
            showTitle: show?.name ?? null,
            adult: Boolean(show?.adult),
            nsfw: show ? isNsfw(show, "tv") : Boolean(show?.adult),
          });
        } else missing.push(key);
      } else {
        missing.push(key);
      }
    } catch {
      missing.push(key);
    }
  }

  return c.json({ cards, missing }, 200, cache(3600));
});

// --- calendar releases ---------------------------------------------------------
//
// Body: { showIds: number[], year, month }  (month 1-12)
// Returns: { entries: { "YYYY-MM-DD": [{ type:'episode', showId, showName, seasonNumber, episodeNumber, name, runtime }] } }
//
// Bounded: base /tv fetch per show + at most 2 season fetches per show.

content.post("/releases", async (c) => {
  const cfg = config(c.env);
  const loc = readLocale(c);
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Bad JSON" }, 400);
  }
  const showIds = [...new Set((body?.showIds ?? []).filter((n) => Number.isInteger(n) && n > 0))].slice(
    0,
    cfg.releasesMaxShows,
  );
  const yr = posInt(String(body?.year));
  const mo = posInt(String(body?.month));
  if (!yr || !mo || mo > 12) return c.json({ error: "Bad year/month" }, 400);

  const monthStart = `${yr}-${String(mo).padStart(2, "0")}-01`;
  const lastDay = new Date(yr, mo, 0).getDate();
  const monthEnd = `${yr}-${String(mo).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const entries = {};
  const addEntry = (date, entry) => {
    (entries[date] ??= []).push(entry);
  };

  await Promise.all(
    showIds.map(async (showId) => {
      let show;
      try {
        show = await tmdbFetch(c.env, `/tv/${showId}`, {}, { ttl: TTL.show, language: loc.language });
      } catch (e) {
        if (e instanceof TmdbNotFound) return;
        throw e;
      }

      const nextAir = show.next_episode_to_air?.air_date ?? null;
      const canSkip =
        show.last_air_date &&
        show.last_air_date < monthStart &&
        (!nextAir || nextAir > monthEnd);
      if (canSkip) return;

      const candidates = (show.seasons ?? [])
        .filter((se) => se.season_number > 0)
        .filter((se) => !se.air_date || se.air_date <= monthEnd)
        .sort((a, b) => b.season_number - a.season_number)
        .slice(0, 2);

      const seasons = await Promise.all(
        candidates.map((se) =>
          tmdbFetch(c.env, `/tv/${showId}/season/${se.season_number}`, {}, { ttl: TTL.season, language: loc.language }).catch(
            (e) => {
              if (e instanceof TmdbNotFound) return null;
              throw e;
            },
          ),
        ),
      );

      for (const se of seasons) {
        if (!se) continue;
        for (const ep of se.episodes ?? []) {
          if (!ep.air_date || ep.air_date < monthStart || ep.air_date > monthEnd) continue;
          addEntry(ep.air_date, {
            type: "episode",
            showId,
            showName: show.name ?? "",
            seasonNumber: ep.season_number ?? se.season_number,
            episodeNumber: ep.episode_number,
            name: ep.name ?? "",
            runtime: ep.runtime ?? null,
          });
        }
      }
    }),
  );

  return c.json({ entries }, 200, cache(6 * 3600));
});

// --- recommendations ("Suggested for you") ------------------------------------
//
// No ML/collaborative-filtering infra of our own — this leans entirely on
// TMDB's own per-title /recommendations endpoint (TMDB staff recommend it over
// /similar, which is just genre/keyword matching, not user-behaviour based).
// The client supplies "seed" titles from the user's own ratings + watched
// watchlist items; we fetch TMDB recommendations for each seed, tally how
// often each candidate is recommended across seeds, and rank by that.
//
// Body: {
//   items: [{type:'movie'|'show', id}],      // seeds, capped to recommendationsMaxSeeds
//   exclude: [{type:'movie'|'show', id}],     // already rated/watchlisted/followed
//   providers?: number[],                     // optional: also return a subset available on these
//   watchRegion?: string,                     // ISO 3166-1, required alongside providers
// }
// Returns: { results: [...cards], resultsOnMyServices?: [...cards] }
//
// Per-user response — never edge-cached (Cache-Control: private). The
// per-seed TMDB /recommendations calls ARE cached (keyed on id+language,
// same as everything else through tmdbFetch), so repeat callers with an
// overlapping seed pool still hit a warm cache upstream.

const RECOMMENDATION_DISPLAY_CAP = 24;
const RECOMMENDATION_CANDIDATE_POOL = 40;

function providerMatch(raw, watchRegion, providerIds) {
  const region = raw?.["watch/providers"]?.results?.[watchRegion];
  if (!region) return false;
  const ids = new Set(
    [...(region.flatrate ?? []), ...(region.free ?? []), ...(region.ads ?? [])].map((p) => p.provider_id),
  );
  return providerIds.some((id) => ids.has(id));
}

content.post("/recommendations", async (c) => {
  const cfg = config(c.env);
  const loc = readLocale(c);
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Bad JSON" }, 400);
  }

  const items = (Array.isArray(body?.items) ? body.items : [])
    .filter((it) => (it?.type === "movie" || it?.type === "show") && posInt(it?.id))
    .slice(0, cfg.recommendationsMaxSeeds);
  if (items.length === 0) return c.json({ results: [] });

  const excludeKeys = new Set();
  for (const it of (Array.isArray(body?.exclude) ? body.exclude : []).slice(0, 2000)) {
    if ((it?.type === "movie" || it?.type === "show") && posInt(it?.id)) excludeKeys.add(`${it.type}:${it.id}`);
  }
  for (const it of items) excludeKeys.add(`${it.type}:${it.id}`); // never recommend a seed back to itself

  const providers = (Array.isArray(body?.providers) ? body.providers : [])
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 50);
  const watchRegion = isValidRegion(body?.watchRegion ?? "") ? body.watchRegion : null;
  const wantProviders = providers.length > 0 && !!watchRegion;

  // 1) Fetch TMDB recommendations per seed, tally candidates across seeds.
  const tally = new Map(); // "type:id" -> { type, id, raw, hits, popularity }
  await Promise.all(
    items.map(async (it) => {
      const tmdbType = it.type === "show" ? "tv" : "movie";
      let raw;
      try {
        raw = await tmdbFetch(c.env, `/${tmdbType}/${it.id}/recommendations`, {}, { ttl: TTL.discover, language: loc.language });
      } catch {
        return;
      }
      for (const r of raw?.results ?? []) {
        const key = `${it.type}:${r.id}`;
        if (excludeKeys.has(key)) continue;
        const existing = tally.get(key);
        if (existing) existing.hits += 1;
        else tally.set(key, { type: it.type, id: r.id, raw: r, hits: 1, popularity: r.popularity ?? 0 });
      }
    }),
  );

  let candidates = [...tally.values()];
  if (!loc.includeAdult) {
    candidates = candidates.filter((cnd) => !isNsfw(cnd.raw, cnd.type === "show" ? "tv" : "movie"));
  }
  candidates.sort((a, b) => b.hits - a.hits || b.popularity - a.popularity);
  candidates = candidates.slice(0, RECOMMENDATION_CANDIDATE_POOL);

  const cardOpts = { native: loc.native, region: loc.region };
  const results = candidates
    .slice(0, RECOMMENDATION_DISPLAY_CAP)
    .map((cnd) => toCard(cnd.type, cnd.raw, cardOpts));

  let resultsOnMyServices;
  if (wantProviders) {
    const onServices = [];
    let checks = 0;
    for (const cnd of candidates) {
      if (onServices.length >= RECOMMENDATION_DISPLAY_CAP || checks >= cfg.recommendationsProviderCheckMax) break;
      checks += 1;
      const tmdbType = cnd.type === "show" ? "tv" : "movie";
      try {
        const raw = await tmdbFetch(
          c.env,
          `/${tmdbType}/${cnd.id}`,
          { append_to_response: "watch/providers" },
          { ttl: TTL.movie, language: loc.language },
        );
        if (providerMatch(raw, watchRegion, providers)) {
          onServices.push(toCard(cnd.type, cnd.raw, cardOpts));
        }
      } catch {
        /* skip this candidate */
      }
    }
    resultsOnMyServices = onServices;
  }

  return c.json(
    wantProviders ? { results, resultsOnMyServices } : { results },
    200,
    { "Cache-Control": "private, max-age=60" },
  );
});
