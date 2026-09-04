// Used by:
// - Frontend/src/features/home/hooks/useHomeData.js
//
// Gathers the "taste signal" for the home page's Suggested-for-you rows:
// highly-rated titles + watched-but-unrated watchlist items become seeds sent
// to POST /api/content/recommendations; every rated/watchlisted/followed
// title is also collected as an exclude list so suggestions never repeat
// something the user already knows about. Movie/show ratings and watchlist
// items only — season/episode ratings aren't used as seeds (v1 scope).
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";

const MIN_RATING_FOR_SEED = 6; // out of 10 — don't seed recommendations off things the user disliked
const MAX_RATING_SEEDS = 10;
const MAX_WATCHED_SEEDS = 10;

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
      const [ratingsRes, listsRes, followedMoviesRes, followedShowsRes] = await Promise.all([
        supabase.from("user_rating").select("media_type, tmdb_id, value").eq("profile_id", uid).in("media_type", ["movie", "show"]),
        supabase.from("watchlist").select("id").eq("profile_id", uid),
        supabase.from("user_followed_movies").select("tmdb_id").eq("profile_id", uid),
        supabase.from("user_followed_shows").select("tmdb_id").eq("profile_id", uid),
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
