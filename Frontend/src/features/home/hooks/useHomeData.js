import { useCallback, useEffect, useReducer } from "react";
import { supabase } from "../../../lib/supabase.js";

const POPULAR_LIMIT = 20;

function toMovieItem(row, followedIds) {
  return {
    id: row.id,
    type: "movie",
    title: row.title,
    posterPath: row.poster_path ?? null,
    tmdbPopularity: row.tmdb_popularity,
    isFollowing: followedIds.has(row.id),
  };
}

function toShowItem(row, followedIds) {
  return {
    id: row.id,
    type: "show",
    title: row.name,
    posterPath: row.poster_path ?? null,
    tmdbPopularity: row.tmdb_popularity,
    isFollowing: followedIds.has(row.id),
  };
}

function reducer(state, action) {
  switch (action.type) {
    case "LOADED":
      return { ...state, ...action.payload, isLoading: false, error: null };
    case "ERROR":
      return { ...state, isLoading: false, error: action.error };
    case "TOGGLE_MOVIE": {
      const next = new Set(state.followedMovieIds);
      next.has(action.id) ? next.delete(action.id) : next.add(action.id);
      return { ...state, followedMovieIds: next };
    }
    case "TOGGLE_SHOW": {
      const next = new Set(state.followedShowIds);
      next.has(action.id) ? next.delete(action.id) : next.add(action.id);
      return { ...state, followedShowIds: next };
    }
    default:
      return state;
  }
}

const initialState = {
  movies: [],
  shows: [],
  followedMovieIds: new Set(),
  followedShowIds: new Set(),
  isLoading: true,
  error: null,
};

export function useHomeData(session) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [moviesRes, showsRes] = await Promise.all([
          supabase
            .from("movie")
            .select("id, tmdb_id, title, tmdb_popularity, poster_path")
            .is("deleted_at", null)
            .order("tmdb_popularity", { ascending: false })
            .limit(POPULAR_LIMIT),
          supabase
            .from("show")
            .select("id, tmdb_id, name, tmdb_popularity, poster_path")
            .is("deleted_at", null)
            .order("tmdb_popularity", { ascending: false })
            .limit(POPULAR_LIMIT),
        ]);

        if (moviesRes.error) throw moviesRes.error;
        if (showsRes.error) throw showsRes.error;

        let followedMovieIds = new Set();
        let followedShowIds = new Set();

        if (session?.user?.id) {
          const [fmRes, fsRes] = await Promise.all([
            supabase
              .from("user_followed_movies")
              .select("movie_id")
              .eq("profile_id", session.user.id),
            supabase
              .from("user_followed_shows")
              .select("show_id")
              .eq("profile_id", session.user.id),
          ]);

          if (!fmRes.error) followedMovieIds = new Set(fmRes.data.map((r) => r.movie_id));
          if (!fsRes.error) followedShowIds = new Set(fsRes.data.map((r) => r.show_id));
        }

        if (!cancelled) {
          dispatch({
            type: "LOADED",
            payload: {
              movies: moviesRes.data ?? [],
              shows: showsRes.data ?? [],
              followedMovieIds,
              followedShowIds,
            },
          });
        }
      } catch (err) {
        if (!cancelled) dispatch({ type: "ERROR", error: err.message });
      }
    }

    load();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  const toggleMovieFollow = useCallback(
    async (movieId) => {
      if (!session?.user?.id) return;
      const isFollowing = state.followedMovieIds.has(movieId);
      dispatch({ type: "TOGGLE_MOVIE", id: movieId });

      const { error } = isFollowing
        ? await supabase
            .from("user_followed_movies")
            .delete()
            .eq("profile_id", session.user.id)
            .eq("movie_id", movieId)
        : await supabase
            .from("user_followed_movies")
            .insert({ profile_id: session.user.id, movie_id: movieId });

      if (error) dispatch({ type: "TOGGLE_MOVIE", id: movieId });
    },
    [session?.user?.id, state.followedMovieIds],
  );

  const toggleShowFollow = useCallback(
    async (showId) => {
      if (!session?.user?.id) return;
      const isFollowing = state.followedShowIds.has(showId);
      dispatch({ type: "TOGGLE_SHOW", id: showId });

      const { error } = isFollowing
        ? await supabase
            .from("user_followed_shows")
            .delete()
            .eq("profile_id", session.user.id)
            .eq("show_id", showId)
        : await supabase
            .from("user_followed_shows")
            .insert({ profile_id: session.user.id, show_id: showId });

      if (error) dispatch({ type: "TOGGLE_SHOW", id: showId });
    },
    [session?.user?.id, state.followedShowIds],
  );

  const { movies, shows, followedMovieIds, followedShowIds, isLoading, error } = state;

  const movieItems = movies.map((m) => ({
    ...toMovieItem(m, followedMovieIds),
    onFollowToggle: () => toggleMovieFollow(m.id),
  }));

  const showItems = shows.map((s) => ({
    ...toShowItem(s, followedShowIds),
    onFollowToggle: () => toggleShowFollow(s.id),
  }));

  const popular = [...movies.map((m) => toMovieItem(m, followedMovieIds)), ...shows.map((s) => toShowItem(s, followedShowIds))]
    .sort((a, b) => b.tmdbPopularity - a.tmdbPopularity)
    .slice(0, POPULAR_LIMIT)
    .map((item) => ({
      ...item,
      onFollowToggle:
        item.type === "movie"
          ? () => toggleMovieFollow(item.id)
          : () => toggleShowFollow(item.id),
    }));

  return { popular, movieItems, showItems, isLoading, error };
}
