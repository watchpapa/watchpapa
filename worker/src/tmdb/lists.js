// Maps our `/api/content/list/:kind` values to TMDB list endpoints + cache TTLs.
// These back the browse pages (home rows, /movies, /shows, /people) and the sitemaps.

export const LIST_KINDS = {
  "movies-popular": { path: "/movie/popular", media: "movie", ttl: 21600 },
  "movies-top-rated": { path: "/movie/top_rated", media: "movie", ttl: 21600 },
  "movies-upcoming": { path: "/movie/upcoming", media: "movie", ttl: 21600 },
  "movies-now-playing": { path: "/movie/now_playing", media: "movie", ttl: 21600 },
  "shows-popular": { path: "/tv/popular", media: "show", ttl: 21600 },
  "shows-top-rated": { path: "/tv/top_rated", media: "show", ttl: 21600 },
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
};
