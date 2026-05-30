const TMDB_MOVIE_RE = /themoviedb\.org\/movie\/(\d+)/i;
const LETTERBOXD_URI_RE = /^https?:\/\/(boxd\.it|letterboxd\.com)\//i;

export function parseTmdbMovieId(text) {
  if (!text) return null;
  const match = String(text).match(TMDB_MOVIE_RE);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function resolveTmdbIdFromLetterboxdUri(uri) {
  if (typeof uri !== "string" || !uri.trim()) return null;

  const trimmed = uri.trim();
  const direct = parseTmdbMovieId(trimmed);
  if (direct) return direct;

  if (!LETTERBOXD_URI_RE.test(trimmed)) return null;

  const res = await fetch(trimmed, {
    redirect: "follow",
    headers: { "User-Agent": "watchpapa-import/1.0" },
  });
  if (!res.ok) return null;

  const fromUrl = parseTmdbMovieId(res.url);
  if (fromUrl) return fromUrl;

  const html = await res.text();
  return parseTmdbMovieId(html);
}
