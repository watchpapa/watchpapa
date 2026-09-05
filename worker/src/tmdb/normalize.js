// Convert raw TMDB payloads into the shapes the watchpapa frontend consumes.
//
// Guiding rule: emit the SAME field names the UI already read off the Postgres mirror
// (`tmdb_id`, `title`/`name`, `poster_path`, `release_date`/`first_air_date`,
// `tmdb_vote_avg`, `tmdb_popularity`, `adult`, `genres: [{id,name}]`) so the hook
// rewrites are id-swaps, not reshapes. `id === tmdb_id` everywhere. Image paths stay
// raw TMDB paths — the frontend builds the CDN URL.
//
// Locale: every normalizer/toCard/normalizeSearchResults takes a trailing
// `opts = { native, region }`. `native` (an ISO 639-1 code) swaps the display title
// for the TMDB original title when `original_language === native` — the
// "original titles for my language, English for everything else" mode. `region`
// (ISO 3166-1) picks a regional release date out of an appended `release_dates`
// payload; it is NEVER sent as a TMDB `language`/`region` request param on
// detail/batch fetches (that would fragment the edge cache per region) — it only
// selects among the dates TMDB already returned for every region in one response.

import { isNsfw } from "./nsfw.js";

const year = (d) => (typeof d === "string" && d.length >= 4 ? d.slice(0, 4) : null);
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const genreList = (g) => (Array.isArray(g) ? g.map((x) => ({ id: x.id, name: x.name })) : []);

// Swap in the TMDB original title/name when it was originally authored in the
// user's "native" language (mode B: "original titles for my language, English for
// the rest"). Falls back to the translated title, then the original, same as before.
function pickTitle(translated, original, originalLanguage, native) {
  if (native && originalLanguage && originalLanguage === native && original) return original;
  return translated || original || "";
}

// TMDB movie `release_dates` (append_to_response) = { results: [{ iso_3166_1,
// release_dates: [{ type, release_date, certification }] }] }. type: 1 premiere,
// 2 limited theatrical, 3 theatrical, 4 digital, 5 physical, 6 TV. Prefer theatrical,
// then limited theatrical, then digital, then TV; earliest date of the chosen type.
const RELEASE_TYPE_PRIORITY = [3, 2, 4, 6];
function pickRegionalRelease(releaseDates, region) {
  if (!region) return null;
  const entry = (releaseDates?.results ?? []).find((r) => r.iso_3166_1 === region);
  if (!entry) return null;
  for (const type of RELEASE_TYPE_PRIORITY) {
    const dates = (entry.release_dates ?? [])
      .filter((d) => d.type === type && d.release_date)
      .map((d) => d.release_date.slice(0, 10))
      .sort();
    if (dates.length > 0) return { date: dates[0], type };
  }
  return null;
}

// TMDB `watch/providers` (append_to_response) = { results: { [ISO]: { link, flatrate[],
// rent[], buy[], free[], ads[] } } }, each item { provider_id, provider_name, logo_path,
// display_priority }. Compact into a shared provider dictionary (dedupes name/logo across
// ~50 regions) + a per-region bucket-of-ids map so the payload doesn't repeat provider
// metadata per region.
const WATCH_BUCKETS = ["flatrate", "rent", "buy", "free", "ads"];
function compactWatchProviders(wp) {
  const results = wp?.results;
  if (!results || typeof results !== "object") return null;
  const providers = {};
  const regions = {};
  for (const [iso, entry] of Object.entries(results)) {
    const bucket = {};
    let hasAny = false;
    for (const b of WATCH_BUCKETS) {
      const items = Array.isArray(entry?.[b]) ? entry[b] : [];
      if (items.length === 0) continue;
      hasAny = true;
      bucket[b] = items.map((p) => {
        providers[p.provider_id] ??= { name: p.provider_name, logo_path: p.logo_path ?? null };
        return p.provider_id;
      });
    }
    if (!hasAny) continue;
    regions[iso] = { link: entry.link ?? null, ...bucket };
  }
  if (Object.keys(regions).length === 0) return null;
  return { providers, regions };
}

// TMDB `keywords` (append_to_response): movie shape { keywords: [{id,name}] },
// tv shape { results: [{id,name}] }.
function keywordList(raw) {
  const arr = raw?.keywords?.keywords ?? raw?.keywords?.results ?? [];
  return Array.isArray(arr) ? arr.map((k) => ({ id: k.id, name: k.name })) : [];
}

