// Used by:
// - Frontend/src/pages/app/MoviesPage.jsx
import { useCallback, useEffect, useReducer, useRef } from "react";
import { supabase } from "../../../lib/supabase.js";

const PAGE_SIZE = 100;
const MIN_GENRE_COUNT = 3;

const MOVIE_SELECT =
  "id, title, poster_path, tmdb_popularity, slug, movie_genre(genres(id, name))";

const CS_MOVIE_SELECT = "id, title, poster_path, tmdb_popularity, release_date, slug";

function formatReleaseLabel(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// Apply state updates for movie data loaded from the database.
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
    case "FOLLOW_LIMIT":
      return { ...state, followLimitError: action.message };
    case "CLEAR_FOLLOW_LIMIT":
      return { ...state, followLimitError: null };
    default:
      return state;
  }
}

// Build a stable object key for genre-based state maps.
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
  comingSoonMovies: [],
  followedIds: new Set(),
  isLoading: true,
  error: null,
  followLimitError: null,
  movieHasMore: true,
  popularDisplayCount: PAGE_SIZE,
  genreRowLimits: {},
  loadingMorePopular: false,
  loadingMoreGenreId: null,
};

// Load, paginate, and follow movies for the Movies page.
export function useMoviesPageData(session, showAdult = false) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const showAdultRef = useRef(showAdult);
  showAdultRef.current = showAdult;

  useEffect(() => {
    let cancelled = false;

    // Load initial movie rows and followed ids from the database.
    async function load() {
      try {
        const today = new Date().toISOString().slice(0, 10);

        // Read the first popularity page from the movie table.
        let movieQ = supabase
          .from("movie")
          .select(MOVIE_SELECT)
          .is("deleted_at", null)
          .order("tmdb_popularity", { ascending: false })
          .range(0, PAGE_SIZE - 1);
        if (!showAdultRef.current) movieQ = movieQ.eq("adult", false);

        // Read unreleased movies (release date in future).
        let csMovieQ = supabase
          .from("movie")
          .select(CS_MOVIE_SELECT)
          .is("deleted_at", null)
          .gt("release_date", today)
          .order("tmdb_popularity", { ascending: false })
          .range(0, PAGE_SIZE - 1);
        if (!showAdultRef.current) csMovieQ = csMovieQ.eq("adult", false);

        // Read current user's followed movie ids from the join table.
        const [moviesRes, followRes, csMoviesRes] = await Promise.all([
          movieQ,
          session?.user?.id
            ? supabase.from("user_followed_movies").select("movie_id").eq("profile_id", session.user.id)
            : Promise.resolve({ data: [] }),
          csMovieQ,
        ]);

        if (moviesRes.error) throw moviesRes.error;
        if (csMoviesRes.error) throw csMoviesRes.error;
        if (cancelled) return;

        const rows = moviesRes.data ?? [];
        dispatch({
          type: "LOADED",
          payload: {
            movies: rows,
            comingSoonMovies: csMoviesRes.data ?? [],
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
  }, [session?.user?.id, showAdult]);

  // Toggle follow status and persist it to the database.
  const toggleFollow = useCallback(async (movieId) => {
    if (!session?.user?.id) return;
    const was = stateRef.current.followedIds.has(movieId);
    dispatch({ type: "TOGGLE", id: movieId });
    // Write follow/unfollow in user_followed_movies.
    const { error } = was
      ? await supabase.from("user_followed_movies").delete().eq("profile_id", session.user.id).eq("movie_id", movieId)
      : await supabase.from("user_followed_movies").insert({ profile_id: session.user.id, movie_id: movieId });
    if (error) {
      if (error.message?.includes("FOLLOW_LIMIT_REACHED")) {
        dispatch({ type: "FOLLOW_LIMIT", message: error.message.replace("FOLLOW_LIMIT_REACHED: ", "") });
      } else {
        dispatch({ type: "TOGGLE", id: movieId });
      }
    }
  }, [session?.user?.id]);

  // Fetch one movie page starting from a row offset.
  const appendMoviesFromOffset = useCallback(async (from) => {
    // Fetch another popularity-ordered movie page from the database.
    let q = supabase
      .from("movie")
      .select(MOVIE_SELECT)
      .is("deleted_at", null)
      .order("tmdb_popularity", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (!showAdultRef.current) q = q.eq("adult", false);
    const { data, error: qErr } = await q;
    if (qErr) throw qErr;
    const rows = data ?? [];
    return { rows, hasMore: rows.length >= PAGE_SIZE };
  }, []);

  // Extend the global popular list by loading more database rows.
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

  // Extend one genre row by loading enough matching movies.
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
    comingSoonMovies,
    followedIds,
    isLoading,
    error,
    followLimitError,
    movieHasMore,
    popularDisplayCount,
    genreRowLimits,
    loadingMorePopular,
    loadingMoreGenreId,
  } = state;

  // Convert a movie row into the UI item shape.
  const toItem = useCallback(
    (row) => ({
      id: row.id,
      slug: row.slug ?? null,
      type: "movie",
      title: row.title,
      posterPath: row.poster_path ?? null,
      isFollowing: followedIds.has(row.id),
      onFollowToggle: () => toggleFollow(row.id),
      genreIds: (row.movie_genre ?? []).map((mg) => mg.genres?.id).filter(Boolean),
    }),
    [followedIds, toggleFollow],
  );

  const comingSoonItems = comingSoonMovies.map((row) => ({
    ...toItem(row),
    releaseLabel: formatReleaseLabel(row.release_date),
  }));

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
    comingSoonItems,
    byGenre,
    isLoading,
    error,
    followLimitError,
    clearFollowLimitError: () => dispatch({ type: "CLEAR_FOLLOW_LIMIT" }),
    hasMorePopular,
    loadMorePopular,
    loadingMorePopular,
  };
}
