import { supabase } from "../../../lib/supabase.js";

async function resolveWatchlistTarget(mediaType, entityId) {
  if (mediaType === "movie") return { mediaType: "movie", entityId };
  if (mediaType === "show") return { mediaType: "show", entityId };

  if (mediaType === "season") {
    const { data } = await supabase.from("season").select("show_id").eq("id", entityId).maybeSingle();
    return data?.show_id ? { mediaType: "show", entityId: data.show_id } : null;
  }

  if (mediaType === "episode") {
    const { data } = await supabase
      .from("episode")
      .select("season:season_id(show_id)")
      .eq("id", entityId)
      .maybeSingle();
    const showId = data?.season?.show_id;
    return showId ? { mediaType: "show", entityId: showId } : null;
  }

  return null;
}

// Rating means watched — remove matching movie/show from all of the user's watchlists.
export async function removeFromWatchlistsOnRating(mediaType, entityId) {
  const target = await resolveWatchlistTarget(mediaType, entityId);
  if (!target) return;

  const idCol = target.mediaType === "movie" ? "movie_id" : "show_id";
  await supabase.from("watchlist_item").delete().eq(idCol, target.entityId);

  window.dispatchEvent(new CustomEvent("watchpapa:watchlist-item-removed", {
    detail: { mediaType: target.mediaType, entityId: target.entityId },
  }));
}