// Movie `release_dates` (append_to_response) carries a `certification` on each
// release_dates row per country — take the first non-empty one. Show
// `content_ratings` (append_to_response) is flatter: one rating per country,
// no release-type breakdown. Same `region` as the regional release date, so no
// extra param plumbing.
function certificationForRegion(raw, region, kind) {
  if (!region) return null;
  if (kind === "movie") {
    const entry = (raw.release_dates?.results ?? []).find((r) => r.iso_3166_1 === region);
    const cert = (entry?.release_dates ?? []).find((d) => d.certification)?.certification;
    return cert || null;
  }
  const entry = (raw.content_ratings?.results ?? []).find((r) => r.iso_3166_1 === region);
  return entry?.rating || null;
}

// --- credits ------------------------------------------------------------------

// TMDB `credits` (movies, episodes): cast[] {id,name,profile_path,character,order},
// crew[] {id,name,profile_path,job,department}.
function flatCredits(credits, guestStars) {
  const castSrc = [...(credits?.cast ?? []), ...(guestStars ?? [])];
  const cast = castSrc.map((c) => ({
    personId: c.id,
    name: c.name,
    profilePath: c.profile_path ?? null,
    character: c.character ?? null,
    order: typeof c.order === "number" ? c.order : 999,
  }));
  const crew = (credits?.crew ?? []).map((c) => ({
    personId: c.id,
    name: c.name,
    profilePath: c.profile_path ?? null,
    job: c.job ?? null,
    department: c.department ?? null,
  }));
  return { cast, crew };
}

// TMDB `aggregate_credits` (shows): cast[] has roles[] {character,episode_count};
// crew[] has jobs[] {job,episode_count} plus a top-level department.
function flatAggregateCredits(agg) {
  const cast = (agg?.cast ?? []).map((c) => ({
    personId: c.id,
    name: c.name,
    profilePath: c.profile_path ?? null,
    character: c.roles?.map((r) => r.character).filter(Boolean).join(" / ") || null,
    order: typeof c.order === "number" ? c.order : 999,
  }));
  const crew = [];
  for (const c of agg?.crew ?? []) {
    for (const j of c.jobs ?? []) {
      crew.push({
        personId: c.id,
        name: c.name,
        profilePath: c.profile_path ?? null,
        job: j.job ?? null,
        department: c.department ?? null,
      });
    }
  }
  return { cast, crew };
}

// --- entities ----------------------------------------------------------------

export function normalizeMovie(m, opts = {}) {
  const { cast, crew } = flatCredits(m.credits);
  const regional = pickRegionalRelease(m.release_dates, opts.region);
  const releaseDatePrimary = m.release_date || null;
  const releaseDateEffective = regional?.date ?? releaseDatePrimary;
  const certification = certificationForRegion(m, opts.region, "movie");
  return {
    type: "movie",
    id: m.id,
    tmdb_id: m.id,
    title: pickTitle(m.title, m.original_title, m.original_language, opts.native),
    original_title: m.original_title ?? "",
    original_language: m.original_language ?? null,
    overview: m.overview ?? "",
    tagline: m.tagline ?? "",
    status: m.status ?? null,
    release_date: releaseDatePrimary,
    release_date_regional: regional?.date ?? null,
    release_date_effective: releaseDateEffective,
    release_region: regional ? opts.region : null,
    runtime: m.runtime ?? null,
    budget: m.budget ?? 0,
    revenue: m.revenue ?? 0,
    poster_path: m.poster_path ?? null,
    backdrop_path: m.backdrop_path ?? null,
    tmdb_popularity: num(m.popularity),
    tmdb_vote_avg: num(m.vote_average),
    tmdb_vote_count: num(m.vote_count),
    adult: Boolean(m.adult),
    nsfw: isNsfw(m, "movie"),
    keywords: keywordList(m),
    watch_providers: compactWatchProviders(m["watch/providers"]),
    genres: genreList(m.genres),
    genre_ids: m.genres?.map((g) => g.id) ?? [],
    certification,
    certification_region: certification ? opts.region : null,
    collection: m.belongs_to_collection
      ? {
          id: m.belongs_to_collection.id,
          name: m.belongs_to_collection.name ?? "",
          poster_path: m.belongs_to_collection.poster_path ?? null,
          backdrop_path: m.belongs_to_collection.backdrop_path ?? null,
        }
      : null,
    cast,
    crew,
  };
}

