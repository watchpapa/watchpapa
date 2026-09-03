import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase.js";
import { useContentBatch } from "../../content/hooks/useContentBatch.js";
import { cardKey } from "../../content/lib/keys.js";

const PRO_TIERS = new Set(["pro", "pro_plus", "god"]);
const PREMIUM_TIERS = new Set(["premium", "pro", "pro_plus", "god"]);

// Owner tier decides which stats are computed. Genre + decade breakdowns are now
// derived client-side from hydrated TMDB cards (get_profile_genre_stats is gone).
export function useProfileStats(profileId, ownerTier) {
  const [rows, setRows] = useState([]); // [{ value, created_at, media_type, tmdb_id }]
  const [loading, setLoading] = useState(false);

  const wantsContent = PREMIUM_TIERS.has(ownerTier); // genre needs premium+, decade needs pro+

  useEffect(() => {
    if (!profileId || !ownerTier) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from("user_rating")
      .select("value, created_at, media_type, tmdb_id")
      .eq("profile_id", profileId)
      .then(({ data }) => {
        if (cancelled) return;
        setRows((data ?? []).map((r) => ({ ...r, tmdb_id: Number(r.tmdb_id) })));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profileId, ownerTier]);

  // Hydrate only movie + show ratings, and only if the tier can see genre/decade.
  const batchItems = useMemo(
    () =>
      wantsContent
        ? rows.filter((r) => r.media_type === "movie" || r.media_type === "show").map((r) => ({ type: r.media_type, id: r.tmdb_id }))
        : [],
    [rows, wantsContent],
  );
  const { cards } = useContentBatch(batchItems);

  const basic = useMemo(() => {
    if (rows.length === 0 && !loading) return { total: 0, avg: null, histogram: {}, movieCount: 0, showCount: 0, seasonCount: 0, episodeCount: 0 };
    if (loading && rows.length === 0) return null;
    const histogram = {};
    let sum = 0;
    for (const r of rows) {
      histogram[r.value] = (histogram[r.value] ?? 0) + 1;
      sum += r.value;
    }
    return {
      total: rows.length,
      avg: rows.length ? Math.round((sum / rows.length) * 10) / 10 : null,
      histogram,
      movieCount: rows.filter((r) => r.media_type === "movie").length,
      showCount: rows.filter((r) => r.media_type === "show").length,
      seasonCount: rows.filter((r) => r.media_type === "season").length,
      episodeCount: rows.filter((r) => r.media_type === "episode").length,
    };
  }, [rows, loading]);

  const genreStats = useMemo(() => {
    if (!PREMIUM_TIERS.has(ownerTier)) return null;
    const agg = new Map();
    for (const r of rows) {
      if (r.media_type !== "movie" && r.media_type !== "show") continue;
      const card = cards[cardKey({ type: r.media_type, id: r.tmdb_id })];
      for (const g of card?.genres ?? []) {
        const e = agg.get(g.name) ?? { count: 0, sum: 0 };
        e.count += 1;
        e.sum += r.value;
        agg.set(g.name, e);
      }
    }
    return [...agg.entries()]
      .map(([genre_name, e]) => ({ genre_name, rating_count: e.count, avg_value: Math.round((e.sum / e.count) * 10) / 10 }))
      .sort((a, b) => b.rating_count - a.rating_count)
      .slice(0, 20);
  }, [rows, cards, ownerTier]);

  const decadeStats = useMemo(() => {
    if (!PRO_TIERS.has(ownerTier)) return null;
    const map = {};
    for (const r of rows) {
      if (r.media_type !== "movie" && r.media_type !== "show") continue;
      const card = cards[cardKey({ type: r.media_type, id: r.tmdb_id })];
      if (!card?.year) continue;
      const decade = Math.floor(Number(card.year) / 10) * 10;
      map[decade] = (map[decade] ?? 0) + 1;
    }
    return Object.entries(map)
      .map(([decade, count]) => ({ decade: parseInt(decade, 10), count }))
      .sort((a, b) => a.decade - b.decade);
  }, [rows, cards, ownerTier]);

  const monthlyStats = useMemo(() => {
    if (!PRO_TIERS.has(ownerTier)) return null;
    const map = {};
    for (const r of rows) {
      const m = r.created_at.slice(0, 7);
      map[m] = (map[m] ?? 0) + 1;
    }
    return Object.entries(map)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-24);
  }, [rows, ownerTier]);

  return { basic, genreStats, decadeStats, monthlyStats, loading };
}
