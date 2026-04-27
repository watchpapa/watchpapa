import { useCallback, useEffect, useReducer, useRef } from "react";
import { supabase } from "../../../lib/supabase.js";

const PAGE_SIZE = 100;
const MIN_GENRE_COUNT = 3;

const MOVIE_SELECT =
  "id, title, poster_path, tmdb_popularity, movie_genre(genres(id, name))";

function reducer(state, action) {
  switch (action.type) {
    case "LOADED":
      return {
        ...state,
        ...action.payload,
        isLoading: false,
        error: null,
        loadingMorePopular: false,
        loadingMoreGenreId: null,
      };
    case "SET_LOADING_MORE_POPULAR":
      return { ...state, loadingMorePopular: action.value };
    case "SET_LOADING_MORE_GENRE":
      return { ...state, loadingMoreGenreId: action.genreId };
    case "UPDATE_AFTER_POPULAR_LOAD":
      return {
        ...state,
        movies: action.payload.movies,
        movieHasMore: action.payload.movieHasMore,
        popularDisplayCount: action.payload.popularDisplayCount,
        loadingMorePopular: false,
      };
    case "UPDATE_AFTER_GENRE_LOAD":
      return {
        ...state,
        movies: action.payload.movies,
        movieHasMore: action.payload.movieHasMore,
        genreRowLimits: { ...state.genreRowLimits, ...action.payload.genreRowLimits },
        loadingMoreGenreId: null,
      };
    case "ERROR":
      return {
        ...state,
        isLoading: false,
        error: action.error,
        loadingMorePopular: false,
        loadingMoreGenreId: null,
      };
    case "TOGGLE": {
      const next = new Set(state.followedIds);
      next.has(action.id) ? next.delete(action.id) : next.add(action.id);
      return { ...state, followedIds: next };
    }
    default:
      return state;
  }
}

function genreKey(id) {
  return String(id);
}

/** Movies are in global popularity order; list all loaded movies that include this genre. */
function moviesForGenre(movies, genreId) {
  const out = [];
  for (const movie of movies) {
    const has = (movie.movie_genre ?? []).some((mg) => mg.genres?.id === genreId);
    if (has) out.push(movie);
  }
  return out;
}

const initialState = {
  movies: [],
  followedIds: new Set(),
  isLoading: true,
  error: null,
  movieHasMore: true,
  popularDisplayCount: PAGE_SIZE,
  genreRowLimits: {},
  loadingMorePopular: false,
  loadingMoreGenreId: null,
};

