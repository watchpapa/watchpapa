import { useCallback, useEffect, useReducer } from "react";
import { supabase } from "../../../lib/supabase.js";

const FETCH_LIMIT = 200;
const ROW_LIMIT = 20;
const MIN_GENRE_COUNT = 3;

function reducer(state, action) {
  switch (action.type) {
    case "LOADED":
      return { ...state, ...action.payload, isLoading: false, error: null };
    case "ERROR":
      return { ...state, isLoading: false, error: action.error };
    case "TOGGLE": {
      const next = new Set(state.followedIds);
      next.has(action.id) ? next.delete(action.id) : next.add(action.id);
      return { ...state, followedIds: next };
    }
    default:
      return state;
  }
}

export function useMoviesPageData(session) {
  const [state, dispatch] = useReducer(reducer, {
    movies: [],
    followedIds: new Set(),
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [moviesRes, followRes] = await Promise.all([
          supabase
            .from("movie")
            .select("id, title, poster_path, tmdb_popularity, movie_genre(genres(id, name))")
            .is("deleted_at", null)
            .order("tmdb_popularity", { ascending: false })
            .limit(FETCH_LIMIT),
          session?.user?.id
            ? supabase.from("user_followed_movies").select("movie_id").eq("profile_id", session.user.id)
            : Promise.resolve({ data: [] }),
        ]);

        if (moviesRes.error) throw moviesRes.error;
        if (cancelled) return;

        dispatch({
          type: "LOADED",
          payload: {
            movies: moviesRes.data ?? [],
            followedIds: new Set((followRes.data ?? []).map((r) => r.movie_id)),
          },
        });
      } catch (err) {
        if (!cancelled) dispatch({ type: "ERROR", error: err.message });
      }
    }

    load();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  const toggleFollow = useCallback(async (movieId) => {
    if (!session?.user?.id) return;
    const was = state.followedIds.has(movieId);
    dispatch({ type: "TOGGLE", id: movieId });
    const { error } = was
      ? await supabase.from("user_followed_movies").delete().eq("profile_id", session.user.id).eq("movie_id", movieId)
      : await supabase.from("user_followed_movies").insert({ profile_id: session.user.id, movie_id: movieId });
    if (error) dispatch({ type: "TOGGLE", id: movieId });
  }, [session?.user?.id, state.followedIds]);

  const { movies, followedIds, isLoading, error } = state;

  const toItem = (row) => ({
    id: row.id,
    type: "movie",
    title: row.title,
    posterPath: row.poster_path ?? null,
    isFollowing: followedIds.has(row.id),
    onFollowToggle: () => toggleFollow(row.id),
  });

  const popular = movies.slice(0, ROW_LIMIT).map(toItem);

  const genreMap = new Map();
  for (const movie of movies) {
    for (const mg of (movie.movie_genre ?? [])) {
      const genre = mg.genres;
      if (!genre) continue;
      if (!genreMap.has(genre.id)) genreMap.set(genre.id, { id: genre.id, name: genre.name, movies: [] });
      const entry = genreMap.get(genre.id);
      if (entry.movies.length < ROW_LIMIT) entry.movies.push(movie);
    }
  }

  const byGenre = [...genreMap.values()]
    .filter((g) => g.movies.length >= MIN_GENRE_COUNT)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((g) => ({ genreId: g.id, genreName: g.name, items: g.movies.map(toItem) }));

  return { popular, byGenre, isLoading, error };
}
