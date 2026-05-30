import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";

const PRO_TIERS = new Set(["pro", "pro_plus", "god"]);
const PREMIUM_TIERS = new Set(["premium", "pro", "pro_plus", "god"]);

// Fetches stats for a profile. The owner's tier determines which stats are available.
// Tier-locked stats return null (caller renders fake blur instead of fetching).
export function useProfileStats(profileId, ownerTier) {
  const [basic, setBasic] = useState(null);
  const [genreStats, setGenreStats] = useState(null);
  const [decadeStats, setDecadeStats] = useState(null);
  const [monthlyStats, setMonthlyStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profileId || !ownerTier) return;
    let cancelled = false;
    setLoading(true);

    const fetches = [
      // Basic stats: always fetch
      supabase
        .from("user_rating")
        .select("value, created_at, movie_id, show_id, season_id, episode_id")
        .eq("profile_id", profileId),

      // Genre stats: premium+
      PREMIUM_TIERS.has(ownerTier)
        ? supabase.rpc("get_profile_genre_stats", { p_profile_id: profileId })
        : Promise.resolve({ data: null }),

      // Decade stats: pro+
      PRO_TIERS.has(ownerTier)
        ? supabase
            .from("user_rating")
            .select(`
              value,
              movie:movie_id(release_date),
              show:show_id(first_air_date),
              season:season_id(air_date),
              episode:episode_id(air_date)
            `)
            .eq("profile_id", profileId)
        : Promise.resolve({ data: null }),

      // Monthly activity: pro+
      PRO_TIERS.has(ownerTier)
        ? supabase
            .from("user_rating")
            .select("created_at")
            .eq("profile_id", profileId)
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: null }),
    ];

    Promise.all(fetches).then(([basicRes, genreRes, decadeRaw, monthlyRaw]) => {
      if (cancelled) return;
      setLoading(false);

      // Basic
      const rows = basicRes.data ?? [];
      const histogram = {};
      let sum = 0;
      for (const r of rows) {
        histogram[r.value] = (histogram[r.value] ?? 0) + 1;
        sum += r.value;
      }
      setBasic({
        total: rows.length,
        avg: rows.length ? Math.round((sum / rows.length) * 10) / 10 : null,
        histogram,
        movieCount: rows.filter((r) => r.movie_id).length,
        showCount: rows.filter((r) => r.show_id).length,
        seasonCount: rows.filter((r) => r.season_id).length,
        episodeCount: rows.filter((r) => r.episode_id).length,
      });

      // Genre
      setGenreStats(genreRes.data ?? null);

      // Decade: aggregate from raw rows
      if (decadeRaw.data) {
        const decadeMap = {};
        for (const r of decadeRaw.data) {
          const date = r.movie?.release_date ?? r.show?.first_air_date ?? r.season?.air_date ?? r.episode?.air_date;
          if (!date) continue;
          const decade = Math.floor(new Date(date).getFullYear() / 10) * 10;
          decadeMap[decade] = (decadeMap[decade] ?? 0) + 1;
        }
        setDecadeStats(
          Object.entries(decadeMap)
            .map(([decade, count]) => ({ decade: parseInt(decade), count }))
            .sort((a, b) => a.decade - b.decade)
        );
      } else {
        setDecadeStats(null);
      }

      // Monthly: aggregate from raw rows
      if (monthlyRaw.data) {
        const monthMap = {};
        for (const r of monthlyRaw.data) {
          const m = r.created_at.slice(0, 7); // "YYYY-MM"
          monthMap[m] = (monthMap[m] ?? 0) + 1;
        }
        setMonthlyStats(
          Object.entries(monthMap)
            .map(([month, count]) => ({ month, count }))
            .sort((a, b) => a.month.localeCompare(b.month))
            .slice(-24)
        );
      } else {
        setMonthlyStats(null);
      }
    });

    return () => { cancelled = true; };
  }, [profileId, ownerTier]);

  return { basic, genreStats, decadeStats, monthlyStats, loading };
}
