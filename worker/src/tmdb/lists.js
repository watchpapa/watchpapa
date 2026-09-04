// Maps our `/api/content/list/:kind` values to TMDB endpoints + cache TTLs.
// These back the browse pages (home rows, /movies, /shows, /people) and the sitemaps.
//
// `discover` kinds are served through /discover/{movie,tv} instead of the raw TMDB
// list endpoint (/movie/popular etc.) — TMDB's list endpoints ignore `include_adult`
// and have no keyword-exclusion param, so Popular/Top-rated route through discover to
// get language/region/adult/NSFW-keyword filtering consistently with the rest of the
// app. Kinds with no `discover` key stay on the plain list endpoint (Worker-side NSFW
// post-filtering only); `regional: true` marks the ones TMDB accepts a `region` on.

export const LIST_KINDS = {
  "movies-popular": {
    discover: { type: "movie", params: { sort_by: "popularity.desc" } },
    media: "movie",
    ttl: 21600,
  },
  "movies-top-rated": {
    discover: { type: "movie", params: { sort_by: "vote_average.desc", "vote_count.gte": 300 } },
    media: "movie",
    ttl: 21600,
  },
  "movies-upcoming": { path: "/movie/upcoming", media: "movie", ttl: 21600, regional: true },
  "movies-now-playing": { path: "/movie/now_playing", media: "movie", ttl: 21600, regional: true },
  "shows-popular": {
    discover: { type: "tv", params: { sort_by: "popularity.desc" } },
    media: "show",
    ttl: 21600,
  },
  "shows-top-rated": {
    discover: { type: "tv", params: { sort_by: "vote_average.desc", "vote_count.gte": 200 } },
    media: "show",
    ttl: 21600,
  },
  "shows-on-the-air": { path: "/tv/on_the_air", media: "show", ttl: 21600 },
  "shows-airing-today": { path: "/tv/airing_today", media: "show", ttl: 21600 },
  "people-popular": { path: "/person/popular", media: "person", ttl: 21600 },
};

export const TTL = {
  movie: 86400,
  show: 86400,
  season: 43200,
  episode: 43200,
  person: 86400,
  list: 21600,
  discover: 21600,
  genres: 604800,
  search: 600,
  sitemap: 86400,
  watch: 604800,
  config: 604800,
};
