import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";

// For detail pages: fetches all user watchlists and whether this item is in each one.
// membershipMap: { [watchlistId]: itemId | null }
export function useItemWatchlistStatus(mediaType, entityId, session) {
  const [watchlists, setWatchlists] = useState([]);
  const [membershipMap, setMembershipMap] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [pendingIds, setPendingIds] = useState(new Set());

  useEffect(() => {
    if (!session?.user?.id || !entityId) {
      setWatchlists([]);
      setMembershipMap({});
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);

    Promise.all([
      supabase
        .from("watchlist")
        .select("id, name")
        .eq("profile_id", session.user.id)
        .order("created_at"),
      supabase
        .from("watchlist_item")
        .select("id, watchlist_id")
        .eq("media_type", mediaType)
        .eq("tmdb_id", entityId),
    ]).then(([listsResult, itemsResult]) => {
      if (cancelled) return;
      const lists = listsResult.data ?? [];
      const existingItems = itemsResult.data ?? [];

      const map = {};
      for (const list of lists) map[list.id] = null;
      for (const item of existingItems) {
        if (map[item.watchlist_id] !== undefined) {
          map[item.watchlist_id] = item.id;
        }
      }

      setWatchlists(lists);
      setMembershipMap(map);
      setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, [mediaType, entityId, session?.user?.id]);

  useEffect(() => {
    function handleRemoved(e) {
      const { mediaType: mt, tmdbId: eid } = e.detail ?? {};
      if (mt !== mediaType || String(eid) !== String(entityId)) return;
      setMembershipMap((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) next[key] = null;
        return next;
      });
    }

    window.addEventListener("watchpapa:watchlist-item-removed", handleRemoved);
    return () => window.removeEventListener("watchpapa:watchlist-item-removed", handleRemoved);
  }, [mediaType, entityId]);

  const toggleInWatchlist = useCallback(async (watchlistId) => {
    if (!entityId) return;
    const existingItemId = membershipMap[watchlistId];
    setPendingIds((prev) => new Set(prev).add(watchlistId));

    if (existingItemId !== null && existingItemId !== undefined) {
      const { error } = await supabase
        .from("watchlist_item")
        .delete()
        .eq("id", existingItemId);

      if (!error) {
        setMembershipMap((prev) => ({ ...prev, [watchlistId]: null }));
      }
    } else {
      const { data, error } = await supabase
        .from("watchlist_item")
        .insert({ watchlist_id: watchlistId, media_type: mediaType, tmdb_id: entityId })
        .select("id")
        .single();

      if (!error && data) {
        setMembershipMap((prev) => ({ ...prev, [watchlistId]: data.id }));
      }
    }

    setPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(watchlistId);
      return next;
    });
  }, [mediaType, entityId, membershipMap]);

  const isInAny = Object.values(membershipMap).some((v) => v !== null);

  return {
    watchlists,
    membershipMap,
    isLoading,
    isInAny,
    pendingIds,
    toggleInWatchlist,
    setWatchlists,
    setMembershipMap,
  };
}
