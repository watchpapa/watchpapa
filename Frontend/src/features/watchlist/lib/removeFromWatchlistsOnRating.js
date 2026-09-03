import { supabase } from "../../../lib/supabase.js";

// Rating means watched — remove the matching movie/show from all of the user's
// watchlists. Watchlists only hold movies + shows, so a season/episode rating maps
// to its parent show (tmdb_show_id, passed in from the rating context — no lookup).
export async function removeFromWatchlistsOnRating(mediaType, tmdbId, tmdbShowId) {
  let target;
  if (mediaType === "movie") target = { mediaType: "movie", tmdbId };
  else if (mediaType === "show") target = { mediaType: "show", tmdbId };
  else if ((mediaType === "season" || mediaType === "episode") && tmdbShowId) {
    target = { mediaType: "show", tmdbId: tmdbShowId };
  } else return;

  await supabase
    .from("watchlist_item")
    .delete()
    .eq("media_type", target.mediaType)
    .eq("tmdb_id", target.tmdbId);

  window.dispatchEvent(
    new CustomEvent("watchpapa:watchlist-item-removed", {
      detail: { mediaType: target.mediaType, tmdbId: target.tmdbId },
    }),
  );
}