export function normalizeShow(s, opts = {}) {
  const { cast, crew } = s.aggregate_credits
    ? flatAggregateCredits(s.aggregate_credits)
    : flatCredits(s.credits);
  const certification = certificationForRegion(s, opts.region, "tv");
  return {
    type: "show",
    id: s.id,
    tmdb_id: s.id,
    name: pickTitle(s.name, s.original_name, s.original_language, opts.native),
    original_name: s.original_name ?? "",
    original_language: s.original_language ?? null,
    overview: s.overview ?? "",
    tagline: s.tagline ?? "",
    type_label: s.type ?? null,
    status: s.status ?? null,
    in_production: Boolean(s.in_production),
    first_air_date: s.first_air_date || null,
    last_air_date: s.last_air_date || null,
    number_of_seasons: s.number_of_seasons ?? 0,
    number_of_episodes: s.number_of_episodes ?? 0,
    episode_run_time: Array.isArray(s.episode_run_time) ? (s.episode_run_time[0] ?? null) : null,
    poster_path: s.poster_path ?? null,
    backdrop_path: s.backdrop_path ?? null,
    tmdb_popularity: num(s.popularity),
    tmdb_vote_avg: num(s.vote_average),
    tmdb_vote_count: num(s.vote_count),
    adult: Boolean(s.adult),
    nsfw: isNsfw(s, "tv"),
    keywords: keywordList(s),
    watch_providers: compactWatchProviders(s["watch/providers"]),
    genres: genreList(s.genres),
    genre_ids: s.genres?.map((g) => g.id) ?? [],
    certification,
    certification_region: certification ? opts.region : null,
    next_episode_to_air: s.next_episode_to_air
      ? { air_date: s.next_episode_to_air.air_date, season_number: s.next_episode_to_air.season_number, episode_number: s.next_episode_to_air.episode_number, name: s.next_episode_to_air.name }
      : null,
    last_episode_to_air: s.last_episode_to_air
      ? { air_date: s.last_episode_to_air.air_date, season_number: s.last_episode_to_air.season_number, episode_number: s.last_episode_to_air.episode_number, name: s.last_episode_to_air.name }
      : null,
    seasons: (s.seasons ?? []).map((se) => ({
      id: se.id,
      name: se.name,
      season_number: se.season_number,
      air_date: se.air_date || null,
      poster_path: se.poster_path ?? null,
      episode_count: se.episode_count ?? 0,
      overview: se.overview ?? "",
    })),
    cast,
    crew,
  };
}

// TMDB /collection/{id}. `raw` may already have its `overview` filled in by the
// caller from /collection/{id}/translations when the requested language had none.
export function normalizeCollection(raw, opts = {}) {
  return {
    type: "collection",
    id: raw.id,
    tmdb_id: raw.id,
    name: raw.name ?? "",
    overview: raw.overview ?? "",
    poster_path: raw.poster_path ?? null,
    backdrop_path: raw.backdrop_path ?? null,
    parts: (raw.parts ?? []).map((p) => toCard("movie", p, { native: opts.native, region: opts.region })),
  };
}

// TMDB /tv/{id}/season/{n}
export function normalizeSeason(se, showId) {
  return {
    type: "season",
    id: se.id,
    tmdb_id: se.id,
    show_id: showId,
    name: se.name ?? `Season ${se.season_number}`,
    season_number: se.season_number,
    overview: se.overview ?? "",
    air_date: se.air_date || null,
    poster_path: se.poster_path ?? null,
    episodes: (se.episodes ?? []).map((e) => ({
      id: e.id,
      tmdb_id: e.id,
      name: e.name ?? `Episode ${e.episode_number}`,
      episode_number: e.episode_number,
      season_number: e.season_number ?? se.season_number,
      overview: e.overview ?? "",
      air_date: e.air_date || null,
      runtime: e.runtime ?? null,
      poster_path: e.still_path ?? null, // UI calls it poster_path
      tmdb_vote_avg: num(e.vote_average),
    })),
  };
}

// TMDB /tv/{id}/season/{n}/episode/{m}  (append_to_response=credits)
export function normalizeEpisode(e, showId) {
  const { cast, crew } = flatCredits(e.credits, e.credits?.guest_stars ?? e.guest_stars);
  return {
    type: "episode",
    id: e.id,
    tmdb_id: e.id,
    show_id: showId,
    name: e.name ?? `Episode ${e.episode_number}`,
    episode_number: e.episode_number,
    season_number: e.season_number,
    overview: e.overview ?? "",
    air_date: e.air_date || null,
    runtime: e.runtime ?? null,
    poster_path: e.still_path ?? null,
    tmdb_vote_avg: num(e.vote_average),
    cast,
    crew,
  };
}

