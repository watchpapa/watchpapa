import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase.js";
import { useContentBatch } from "../../content/hooks/useContentBatch.js";
import { cardKey } from "../../content/lib/keys.js";

// Followed shows + movies for the current user. The follow rows hold only tmdb_id
// + created_at; card metadata (title/poster/date/status) is hydrated from the Worker.
export function useFollows(session) {
  const uid = session?.user?.id;
  const [showRows, setShowRows] = useState([]); // [{ tmdb_id, created_at }]
  const [movieRows, setMovieRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!uid) {
      setShowRows([]);
      setMovieRows([]);
      return;
    }
    setLoading(true);
    const [showRes, movieRes] = await Promise.all([
      supabase
        .from("user_followed_shows")
        .select("tmdb_id, created_at")
        .eq("profile_id", uid)
        .order("created_at", { ascending: false }),
      supabase
        .from("user_followed_movies")
        .select("tmdb_id, created_at")
        .eq("profile_id", uid)
        .order("created_at", { ascending: false }),
    ]);
    setShowRows((showRes.data ?? []).map((r) => ({ ...r, tmdb_id: Number(r.tmdb_id) })));
    setMovieRows((movieRes.data ?? []).map((r) => ({ ...r, tmdb_id: Number(r.tmdb_id) })));
    setLoading(false);
  }, [uid]);

  useEffect(() => {
    load();
  }, [load]);

  const batchItems = useMemo(
    () => [
      ...showRows.map((r) => ({ type: "show", id: r.tmdb_id })),
      ...movieRows.map((r) => ({ type: "movie", id: r.tmdb_id })),
    ],
    [showRows, movieRows],
  );
  const { cards, loading: cardsLoading } = useContentBatch(batchItems);

  const shows = useMemo(
    () =>
      showRows.map((r) => {
        const c = cards[cardKey({ type: "show", id: r.tmdb_id })];
        return {
          show_id: r.tmdb_id,
          tmdb_id: r.tmdb_id,
          created_at: r.created_at,
          show: c
            ? { id: r.tmdb_id, name: c.title, poster_path: c.poster_path, first_air_date: c.date, last_air_date: c.last_air_date, status: c.status }
            : null,
        };
      }),
    [showRows, cards],
  );
  const movies = useMemo(
    () =>
      movieRows.map((r) => {
        const c = cards[cardKey({ type: "movie", id: r.tmdb_id })];
        return {
          movie_id: r.tmdb_id,
          tmdb_id: r.tmdb_id,
          created_at: r.created_at,
          movie: c ? { id: r.tmdb_id, title: c.title, poster_path: c.poster_path, release_date: c.date, status: c.status } : null,
        };
      }),
    [movieRows, cards],
  );

  const unfollowShow = useCallback(
    async (tmdbId) => {
      if (!uid) return;
      setShowRows((prev) => prev.filter((r) => r.tmdb_id !== tmdbId));
      const { error } = await supabase
        .from("user_followed_shows")
        .delete()
        .eq("profile_id", uid)
        .eq("tmdb_id", tmdbId);
      if (error) load();
    },
    [uid, load],
  );

  const unfollowMovie = useCallback(
    async (tmdbId) => {
      if (!uid) return;
      setMovieRows((prev) => prev.filter((r) => r.tmdb_id !== tmdbId));
      const { error } = await supabase
        .from("user_followed_movies")
        .delete()
        .eq("profile_id", uid)
        .eq("tmdb_id", tmdbId);
      if (error) load();
    },
    [uid, load],
  );

  return { shows, movies, loading: loading || cardsLoading, unfollowShow, unfollowMovie };
}
