import { supabase } from "../../../lib/supabase.js";
import { resolveWatchTarget } from "./watchTarget.js";

// Rating means watched — remove the matching movie/show from all of the user's
// watchlists. A season/episode rating maps to its parent show (tmdbShowId,
// passed in from the rating context — no lookup); see watchTarget.js.
export async function removeFromWatchlistsOnRating(mediaType, tmdbId, tmdbShowId) {
  const target = resolveWatchTarget(mediaType, tmdbId, tmdbShowId);
  if (!target) return;

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
