import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";

// Every past value a user's rating for this title has held (user_rating_history,
// written by a DB trigger on user_rating insert/update — see migration 039).
// Newest first. Clearing a rating isn't logged, only the initial value and
// later changes are — so entries.length === 1 just means "never changed".
export function useRatingHistory(mediaType, entityId, session) {
  const uid = session?.user?.id ?? null;
  const [entries, setEntries] = useState([]); // [{id, value, changed_at}]
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!uid || !entityId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("user_rating_history")
      .select("id, value, changed_at")
      .eq("profile_id", uid)
      .eq("media_type", mediaType)
      .eq("tmdb_id", entityId)
      .order("changed_at", { ascending: false })
      .then(({ data }) => {
        if (cancelled) return;
        setEntries(data ?? []);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [uid, mediaType, entityId]);

  // Edits the historical record only — the live rating (user_rating.value)
  // is untouched, see migration 041.
  const removeEntry = useCallback(
    async (id) => {
      if (busy) return { error: "Busy" };
      setBusy(true);
      const prev = entries;
      setEntries((cur) => cur.filter((e) => e.id !== id));
      const { error } = await supabase.from("user_rating_history").delete().eq("id", id);
      if (error) setEntries(prev);
      setBusy(false);
      return { error };
    },
    [entries, busy],
  );

  return { entries, loading, busy, removeEntry };
}
