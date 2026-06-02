import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";

const PAGE_SIZE = 20;
const RECENT_PAGE_SIZE = 10;

function sortRatings(ratings, sort) {
  const copies = [...ratings];
  if (sort === "oldest") {
    return copies.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  } else if (sort === "rating_desc") {
    return copies.sort((a, b) => b.value - a.value || new Date(b.created_at) - new Date(a.created_at));
  } else if (sort === "rating_asc") {
    return copies.sort((a, b) => a.value - b.value || new Date(b.created_at) - new Date(a.created_at));
  } else if (sort === "release_desc") {
    return copies.sort((a, b) => {
      const dateA = a.movie?.release_date || a.show?.first_air_date || a.season?.air_date || a.episode?.air_date || "";
      const dateB = b.movie?.release_date || b.show?.first_air_date || b.season?.air_date || b.episode?.air_date || "";
      return dateB.localeCompare(dateA);
    });
  } else if (sort === "release_asc") {
    return copies.sort((a, b) => {
      const dateA = a.movie?.release_date || a.show?.first_air_date || a.season?.air_date || a.episode?.air_date || "";
      const dateB = b.movie?.release_date || b.show?.first_air_date || b.season?.air_date || b.episode?.air_date || "";
      return dateA.localeCompare(dateB);
    });
  }
  return copies;
}

export function useProfileRatings(profileId, opts = {}) {
  const { since, sort = "newest" } = opts;
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const pageSz = since ? RECENT_PAGE_SIZE : PAGE_SIZE;

  const fetchPage = useCallback(async (pageNum, append) => {
    if (!profileId) return;
    setLoading(true);
    const from = pageNum * pageSz;
    const to = from + pageSz - 1;

    let query = supabase
      .from("user_rating")
      .select(`
        id, value, created_at,
        movie_id, show_id, season_id, episode_id,
        movie:movie_id(id, title, poster_path, release_date),
        show:show_id(id, name, poster_path, first_air_date),
        season:season_id(id, name, poster_path, air_date, show:show_id(id, name, poster_path)),
        episode:episode_id(id, name, air_date, season:season_id(id, show:show_id(id, name, poster_path)))
      `)
      .eq("profile_id", profileId);

    if (since) {
      query = query.gte("created_at", since);
    }

    const { data } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);

    setLoading(false);
    let rows = data ?? [];
    if (sort !== "newest") {
      rows = sortRatings(rows, sort);
    }
    setHasMore(rows.length === pageSz);
    setRatings((prev) => append ? [...prev, ...rows] : rows);
  }, [profileId, since, sort, pageSz]);

  useEffect(() => {
    setRatings([]);
    setPage(0);
    setHasMore(true);
    if (profileId) fetchPage(0, false);
  }, [profileId, since, sort, fetchPage]);

  const loadMore = useCallback(() => {
    const next = page + 1;
    setPage(next);
    fetchPage(next, true);
  }, [page, fetchPage, pageSz]);

  return { ratings, loading, hasMore, loadMore };
}
