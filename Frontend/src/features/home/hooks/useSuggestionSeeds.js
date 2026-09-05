// Used by:
// - Frontend/src/features/home/hooks/useHomeData.js
//
// Gathers the "taste signal" for the home page's Suggested-for-you rows:
// highly-rated titles + watched-but-unrated watchlist items become seeds sent
// to POST /api/content/recommendations; every rated/watchlisted/followed
// title is also collected as an exclude list so suggestions never repeat
// something the user already knows about. Movie/show ratings and watchlist
// items only feed seeds — season/episode ratings aren't used as seeds (v1
// scope), but a show rated episode-by-episode (or season-by-season) with no
// remaining unrated season is still added to the exclude list once every
// season is covered — same as if the show itself had been rated.
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";
import { apiFetch } from "../../../lib/api.js";

const MIN_RATING_FOR_SEED = 6; // out of 10 — don't seed recommendations off things the user disliked
const MAX_RATING_SEEDS = 10;
const MAX_WATCHED_SEEDS = 10;
const MAX_COMPLETION_CHECKS = 15; // cap show-detail fetches for shows rated only via seasons/episodes

export function useSuggestionSeeds(session) {
  const uid = session?.user?.id ?? null;
  const [items, setItems] = useState([]); // [{type,id}] — seed pool
  const [exclude, setExclude] = useState([]); // [{type,id}] — never recommend these back
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!uid) {
      setItems([]);
      setExclude([]);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    setLoaded(false);
    (async () => {
      const [ratingsRes, listsRes, followedMoviesRes, followedShowsRes, episodeRatingsRes] = await Promise.all([
        supabase.from("user_rating").select("media_type, tmdb_id, value").eq("profile_id", uid).in("media_type", ["movie", "show"]),
        supabase.from("watchlist").select("id").eq("profile_id", uid),
        supabase.from("user_followed_movies").select("tmdb_id").eq("profile_id", uid),
        supabase.from("user_followed_shows").select("tmdb_id").eq("profile_id", uid),
        supabase
          .from("user_rating")
          .select("tmdb_show_id, media_type, season_number, episode_number")
          .eq("profile_id", uid)
          .in("media_type", ["season", "episode"]),
      ]);
      if (cancelled) return;

      const ratings = (ratingsRes.data ?? []).map((r) => ({ ...r, tmdb_id: Number(r.tmdb_id) }));
      const listIds = (listsRes.data ?? []).map((l) => l.id);

      let watchlistRows = [];
      if (listIds.length > 0) {
        const wlRes = await supabase.from("watchlist_item").select("media_type, tmdb_id, watched").in("watchlist_id", listIds);
        if (cancelled) return;
        watchlistRows = (wlRes.data ?? []).map((r) => ({ ...r, tmdb_id: Number(r.tmdb_id) }));
      }

      const ratedKeys = new Set(ratings.map((r) => `${r.media_type}:${r.tmdb_id}`));

      const ratingSeeds = ratings
        .filter((r) => r.value >= MIN_RATING_FOR_SEED)
        .sort((a, b) => b.value - a.value)
        .slice(0, MAX_RATING_SEEDS)
        .map((r) => ({ type: r.media_type, id: r.tmdb_id }));

      const watchedSeeds = watchlistRows
        .filter((r) => r.watched && !ratedKeys.has(`${r.media_type}:${r.tmdb_id}`))
        .slice(0, MAX_WATCHED_SEEDS)
        .map((r) => ({ type: r.media_type, id: r.tmdb_id }));

      const seedMap = new Map();
      for (const s of [...ratingSeeds, ...watchedSeeds]) seedMap.set(`${s.type}:${s.id}`, s);

      const excludeMap = new Map();
      for (const r of ratings) excludeMap.set(`${r.media_type}:${r.tmdb_id}`, { type: r.media_type, id: r.tmdb_id });
      for (const r of watchlistRows) excludeMap.set(`${r.media_type}:${r.tmdb_id}`, { type: r.media_type, id: r.tmdb_id });
      for (const row of followedMoviesRes.data ?? []) excludeMap.set(`movie:${Number(row.tmdb_id)}`, { type: "movie", id: Number(row.tmdb_id) });
      for (const row of followedShowsRes.data ?? []) excludeMap.set(`show:${Number(row.tmdb_id)}`, { type: "show", id: Number(row.tmdb_id) });

      // Shows rated only via seasons/episodes (show itself never rated): group
      // by show, then check TMDB whether every real season is covered.
      const byShow = new Map();
      for (const r of episodeRatingsRes.data ?? []) {
        const showId = Number(r.tmdb_show_id);
        if (!showId || ratedKeys.has(`show:${showId}`)) continue;
        if (!byShow.has(showId)) byShow.set(showId, { seasons: new Set(), episodes: new Set() });
        const g = byShow.get(showId);
        if (r.media_type === "season") g.seasons.add(r.season_number);
        else g.episodes.add(`${r.season_number}:${r.episode_number}`);
      }

      const candidateShowIds = [...byShow.keys()].slice(0, MAX_COMPLETION_CHECKS);
      await Promise.all(
        candidateShowIds.map(async (showId) => {
          try {
            const detail = await apiFetch(`/api/content/show/${showId}`);
            const realSeasons = (detail.seasons ?? []).filter((s) => s.season_number > 0);
            if (realSeasons.length === 0) return;
            const g = byShow.get(showId);
            const covered = realSeasons.every((s) => {
              if (g.seasons.has(s.season_number)) return true;
              const count = s.episode_count ?? 0;
              if (count === 0) return false;
              for (let ep = 1; ep <= count; ep++) {
                if (!g.episodes.has(`${s.season_number}:${ep}`)) return false;
              }
              return true;
            });
            if (covered) excludeMap.set(`show:${showId}`, { type: "show", id: showId });
          } catch {
            /* leave un-excluded on fetch failure */
          }
        }),
      );
      if (cancelled) return;

      setItems([...seedMap.values()]);
      setExclude([...excludeMap.values()]);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  return { items, exclude, loaded };
}
