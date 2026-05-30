import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";

// Fetches all followed shows + movies for the current user.
// Used by FollowsPage and potentially by overage checks.
export function useFollows(session) {
  const uid = session?.user?.id;
  const [shows, setShows] = useState([]);
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    const [showRes, movieRes] = await Promise.all([
      supabase
        .from("user_followed_shows")
        .select("show_id, created_at, show:show_id(id, name, poster_path, first_air_date, status)")
        .eq("profile_id", uid)
        .order("created_at", { ascending: false }),
      supabase
        .from("user_followed_movies")
        .select("movie_id, created_at, movie:movie_id(id, title, poster_path, release_date, status)")
        .eq("profile_id", uid)
        .order("created_at", { ascending: false }),
    ]);
    setShows(showRes.data ?? []);
    setMovies(movieRes.data ?? []);
    setLoading(false);
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  const unfollowShow = useCallback(async (showId) => {
    if (!uid) return;
    setShows((prev) => prev.filter((r) => r.show_id !== showId));
    const { error } = await supabase
      .from("user_followed_shows")
      .delete()
      .eq("profile_id", uid)
      .eq("show_id", showId);
    if (error) load();
  }, [uid, load]);

  const unfollowMovie = useCallback(async (movieId) => {
    if (!uid) return;
    setMovies((prev) => prev.filter((r) => r.movie_id !== movieId));
    const { error } = await supabase
      .from("user_followed_movies")
      .delete()
      .eq("profile_id", uid)
      .eq("movie_id", movieId);
    if (error) load();
  }, [uid, load]);

  return { shows, movies, loading, unfollowShow, unfollowMovie };
}
