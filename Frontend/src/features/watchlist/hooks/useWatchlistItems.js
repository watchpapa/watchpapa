import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";

const ITEM_SELECT = `
  id, media_type, watched, added_at,
  movie_id, show_id,
  movie:movie_id ( id, title, poster_path, release_date ),
  show:show_id  ( id, name,  poster_path, first_air_date )
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

    supabase
      .from("watchlist_item")
      .select(ITEM_SELECT)
      .eq("watchlist_id", watchlistId)
      .order("added_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error) setItems(data ?? []);
        setIsLoading(false);
      });

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

  const toggleWatched = useCallback(async (itemId, currentWatched) => {
    const { error } = await supabase
      .from("watchlist_item")
      .update({ watched: !currentWatched })
      .eq("id", itemId);

    if (!error) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, watched: !currentWatched } : item
        )
      );
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

  return { items, isLoading, addItem, removeItem, toggleWatched, moveItem };
}