// TMDB /person/{id}  (append_to_response=combined_credits). Each credit row stays
// flat (one row per role/job — unmerged) for backward compatibility; the frontend
// merges same-title rows for display. `opts.native` swaps title -> original_title
// per credit using that credit's own original_language, same rule as movie/show.
export function normalizePerson(p, opts = {}) {
  const seen = new Set();
  const credits = [];
  for (const c of p.combined_credits?.cast ?? []) {
    const key = `${c.media_type}:${c.id}:${c.character ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const type = c.media_type === "tv" ? "show" : "movie";
    const date = c.release_date || c.first_air_date || null;
    credits.push({
      mediaId: c.id,
      type,
      title: pickTitle(c.title ?? c.name, c.original_title ?? c.original_name, c.original_language, opts.native),
      originalTitle: c.original_title ?? c.original_name ?? "",
      originalLanguage: c.original_language ?? null,
      posterPath: c.poster_path ?? null,
      role: c.character ?? null,
      job: null,
      department: "Acting",
      adult: Boolean(c.adult),
      nsfw: isNsfw(c, c.media_type === "tv" ? "tv" : "movie"),
      date,
      year: year(date),
      popularity: num(c.popularity),
      voteAverage: num(c.vote_average),
      voteCount: num(c.vote_count),
      episodeCount: typeof c.episode_count === "number" ? c.episode_count : null,
    });
  }
  for (const c of p.combined_credits?.crew ?? []) {
    const key = `${c.media_type}:${c.id}:${c.job ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const type = c.media_type === "tv" ? "show" : "movie";
    const date = c.release_date || c.first_air_date || null;
    credits.push({
      mediaId: c.id,
      type,
      title: pickTitle(c.title ?? c.name, c.original_title ?? c.original_name, c.original_language, opts.native),
      originalTitle: c.original_title ?? c.original_name ?? "",
      originalLanguage: c.original_language ?? null,
      posterPath: c.poster_path ?? null,
      role: null,
      job: c.job ?? null,
      department: c.department ?? null,
      adult: Boolean(c.adult),
      nsfw: isNsfw(c, c.media_type === "tv" ? "tv" : "movie"),
      date,
      year: year(date),
      popularity: num(c.popularity),
      voteAverage: num(c.vote_average),
      voteCount: num(c.vote_count),
      episodeCount: typeof c.episode_count === "number" ? c.episode_count : null,
    });
  }
  return {
    type: "person",
    id: p.id,
    tmdb_id: p.id,
    name: p.name ?? "",
    biography: p.biography ?? "",
    birthday: p.birthday || null,
    deathday: p.deathday || null,
    place_of_birth: p.place_of_birth ?? null,
    profile_path: p.profile_path ?? null,
    popularity: num(p.popularity),
    adult: Boolean(p.adult),
    known_for_department: p.known_for_department ?? null,
    also_known_as: Array.isArray(p.also_known_as) ? p.also_known_as : [],
    credits,
  };
}

// --- cards (list items + /batch hydration) ----------------------------------

// A list item straight off /movie/popular etc., or a full detail payload.
// `extra` carries call-site context (showId/showTitle/adult/nsfw for season/episode
// cards) AND the locale opts (`native`, `region`) — kept in one object so every
// call site only has to build one bag of extras.
export function toCard(type, raw, extra = {}) {
  const { native, region } = extra;
  if (type === "movie") {
    const regional = pickRegionalRelease(raw.release_dates, region);
    return {
      type: "movie",
      id: raw.id,
      title: pickTitle(raw.title, raw.original_title, raw.original_language, native),
      original_title: raw.original_title ?? "",
      original_language: raw.original_language ?? null,
      poster_path: raw.poster_path ?? null,
      backdrop_path: raw.backdrop_path ?? null,
      date: regional?.date ?? (raw.release_date || null),
      date_primary: raw.release_date || null,
      year: year(regional?.date ?? raw.release_date),
      tmdb_vote_avg: num(raw.vote_average),
      tmdb_popularity: num(raw.popularity),
      adult: Boolean(raw.adult),
      nsfw: extra.nsfw ?? isNsfw(raw, "movie"),
      genres: genreList(raw.genres),
      genre_ids: raw.genre_ids ?? raw.genres?.map((g) => g.id) ?? [],
      runtime: raw.runtime ?? null,
      status: raw.status ?? null,
    };
  }
  if (type === "show") {
    return {
      type: "show",
      id: raw.id,
      title: pickTitle(raw.name, raw.original_name, raw.original_language, native),
      original_title: raw.original_name ?? "",
      original_language: raw.original_language ?? null,
      poster_path: raw.poster_path ?? null,
      backdrop_path: raw.backdrop_path ?? null,
      date: raw.first_air_date || null,
      year: year(raw.first_air_date),
      tmdb_vote_avg: num(raw.vote_average),
      tmdb_popularity: num(raw.popularity),
      adult: Boolean(raw.adult),
      nsfw: extra.nsfw ?? isNsfw(raw, "tv"),
      genres: genreList(raw.genres),
      genre_ids: raw.genre_ids ?? raw.genres?.map((g) => g.id) ?? [],
      status: raw.status ?? null,
      in_production: raw.in_production ?? null,
      last_air_date: raw.last_air_date || null,
    };
  }
  if (type === "person") {
    return {
      type: "person",
      id: raw.id,
      title: raw.name ?? "",
      poster_path: raw.profile_path ?? null,
      backdrop_path: null,
      date: null,
      year: null,
      tmdb_vote_avg: 0,
      tmdb_popularity: num(raw.popularity),
      adult: Boolean(raw.adult),
      nsfw: Boolean(raw.adult),
      genres: [],
      genre_ids: [],
      known_for_department: raw.known_for_department ?? null,
    };
  }
  if (type === "season") {
    return {
      type: "season",
      id: raw.id,
      title: raw.name ?? `Season ${raw.season_number}`,
      poster_path: raw.poster_path ?? null,
      backdrop_path: null,
      date: raw.air_date || null,
      year: year(raw.air_date),
      tmdb_vote_avg: 0,
      tmdb_popularity: 0,
      adult: extra.adult ?? false,
      nsfw: extra.nsfw ?? extra.adult ?? false,
      genres: [],
      genre_ids: [],
      showId: extra.showId ?? null,
      showTitle: extra.showTitle ?? null,
      seasonNumber: raw.season_number,
    };
  }
  if (type === "episode") {
    return {
      type: "episode",
      id: raw.id,
      title: raw.name ?? `Episode ${raw.episode_number}`,
      poster_path: raw.still_path ?? raw.poster_path ?? null,
      backdrop_path: null,
      date: raw.air_date || null,
      year: year(raw.air_date),
      tmdb_vote_avg: num(raw.vote_average),
      tmdb_popularity: 0,
      adult: extra.adult ?? false,
      nsfw: extra.nsfw ?? extra.adult ?? false,
      genres: [],
      genre_ids: [],
      runtime: raw.runtime ?? null,
      showId: extra.showId ?? null,
      showTitle: extra.showTitle ?? null,
      seasonNumber: raw.season_number,
      episodeNumber: raw.episode_number,
    };
  }
  throw new Error(`toCard: unknown type ${type}`);
}

const MULTI_SEARCH_TYPE = { movie: "movie", tv: "show", person: "person" };

// TMDB /search/multi — one call, one relevance-ranked list mixing movies/shows/
// people (each row carries its own `media_type`), instead of three separate
// typed searches merged client-side. `raw` is that single response
// ({page, results, total_pages}); order is preserved (that ranking IS the
// "most relevant first" the search page wants — no re-sort here).
export function normalizeSearchResults(raw, includeAdult, opts = {}) {
  const { native } = opts;
  const rows = (raw?.results ?? []).filter((r) => MULTI_SEARCH_TYPE[r.media_type]);
  const kept = rows.filter((r) => {
    if (includeAdult) return true;
    const type = MULTI_SEARCH_TYPE[r.media_type];
    return !isNsfw(r, type === "show" ? "tv" : "movie");
  });

  return kept.map((r) => {
    const type = MULTI_SEARCH_TYPE[r.media_type];
    if (type === "person") {
      return {
        type: "person",
        tmdbId: r.id,
        title: r.name ?? "",
        originalTitle: r.name ?? "",
        posterPath: r.profile_path ?? null,
        year: null,
        date: null,
        popularity: num(r.popularity),
        voteAverage: 0,
        adult: Boolean(r.adult),
        nsfw: Boolean(r.adult),
      };
    }
    const isMovie = type === "movie";
    const dateField = isMovie ? r.release_date : r.first_air_date;
    return {
      type,
      tmdbId: r.id,
      title: pickTitle(
        isMovie ? r.title : r.name,
        isMovie ? r.original_title : r.original_name,
        r.original_language,
        native,
      ),
      originalTitle: (isMovie ? r.original_title : r.original_name) ?? "",
      posterPath: r.poster_path ?? null,
      year: year(dateField),
      date: dateField || null,
      popularity: num(r.popularity),
      voteAverage: num(r.vote_average),
      adult: Boolean(r.adult),
      nsfw: isNsfw(r, isMovie ? "movie" : "tv"),
    };
  });
}