export function useMoviesPageData(session) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [moviesRes, followRes] = await Promise.all([
          supabase
            .from("movie")
            .select(MOVIE_SELECT)
            .is("deleted_at", null)
            .order("tmdb_popularity", { ascending: false })
            .range(0, PAGE_SIZE - 1),
          session?.user?.id
            ? supabase.from("user_followed_movies").select("movie_id").eq("profile_id", session.user.id)
            : Promise.resolve({ data: [] }),
        ]);

        if (moviesRes.error) throw moviesRes.error;
        if (cancelled) return;

        const rows = moviesRes.data ?? [];
        dispatch({
          type: "LOADED",
          payload: {
            movies: rows,
            followedIds: new Set((followRes.data ?? []).map((r) => r.movie_id)),
            movieHasMore: rows.length >= PAGE_SIZE,
            popularDisplayCount: PAGE_SIZE,
            genreRowLimits: {},
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
    const was = stateRef.current.followedIds.has(movieId);
    dispatch({ type: "TOGGLE", id: movieId });
    const { error } = was
      ? await supabase.from("user_followed_movies").delete().eq("profile_id", session.user.id).eq("movie_id", movieId)
      : await supabase.from("user_followed_movies").insert({ profile_id: session.user.id, movie_id: movieId });
    if (error) dispatch({ type: "TOGGLE", id: movieId });
  }, [session?.user?.id]);

  const appendMoviesFromOffset = useCallback(async (from) => {
    const { data, error: qErr } = await supabase
      .from("movie")
      .select(MOVIE_SELECT)
      .is("deleted_at", null)
      .order("tmdb_popularity", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (qErr) throw qErr;
    const rows = data ?? [];
    return { rows, hasMore: rows.length >= PAGE_SIZE };
  }, []);

  const loadMorePopular = useCallback(async () => {
    const s = stateRef.current;
    if (s.loadingMorePopular || s.loadingMoreGenreId != null) return;
    dispatch({ type: "SET_LOADING_MORE_POPULAR", value: true });
    const target = s.popularDisplayCount + PAGE_SIZE;
    let movies = [...s.movies];
    let movieHasMore = s.movieHasMore;

    try {
      while (movies.length < target && movieHasMore) {
        const { rows, hasMore } = await appendMoviesFromOffset(movies.length);
        movies = [...movies, ...rows];
        movieHasMore = hasMore;
      }
      dispatch({
        type: "UPDATE_AFTER_POPULAR_LOAD",
        payload: {
          movies,
          movieHasMore,
          popularDisplayCount: Math.min(target, movies.length),
        },
      });
    } catch {
      dispatch({ type: "SET_LOADING_MORE_POPULAR", value: false });
    }
  }, [appendMoviesFromOffset]);

  const loadMoreGenre = useCallback(async (genreId) => {
    const s = stateRef.current;
    if (s.loadingMoreGenreId != null || s.loadingMorePopular) return;
    dispatch({ type: "SET_LOADING_MORE_GENRE", genreId });
    const key = genreKey(genreId);
    const currentLimit = s.genreRowLimits[key] ?? PAGE_SIZE;
    const target = currentLimit + PAGE_SIZE;
    let movies = [...s.movies];
    let movieHasMore = s.movieHasMore;

    try {
      while (moviesForGenre(movies, genreId).length < target && movieHasMore) {
        const { rows, hasMore } = await appendMoviesFromOffset(movies.length);
        movies = [...movies, ...rows];
        movieHasMore = hasMore;
      }
      const inGenre = moviesForGenre(movies, genreId).length;
      dispatch({
        type: "UPDATE_AFTER_GENRE_LOAD",
        payload: {
          movies,
          movieHasMore,
          genreRowLimits: { [key]: Math.min(target, inGenre) },
        },
      });
    } catch {
      dispatch({ type: "SET_LOADING_MORE_GENRE", genreId: null });
    }
  }, [appendMoviesFromOffset]);

  const {
    movies,
    followedIds,
    isLoading,
    error,
    movieHasMore,
    popularDisplayCount,
    genreRowLimits,
    loadingMorePopular,
    loadingMoreGenreId,
  } = state;

  const toItem = useCallback(
    (row) => ({
      id: row.id,
      type: "movie",
      title: row.title,
      posterPath: row.poster_path ?? null,
      isFollowing: followedIds.has(row.id),
      onFollowToggle: () => toggleFollow(row.id),
    }),
    [followedIds, toggleFollow],
  );

  const popular = movies.slice(0, popularDisplayCount).map(toItem);
  const hasMorePopular = popularDisplayCount < movies.length || movieHasMore;

  const genreMap = new Map();
  for (const movie of movies) {
    for (const mg of movie.movie_genre ?? []) {
      const genre = mg.genres;
      if (!genre) continue;
      if (!genreMap.has(genre.id)) genreMap.set(genre.id, { id: genre.id, name: genre.name, movies: [] });
      const entry = genreMap.get(genre.id);
      if (!entry.movies.some((m) => m.id === movie.id)) entry.movies.push(movie);
    }
  }

  const byGenre = [...genreMap.values()]
    .filter((g) => g.movies.length >= MIN_GENRE_COUNT)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((g) => {
      const key = genreKey(g.id);
      const limit = genreRowLimits[key] ?? PAGE_SIZE;
      const items = g.movies.slice(0, limit).map(toItem);
      const hasMore = limit < g.movies.length || movieHasMore;
      return {
        genreId: g.id,
        genreName: g.name,
        items,
        hasMore,
        onLoadMore: () => loadMoreGenre(g.id),
        isLoadingMore: loadingMoreGenreId === g.id,
      };
    });

  return {
    popular,
    byGenre,
    isLoading,
    error,
    hasMorePopular,
    loadMorePopular,
    loadingMorePopular,
  };
}
