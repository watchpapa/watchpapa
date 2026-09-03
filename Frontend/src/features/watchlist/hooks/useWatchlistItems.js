import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase.js";
import { useContentBatch } from "../../content/hooks/useContentBatch.js";
import { cardKey } from "../../content/lib/keys.js";

// Watchlist items hold only (media_type, tmdb_id); card metadata is hydrated
// from the Worker. Rating an item still auto-removes it from the list.
const ROW_SELECT = "id, media_type, tmdb_id, watched, added_at";

function withCard(row, cards) {
  const c = cards[cardKey({ type: row.media_type, id: Number(row.tmdb_id) })];
  const media = c
    ? {
        id: Number(row.tmdb_id),
        title: c.title,
        name: c.title,
        poster_path: c.poster_path,
        release_date: c.date,
        first_air_date: c.date,
        tmdb_vote_avg: c.tmdb_vote_avg,
      }
    : null;
  return {
    ...row,
    tmdb_id: Number(row.tmdb_id),
    movie: row.media_type === "movie" ? media : null,
    show: row.media_type === "show" ? media : null,
  };
}

export function useWatchlistItems(watchlistId, session, refreshKey = 0) {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!watchlistId || !session?.user?.id) {
      setRows([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      const { data, error } = await supabase
        .from("watchlist_item")
        .select(ROW_SELECT)
        .eq("watchlist_id", watchlistId)
        .order("added_at", { ascending: false });
      if (cancelled) return;
      if (error) {
        setIsLoading(false);
        return;
      }
      let list = (data ?? []).map((r) => ({ ...r, tmdb_id: Number(r.tmdb_id) }));

      // Auto-remove items the user has since rated.
      const byType = { movie: [], show: [] };
      for (const r of list) byType[r.media_type]?.push(r.tmdb_id);
      const ratedKeys = new Set();
      const ratingQs = [];
      for (const mt of ["movie", "show"]) {
        if (byType[mt].length) {
          ratingQs.push(
            supabase
              .from("user_rating")
              .select("tmdb_id")
              .eq("profile_id", session.user.id)
              .eq("media_type", mt)
              .in("tmdb_id", byType[mt])
              .then(({ data: rd }) => {
                for (const row of rd ?? []) ratedKeys.add(`${mt}:${Number(row.tmdb_id)}`);
              }),
          );
        }
      }
      await Promise.all(ratingQs);
      if (cancelled) return;

      const staleIds = list
        .filter((r) => ratedKeys.has(`${r.media_type}:${r.tmdb_id}`))
        .map((r) => r.id);
      if (staleIds.length) {
        await supabase.from("watchlist_item").delete().in("id", staleIds);
        if (cancelled) return;
        list = list.filter((r) => !staleIds.includes(r.id));
      }

      setRows(list);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [watchlistId, session?.user?.id, refreshKey]);

  const { cards, loading: cardsLoading } = useContentBatch(
    useMemo(() => rows.map((r) => ({ type: r.media_type, id: r.tmdb_id })), [rows]),
  );

  const items = useMemo(() => rows.map((r) => withCard(r, cards)), [rows, cards]);

  const addItem = useCallback(
    async (mediaType, entityId) => {
      const { data, error } = await supabase
        .from("watchlist_item")
        .insert({ watchlist_id: watchlistId, media_type: mediaType, tmdb_id: entityId })
        .select(ROW_SELECT)
        .single();
      if (!error && data) setRows((prev) => [{ ...data, tmdb_id: Number(data.tmdb_id) }, ...prev]);
      return { data, error };
    },
    [watchlistId],
  );

  const removeItem = useCallback(async (itemId) => {
    const { error } = await supabase.from("watchlist_item").delete().eq("id", itemId);
    if (!error) setRows((prev) => prev.filter((r) => r.id !== itemId));
    return { error };
  }, []);

  const moveItem = useCallback(
    async (itemId, targetWatchlistId) => {
      const row = rows.find((r) => r.id === itemId);
      if (!row) return { error: "Item not found" };
      const { error: insertErr } = await supabase
        .from("watchlist_item")
        .insert({ watchlist_id: targetWatchlistId, media_type: row.media_type, tmdb_id: row.tmdb_id, watched: row.watched });
      if (insertErr) return { error: insertErr };
      const { error: deleteErr } = await supabase.from("watchlist_item").delete().eq("id", itemId);
      if (!deleteErr) setRows((prev) => prev.filter((r) => r.id !== itemId));
      return { error: deleteErr };
    },
    [rows],
  );

  return { items, isLoading: isLoading || cardsLoading, addItem, removeItem, moveItem };
}
