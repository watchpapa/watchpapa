// Maps a rating/watch action's (mediaType, tmdbId[, tmdbShowId]) to the
// movie/show it actually applies to for watchlist/watch-log purposes —
// watchlists and the watch diary only track movies/shows, so a season or
// episode rating/watch applies to its parent show instead.
export function resolveWatchTarget(mediaType, tmdbId, tmdbShowId) {
  if (mediaType === "movie") return { mediaType: "movie", tmdbId };
  if (mediaType === "show") return { mediaType: "show", tmdbId };
  if ((mediaType === "season" || mediaType === "episode") && tmdbShowId) {
    return { mediaType: "show", tmdbId: tmdbShowId };
  }
  return null;
}
