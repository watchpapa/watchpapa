import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";

const PAGE_SIZE = 20;

// Fetches paginated ratings for a profile (most recent first).
// Joins movie/show/season/episode for display data.
export function useProfileRatings(profileId) {
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const fetchPage = useCallback(async (pageNum, append) => {
    if (!profileId) return;
    setLoading(true);
    const from = pageNum * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data } = await supabase
      .from("user_rating")
      .select(`
        id, value, created_at,
        movie_id, show_id, season_id, episode_id,
        movie:movie_id(id, title, poster_path, release_date),
        show:show_id(id, name, poster_path, first_air_date),
        season:season_id(id, name, poster_path, air_date, show:show_id(id, name, poster_path)),
        episode:episode_id(id, name, air_date, season:season_id(id, show:show_id(id, name, poster_path)))
      `)
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .range(from, to);

    setLoading(false);
    const rows = data ?? [];
    setHasMore(rows.length === PAGE_SIZE);
    setRatings((prev) => append ? [...prev, ...rows] : rows);
  }, [profileId]);

  useEffect(() => {
    setRatings([]);
    setPage(0);
    setHasMore(true);
    if (profileId) fetchPage(0, false);
  }, [profileId, fetchPage]);

  const loadMore = useCallback(() => {
    const next = page + 1;
    setPage(next);
    fetchPage(next, true);
  }, [page, fetchPage]);

  return { ratings, loading, hasMore, loadMore };
}
