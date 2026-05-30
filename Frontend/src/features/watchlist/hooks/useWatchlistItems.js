import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";

const ITEM_SELECT = `
  id, media_type, watched, added_at,
  movie_id, show_id,
  movie:movie_id ( id, title, poster_path, release_date, tmdb_vote_avg ),
  show:show_id  ( id, name,  poster_path, first_air_date, tmdb_vote_avg )
`.trim();

export function useWatchlistItems(watchlistId, session, refreshKey = 0) {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!watchlistId || !session?.user?.id) {
      setItems([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);

    async function loadItems() {
      const { data, error } = await supabase
        .from("watchlist_item")
        .select(ITEM_SELECT)
        .eq("watchlist_id", watchlistId)
        .order("added_at", { ascending: false });

      if (cancelled) return;
      if (error) {
        setIsLoading(false);
        return;
      }

      let rows = data ?? [];
      const movieIds = rows.filter((i) => i.media_type === "movie").map((i) => i.movie_id).filter(Boolean);
      const showIds = rows.filter((i) => i.media_type === "show").map((i) => i.show_id).filter(Boolean);
      const ratedMovieIds = new Set();
      const ratedShowIds = new Set();

      const ratingQueries = [];
      if (movieIds.length) {
        ratingQueries.push(
          supabase
            .from("user_rating")
            .select("movie_id")
            .eq("profile_id", session.user.id)
            .in("movie_id", movieIds)
        );
      }
      if (showIds.length) {
        ratingQueries.push(
          supabase
            .from("user_rating")
            .select("show_id")
            .eq("profile_id", session.user.id)
            .in("show_id", showIds)
        );
      }

      if (ratingQueries.length) {
        const results = await Promise.all(ratingQueries);
        if (cancelled) return;
        for (const { data: ratings } of results) {
          for (const row of ratings ?? []) {
            if (row.movie_id != null) ratedMovieIds.add(row.movie_id);
            if (row.show_id != null) ratedShowIds.add(row.show_id);
          }
        }
      }

      const staleIds = rows
        .filter((item) =>
          (item.media_type === "movie" && ratedMovieIds.has(item.movie_id)) ||
          (item.media_type === "show" && ratedShowIds.has(item.show_id))
        )
        .map((item) => item.id);

      if (staleIds.length) {
        await supabase.from("watchlist_item").delete().in("id", staleIds);
        if (cancelled) return;
        rows = rows.filter((item) => !staleIds.includes(item.id));
      }

      setItems(rows);
      setIsLoading(false);
    }

    loadItems();

    return () => { cancelled = true; };
  }, [watchlistId, session?.user?.id, refreshKey]);

  const addItem = useCallback(async (mediaType, entityId) => {
    const payload = {
      watchlist_id: watchlistId,
      media_type: mediaType,
      ...(mediaType === "movie" ? { movie_id: entityId } : { show_id: entityId }),
    };

    const { data, error } = await supabase
      .from("watchlist_item")
      .insert(payload)
      .select(ITEM_SELECT)
      .single();

    if (!error && data) {
      setItems((prev) => [data, ...prev]);
    }
    return { data, error };
  }, [watchlistId]);

  const removeItem = useCallback(async (itemId) => {
    const { error } = await supabase
      .from("watchlist_item")
      .delete()
      .eq("id", itemId);

    if (!error) {
      setItems((prev) => prev.filter((item) => item.id !== itemId));
    }
    return { error };
  }, []);

  const moveItem = useCallback(async (itemId, targetWatchlistId) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return { error: "Item not found" };

    const payload = {
      watchlist_id: targetWatchlistId,
      media_type: item.media_type,
      watched: item.watched,
      ...(item.media_type === "movie" ? { movie_id: item.movie_id } : { show_id: item.show_id }),
    };

    const { error: insertErr } = await supabase.from("watchlist_item").insert(payload);
    if (insertErr) return { error: insertErr };

    const { error: deleteErr } = await supabase.from("watchlist_item").delete().eq("id", itemId);
    if (!deleteErr) setItems((prev) => prev.filter((i) => i.id !== itemId));
    return { error: deleteErr };
  }, [items]);

  return { items, isLoading, addItem, removeItem, moveItem };
}
