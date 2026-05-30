import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";

export function useWatchlists(session) {
  const [watchlists, setWatchlists] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [limitError, setLimitError] = useState(null);

  useEffect(() => {
    if (!session?.user?.id) {
      setWatchlists([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);

    supabase
      .from("watchlist")
      .select("id, name, created_at, updated_at")
      .eq("profile_id", session.user.id)
      .order("created_at")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error) setWatchlists(data ?? []);
        setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [session?.user?.id]);

  const createWatchlist = useCallback(async (name) => {
    if (!session?.user?.id || !name?.trim()) return { error: "Invalid name" };
    setLimitError(null);

    const { data, error } = await supabase
      .from("watchlist")
      .insert({ profile_id: session.user.id, name: name.trim() })
      .select("id, name, created_at, updated_at")
      .single();

    if (error) {
      if (error.message?.includes("WATCHLIST_LIMIT_REACHED")) {
        const msg = error.message.replace("WATCHLIST_LIMIT_REACHED: ", "");
        setLimitError(msg);
      }
      return { error };
    }

    setWatchlists((prev) => [...prev, data]);
    return { data };
  }, [session?.user?.id]);

  const renameWatchlist = useCallback(async (id, name) => {
    if (!name?.trim()) return;

    const { error } = await supabase
      .from("watchlist")
      .update({ name: name.trim(), updated_at: new Date().toISOString() })
      .eq("id", id);

    if (!error) {
      setWatchlists((prev) =>
        prev.map((w) => (w.id === id ? { ...w, name: name.trim() } : w))
      );
    }
    return { error };
  }, []);

  const deleteWatchlist = useCallback(async (id) => {
    const { error } = await supabase
      .from("watchlist")
      .delete()
      .eq("id", id);

    if (!error) {
      setWatchlists((prev) => prev.filter((w) => w.id !== id));
    }
    return { error };
  }, []);

  return {
    watchlists,
    isLoading,
    limitError,
    clearLimitError: () => setLimitError(null),
    createWatchlist,
    renameWatchlist,
    deleteWatchlist,
  };
}
