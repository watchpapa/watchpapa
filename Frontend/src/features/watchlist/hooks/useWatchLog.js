import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";

// The rewatch diary for one movie/show: every logged watch, newest first.
// Replaces the old watchlist_item.watched boolean as the source of truth for
// "is this watched" — count is authoritative once loaded, no permanent
// fallback to a rating. See useRating.js (ensureWatchLogSeed) for how a
// rating seeds the first entry (once, at rating time — never re-seeded, so
// removing every entry here is a real, permanent "unwatch" that a rating
// alone won't undo). Reloads when a rating on this title seeds a new entry
// elsewhere on the page (the same watchpapa:watchlist-item-removed event
// removeFromWatchlistsOnRating.js dispatches). Logging a watch always
// removes the title from any watchlist it's currently on.
export function useWatchLog(mediaType, entityId, session) {
  const uid = session?.user?.id ?? null;
  const [entries, setEntries] = useState([]); // [{id, watched_at}], newest first
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    if (!uid || !entityId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("watch_log")
      .select("id, watched_at")
      .eq("profile_id", uid)
      .eq("media_type", mediaType)
      .eq("tmdb_id", entityId)
      .order("watched_at", { ascending: false })
      .then(({ data }) => {
        setEntries(data ?? []);
        setLoading(false);
      });
  }, [uid, mediaType, entityId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    function handleChanged(e) {
      const { mediaType: mt, tmdbId: eid } = e.detail ?? {};
      if (mt !== mediaType || String(eid) !== String(entityId)) return;
      reload();
    }
    window.addEventListener("watchpapa:watchlist-item-removed", handleChanged);
    return () => window.removeEventListener("watchpapa:watchlist-item-removed", handleChanged);
  }, [mediaType, entityId, reload]);

  const insertAndCleanup = useCallback(
    async (date) => {
      const row = { profile_id: uid, media_type: mediaType, tmdb_id: entityId };
      if (date) row.watched_at = date;
      const { data, error } = await supabase.from("watch_log").insert(row).select("id, watched_at").single();
      if (error) return { error };
      setEntries((prev) => [...prev, data].sort((a, b) => (a.watched_at < b.watched_at ? 1 : -1)));
      await supabase.from("watchlist_item").delete().eq("media_type", mediaType).eq("tmdb_id", entityId);
      window.dispatchEvent(
        new CustomEvent("watchpapa:watchlist-item-removed", { detail: { mediaType, tmdbId: entityId } }),
      );
      return { error: null };
    },
    [uid, entityId, mediaType],
  );

  const logWatch = useCallback(
    async (date) => {
      if (!uid || !entityId || busy) return { error: "Not signed in" };
      setBusy(true);
      const result = await insertAndCleanup(date);
      setBusy(false);
      return result;
    },
    [uid, entityId, busy, insertAndCleanup],
  );

  const removeEntry = useCallback(
    async (id) => {
      if (busy) return { error: "Busy" };
      setBusy(true);
      const prev = entries;
      setEntries((cur) => cur.filter((e) => e.id !== id));
      const { error } = await supabase.from("watch_log").delete().eq("id", id);
      if (error) setEntries(prev);
      setBusy(false);
      return { error };
    },
    [entries, busy],
  );

  return { entries, count: entries.length, loading, busy, logWatch, removeEntry };
}
