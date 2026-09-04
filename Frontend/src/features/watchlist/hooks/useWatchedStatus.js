// Used by:
// - Frontend/src/components/watchlist/MarkWatchedButton.jsx (MoviePage / ShowPage)
//
// "Watched, no rating yet" as a standalone action — independent of explicitly
// adding to a watchlist. Reuses watchlist_item.watched (the only place
// "watched" is tracked in the schema): if the title is already on one or more
// of the user's watchlists, toggling flips `watched` on all of them (treating
// it as one fact about the title, not per-list — same convention
// removeFromWatchlistsOnRating already uses for "rated"); if it's on none,
// toggling on auto-adds it to the user's first/main watchlist already marked
// watched (mirrors AddToWatchlistButton's own auto-add-on-first-click flow).
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";

export function useWatchedStatus(mediaType, entityId, session) {
  const uid = session?.user?.id ?? null;
  const [rows, setRows] = useState([]); // watchlist_item rows for this title (RLS-scoped to own)
  const [firstWatchlistId, setFirstWatchlistId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!uid || !entityId) {
      setRows([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    Promise.all([
      supabase.from("watchlist_item").select("id, watched").eq("media_type", mediaType).eq("tmdb_id", entityId),
      supabase.from("watchlist").select("id").eq("profile_id", uid).order("created_at").limit(1),
    ]).then(([itemsRes, listsRes]) => {
      if (cancelled) return;
      setRows(itemsRes.data ?? []);
      setFirstWatchlistId(listsRes.data?.[0]?.id ?? null);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [mediaType, entityId, uid]);

  const isWatched = rows.some((r) => r.watched);

  const toggleWatched = useCallback(async () => {
    if (!uid || !entityId || busy) return;
    setBusy(true);
    const next = !isWatched;
    try {
      if (rows.length > 0) {
        const ids = rows.map((r) => r.id);
        const { error } = await supabase.from("watchlist_item").update({ watched: next }).in("id", ids);
        if (!error) setRows((prev) => prev.map((r) => ({ ...r, watched: next })));
      } else {
        let listId = firstWatchlistId;
        if (!listId) {
          const { data, error } = await supabase
            .from("watchlist")
            .insert({ profile_id: uid, name: "My Watchlist" })
            .select("id")
            .single();
          if (error) return;
          listId = data.id;
          setFirstWatchlistId(listId);
        }
        const { data: item, error: itemErr } = await supabase
          .from("watchlist_item")
          .insert({ watchlist_id: listId, media_type: mediaType, tmdb_id: entityId, watched: next })
          .select("id, watched")
          .single();
        if (!itemErr && item) setRows([item]);
      }
    } finally {
      setBusy(false);
    }
  }, [uid, entityId, mediaType, rows, isWatched, firstWatchlistId, busy]);

  return { isWatched, isLoading, busy, toggleWatched };
}
