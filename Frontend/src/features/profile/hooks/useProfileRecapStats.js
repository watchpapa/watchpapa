import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase.js";
import { useContentBatch } from "../../content/hooks/useContentBatch.js";
import { cardKey } from "../../content/lib/keys.js";

// Weekly / monthly rating recap. Poster thumbnails hydrated from the Worker.
export function useProfileRecapStats(profileId, tier) {
  const [rows, setRows] = useState([]); // last 30d of movie/show ratings: { value, created_at, media_type, tmdb_id }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!profileId || !tier) {
      setRows([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    supabase
      .from("user_rating")
      .select("value, created_at, media_type, tmdb_id")
      .eq("profile_id", profileId)
      .in("media_type", ["movie", "show"])
      .gte("created_at", since30)
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError(err.message);
        setRows((data ?? []).map((r) => ({ ...r, tmdb_id: Number(r.tmdb_id) })));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profileId, tier]);

  const { cards } = useContentBatch(
    useMemo(() => rows.map((r) => ({ type: r.media_type, id: r.tmdb_id })), [rows]),
  );

  const { weekly, monthly } = useMemo(() => {
    const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const aggregate = (rs) => {
      if (!rs.length) return { count: 0, avg: null, movieCount: 0, showCount: 0, posters: [] };
      const avg = +(rs.reduce((s, r) => s + r.value, 0) / rs.length).toFixed(1);
      const posters = rs
        .map((r) => cards[cardKey({ type: r.media_type, id: r.tmdb_id })]?.poster_path)
        .filter(Boolean)
        .slice(0, 6);
      return {
        count: rs.length,
        avg,
        movieCount: rs.filter((r) => r.media_type === "movie").length,
        showCount: rs.filter((r) => r.media_type === "show").length,
        posters,
      };
    };
    return { weekly: aggregate(rows.filter((r) => r.created_at >= since7)), monthly: aggregate(rows) };
  }, [rows, cards]);

  return { weekly, monthly, loading, error };
}
