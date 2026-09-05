import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";

// Whether a show counts as "fully rated" without the show entity itself being
// rated: every real (non-special) season has a season-level rating, or every
// one of its episodes has an episode-level rating (season-by-season, mixing
// season and episode ratings is fine as long as each season is covered one
// way or the other). Used to treat episode/season-by-episode raters the same
// as someone who just rated the show as a whole (ShowPage watched status +
// excluding the show from "Suggested for you" — see useSuggestionSeeds.js).
export function useShowCompletion(showId, seasons, session) {
  const uid = session?.user?.id ?? null;
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    const realSeasons = (seasons ?? []).filter((s) => s.season_number > 0);
    if (!uid || !showId || realSeasons.length === 0) {
      setComplete(false);
      return;
    }
    let cancelled = false;
    supabase
      .from("user_rating")
      .select("media_type, season_number, episode_number")
      .eq("profile_id", uid)
      .eq("tmdb_show_id", showId)
      .in("media_type", ["season", "episode"])
      .then(({ data }) => {
        if (cancelled) return;
        const rows = data ?? [];
        const ratedSeasonNums = new Set(rows.filter((r) => r.media_type === "season").map((r) => r.season_number));
        const ratedEpisodeKeys = new Set(
          rows.filter((r) => r.media_type === "episode").map((r) => `${r.season_number}:${r.episode_number}`),
        );

        const seasonCovered = (s) => {
          if (ratedSeasonNums.has(s.season_number)) return true;
          const count = s.episode_count ?? 0;
          if (count === 0) return false;
          for (let ep = 1; ep <= count; ep++) {
            if (!ratedEpisodeKeys.has(`${s.season_number}:${ep}`)) return false;
          }
          return true;
        };

        setComplete(realSeasons.every(seasonCovered));
      });
    return () => {
      cancelled = true;
    };
  }, [uid, showId, seasons]);

  return complete;
}
