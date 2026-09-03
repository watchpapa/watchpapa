// Convert raw TMDB payloads into the shapes the watchpapa frontend consumes.
//
// Guiding rule: emit the SAME field names the UI already read off the Postgres mirror
// (`tmdb_id`, `title`/`name`, `poster_path`, `release_date`/`first_air_date`,
// `tmdb_vote_avg`, `tmdb_popularity`, `adult`, `genres: [{id,name}]`) so the hook
// rewrites are id-swaps, not reshapes. `id === tmdb_id` everywhere. Image paths stay
// raw TMDB paths — the frontend builds the CDN URL.

const year = (d) => (typeof d === "string" && d.length >= 4 ? d.slice(0, 4) : null);
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const genreList = (g) => (Array.isArray(g) ? g.map((x) => ({ id: x.id, name: x.name })) : []);

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

export function normalizeMovie(m) {
  const { cast, crew } = flatCredits(m.credits);
  return {
    type: "movie",
    id: m.id,
    tmdb_id: m.id,
    title: m.title ?? m.original_title ?? "",
    original_title: m.original_title ?? "",
    original_language: m.original_language ?? null,
    overview: m.overview ?? "",
    tagline: m.tagline ?? "",
    status: m.status ?? null,
    release_date: m.release_date || null,
    runtime: m.runtime ?? null,
    budget: m.budget ?? 0,
    revenue: m.revenue ?? 0,
    poster_path: m.poster_path ?? null,
    backdrop_path: m.backdrop_path ?? null,
    tmdb_popularity: num(m.popularity),
    tmdb_vote_avg: num(m.vote_average),
    tmdb_vote_count: num(m.vote_count),
    adult: Boolean(m.adult),
    genres: genreList(m.genres),
    genre_ids: m.genres?.map((g) => g.id) ?? [],
    cast,
    crew,
  };
}

export function normalizeShow(s) {
  const { cast, crew } = s.aggregate_credits
    ? flatAggregateCredits(s.aggregate_credits)
    : flatCredits(s.credits);
  return {
    type: "show",
    id: s.id,
    tmdb_id: s.id,
    name: s.name ?? s.original_name ?? "",
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
    genres: genreList(s.genres),
    genre_ids: s.genres?.map((g) => g.id) ?? [],
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

// TMDB /person/{id}  (append_to_response=combined_credits)
export function normalizePerson(p) {
  const seen = new Set();
  const credits = [];
  for (const c of p.combined_credits?.cast ?? []) {
    const key = `${c.media_type}:${c.id}:${c.character ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    credits.push({
      mediaId: c.id,
      type: c.media_type === "tv" ? "show" : "movie",
      title: c.title ?? c.name ?? "",
      posterPath: c.poster_path ?? null,
      role: c.character ?? null,
      job: null,
      department: "Acting",
      adult: Boolean(c.adult),
      date: c.release_date || c.first_air_date || null,
    });
  }
  for (const c of p.combined_credits?.crew ?? []) {
    const key = `${c.media_type}:${c.id}:${c.job ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    credits.push({
      mediaId: c.id,
      type: c.media_type === "tv" ? "show" : "movie",
      title: c.title ?? c.name ?? "",
      posterPath: c.poster_path ?? null,
      role: null,
      job: c.job ?? null,
      department: c.department ?? null,
      adult: Boolean(c.adult),
      date: c.release_date || c.first_air_date || null,
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
export function toCard(type, raw, extra = {}) {
  if (type === "movie") {
    return {
      type: "movie",
      id: raw.id,
      title: raw.title ?? raw.original_title ?? "",
      poster_path: raw.poster_path ?? null,
      backdrop_path: raw.backdrop_path ?? null,
      date: raw.release_date || null,
      year: year(raw.release_date),
      tmdb_vote_avg: num(raw.vote_average),
      tmdb_popularity: num(raw.popularity),
      adult: Boolean(raw.adult),
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
      title: raw.name ?? raw.original_name ?? "",
      poster_path: raw.poster_path ?? null,
      backdrop_path: raw.backdrop_path ?? null,
      date: raw.first_air_date || null,
      year: year(raw.first_air_date),
      tmdb_vote_avg: num(raw.vote_average),
      tmdb_popularity: num(raw.popularity),
      adult: Boolean(raw.adult),
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

export function normalizeSearchResults(data, includeAdult) {
  const keep = (arr) => (includeAdult ? arr : arr.filter((r) => !r.adult));
  const out = [];
  for (const r of keep(data.movie?.results ?? []).slice(0, 15)) {
    out.push({ type: "movie", tmdbId: r.id, title: r.title ?? r.original_title ?? "", posterPath: r.poster_path ?? null, year: year(r.release_date), popularity: num(r.popularity), adult: Boolean(r.adult) });
  }
  for (const r of keep(data.tv?.results ?? []).slice(0, 15)) {
    out.push({ type: "show", tmdbId: r.id, title: r.name ?? r.original_name ?? "", posterPath: r.poster_path ?? null, year: year(r.first_air_date), popularity: num(r.popularity), adult: Boolean(r.adult) });
  }
  for (const r of keep(data.person?.results ?? []).slice(0, 15)) {
    out.push({ type: "person", tmdbId: r.id, title: r.name ?? "", posterPath: r.profile_path ?? null, year: null, popularity: num(r.popularity), adult: Boolean(r.adult) });
  }
  return out;
}
