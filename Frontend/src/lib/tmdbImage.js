// Build a TMDB CDN image URL from a stored path. Replaces the 21 hard-coded
// `https://image.tmdb.org/t/p/{size}` string literals.
//
// Sizes: posters w92 w154 w185 w342 w500 w780 original
//        backdrops w300 w780 w1280 original
//        profiles w45 w185 h632 original

const BASE = "https://image.tmdb.org/t/p";

export function tmdbImg(path, size = "w342") {
  if (!path) return null;
  return `${BASE}/${size}${path}`;
}

// CORS-safe variant (routes through the Worker image proxy) — needed anywhere the
// image is drawn to a <canvas> and then read back (share cards).
export function tmdbImgProxied(path, size = "w342") {
  if (!path) return null;
  const base = import.meta.env.VITE_API_BASE_URL ?? "";
  return `${base}/api/image-proxy?path=${encodeURIComponent(path)}&size=${size}`;
}
