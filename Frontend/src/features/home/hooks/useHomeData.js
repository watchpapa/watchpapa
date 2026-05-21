// Used by:
// - Frontend/src/pages/app/AppHomePage.jsx
import { useCallback, useEffect, useReducer, useRef } from "react";
import { supabase } from "../../../lib/supabase.js";
import { isValidId } from "../../../lib/validate.js";

const PAGE_SIZE = 20;

// Map a movie database row into the UI shape.
function toMovieItem(row, followedIds) {
  return {
    id: row.id,
    slug: row.slug ?? null,
    type: "movie",
    title: row.title,
    posterPath: row.poster_path ?? null,
    tmdbPopularity: row.tmdb_popularity,
    isFollowing: followedIds.has(row.id),
    genreIds: (row.movie_genre ?? []).map((g) => g.genres_id),
  };
}

// Map a show database row into the UI shape.
function toShowItem(row, followedIds) {
  return {
    id: row.id,
    slug: row.slug ?? null,
    type: "show",
    title: row.name,
    posterPath: row.poster_path ?? null,
    tmdbPopularity: row.tmdb_popularity,
    isFollowing: followedIds.has(row.id),
    genreIds: (row.show_genre ?? []).map((g) => g.genres_id),
  };
}

function formatReleaseLabel(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// Apply state updates for database-backed lists and follow toggles.
function reducer(state, action) {
  switch (action.type) {
    case "LOADED":
      return { ...state, ...action.payload, isLoading: false, error: null };
    case "APPEND_MOVIES":
      return {
        ...state,
        movies: [...state.movies, ...action.rows],
        movieHasMore: action.hasMore,
        loadingMoreMovies: false,
      };
    case "APPEND_SHOWS":
      return {
        ...state,
        shows: [...state.shows, ...action.rows],
        showHasMore: action.hasMore,
        loadingMoreShows: false,
      };
    case "SET_LOADING_MORE_MOVIES":
      return { ...state, loadingMoreMovies: action.value };
    case "SET_LOADING_MORE_SHOWS":
      return { ...state, loadingMoreShows: action.value };
    case "SET_LOADING_MORE_POPULAR":
      return { ...state, loadingMorePopular: action.value };
    case "EXPAND_POPULAR_DISPLAY":
      return { ...state, popularDisplayCount: action.count, loadingMorePopular: false };
    case "SET_POPULAR_MERGE":
      return {
        ...state,
        movies: action.payload.movies,
        shows: action.payload.shows,
        movieHasMore: action.payload.movieHasMore,
        showHasMore: action.payload.showHasMore,
        popularDisplayCount: action.payload.popularDisplayCount,
        loadingMorePopular: false,
      };
    case "ERROR":
      return {
        ...state,
        isLoading: false,
        error: action.error,
        loadingMoreMovies: false,
        loadingMoreShows: false,
        loadingMorePopular: false,
      };
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
    case "FOLLOW_LIMIT":
      return { ...state, followLimitError: action.message };
    case "CLEAR_FOLLOW_LIMIT":
      return { ...state, followLimitError: null };
    default:
      return state;
  }
}

const initialState = {
  movies: [],
  shows: [],
  comingSoonMovies: [],
  comingSoonShows: [],
  followedMovieIds: new Set(),
  followedShowIds: new Set(),
  isLoading: true,
  error: null,
  followLimitError: null,
  movieHasMore: true,
  showHasMore: true,
  popularDisplayCount: PAGE_SIZE,
  loadingMoreMovies: false,
  loadingMoreShows: false,
  loadingMorePopular: false,
};

function mergePopularItems(movies, shows, followedMovieIds, followedShowIds) {
  const movieItems = movies.map((m) => toMovieItem(m, followedMovieIds));
  const showItems = shows.map((s) => toShowItem(s, followedShowIds));
  return [...movieItems, ...showItems].sort((a, b) => b.tmdbPopularity - a.tmdbPopularity);
}

export function useHomeData(session, showAdult = false) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const showAdultRef = useRef(showAdult);
  showAdultRef.current = showAdult;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const adult = showAdultRef.current;
        const today = new Date().toISOString().slice(0, 10);

        // Read top movies from the movie table.
        let movieQ = supabase
          .from("movie")
          .select("id, tmdb_id, title, tmdb_popularity, poster_path, slug, movie_genre(genres_id)")
          .is("deleted_at", null)
          .order("tmdb_popularity", { ascending: false })
          .range(0, PAGE_SIZE - 1);
        if (!adult) movieQ = movieQ.eq("adult", false);

        // Read top shows from the show table.
        let showQ = supabase
          .from("show")
          .select("id, tmdb_id, name, tmdb_popularity, poster_path, slug, show_genre(genres_id)")
          .is("deleted_at", null)
          .order("tmdb_popularity", { ascending: false })
          .range(0, PAGE_SIZE - 1);
        if (!adult) showQ = showQ.eq("adult", false);

        // Read unreleased movies (release date in future).
        let csMovieQ = supabase
          .from("movie")
          .select("id, tmdb_id, title, tmdb_popularity, poster_path, release_date, slug")
          .is("deleted_at", null)
          .gt("release_date", today)
          .order("tmdb_popularity", { ascending: false })
          .range(0, PAGE_SIZE - 1);
        if (!adult) csMovieQ = csMovieQ.eq("adult", false);

        // Read shows still in production or not yet premiered.
        let csShowQ = supabase
          .from("show")
          .select("id, tmdb_id, name, tmdb_popularity, poster_path, first_air_date, in_production, slug")
          .is("deleted_at", null)
          .or(`in_production.eq.true,first_air_date.gt.${today}`)
          .order("tmdb_popularity", { ascending: false })
          .range(0, PAGE_SIZE - 1);
        if (!adult) csShowQ = csShowQ.eq("adult", false);

        const [moviesRes, showsRes, csMoviesRes, csShowsRes] = await Promise.all([movieQ, showQ, csMovieQ, csShowQ]);

        if (moviesRes.error) throw moviesRes.error;
        if (showsRes.error) throw showsRes.error;
        if (csMoviesRes.error) throw csMoviesRes.error;
        if (csShowsRes.error) throw csShowsRes.error;

        let followedMovieIds = new Set();
        let followedShowIds = new Set();

        if (session?.user?.id) {
          // Read current user's followed movie/show ids from join tables.
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
          const movieRows = moviesRes.data ?? [];
          const showRows = showsRes.data ?? [];
          dispatch({
            type: "LOADED",
            payload: {
              movies: movieRows,
              shows: showRows,
              comingSoonMovies: csMoviesRes.data ?? [],
              comingSoonShows: csShowsRes.data ?? [],
              followedMovieIds,
              followedShowIds,
              movieHasMore: movieRows.length >= PAGE_SIZE,
              showHasMore: showRows.length >= PAGE_SIZE,
              popularDisplayCount: PAGE_SIZE,
            },
          });
        }
      } catch (err) {
        if (!cancelled) dispatch({ type: "ERROR", error: err.message });
      }
    }

    load();
    return () => { cancelled = true; };
  }, [session?.user?.id, showAdult]);

  const toggleMovieFollow = useCallback(
    async (movieId) => {
      if (!session?.user?.id || !isValidId(movieId)) return;
      const isFollowing = state.followedMovieIds.has(movieId);
      dispatch({ type: "TOGGLE_MOVIE", id: movieId });

      // Write follow/unfollow in user_followed_movies.
      const { error } = isFollowing
        ? await supabase
            .from("user_followed_movies")
            .delete()
            .eq("profile_id", session.user.id)
            .eq("movie_id", movieId)
        : await supabase
            .from("user_followed_movies")
            .insert({ profile_id: session.user.id, movie_id: movieId });

      if (error) {
        if (error.message?.includes("FOLLOW_LIMIT_REACHED")) {
          dispatch({ type: "FOLLOW_LIMIT", message: error.message.replace("FOLLOW_LIMIT_REACHED: ", "") });
        } else {
          dispatch({ type: "TOGGLE_MOVIE", id: movieId });
        }
      }
    },
    [session?.user?.id, state.followedMovieIds],
  );

  const toggleShowFollow = useCallback(
    async (showId) => {
      if (!session?.user?.id || !isValidId(showId)) return;
      const isFollowing = state.followedShowIds.has(showId);
      dispatch({ type: "TOGGLE_SHOW", id: showId });

      // Write follow/unfollow in user_followed_shows.
      const { error } = isFollowing
        ? await supabase
            .from("user_followed_shows")
            .delete()
            .eq("profile_id", session.user.id)
            .eq("show_id", showId)
        : await supabase
            .from("user_followed_shows")
            .insert({ profile_id: session.user.id, show_id: showId });

      if (error) {
        if (error.message?.includes("FOLLOW_LIMIT_REACHED")) {
          dispatch({ type: "FOLLOW_LIMIT", message: error.message.replace("FOLLOW_LIMIT_REACHED: ", "") });
        } else {
          dispatch({ type: "TOGGLE_SHOW", id: showId });
        }
      }
    },
    [session?.user?.id, state.followedShowIds],
  );

  const loadMoreMovies = useCallback(async () => {
    const s = stateRef.current;
    if (s.loadingMoreMovies || !s.movieHasMore) return;
    dispatch({ type: "SET_LOADING_MORE_MOVIES", value: true });
    const from = s.movies.length;
    try {
      // Fetch the next movie page from the database.
      let q = supabase
        .from("movie")
        .select("id, tmdb_id, title, tmdb_popularity, poster_path, slug, movie_genre(genres_id)")
        .is("deleted_at", null)
        .order("tmdb_popularity", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (!showAdultRef.current) q = q.eq("adult", false);
      const { data, error: qErr } = await q;
      if (qErr) throw qErr;
      const rows = data ?? [];
      dispatch({
        type: "APPEND_MOVIES",
        rows,
        hasMore: rows.length >= PAGE_SIZE,
      });
    } catch {
      dispatch({ type: "SET_LOADING_MORE_MOVIES", value: false });
    }
  }, []);

  const loadMoreShows = useCallback(async () => {
    const s = stateRef.current;
    if (s.loadingMoreShows || !s.showHasMore) return;
    dispatch({ type: "SET_LOADING_MORE_SHOWS", value: true });
    const from = s.shows.length;
    try {
      // Fetch the next show page from the database.
      let q = supabase
        .from("show")
        .select("id, tmdb_id, name, tmdb_popularity, poster_path, slug, show_genre(genres_id)")
        .is("deleted_at", null)
        .order("tmdb_popularity", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (!showAdultRef.current) q = q.eq("adult", false);
      const { data, error: qErr } = await q;
      if (qErr) throw qErr;
      const rows = data ?? [];
      dispatch({
        type: "APPEND_SHOWS",
        rows,
        hasMore: rows.length >= PAGE_SIZE,
      });
    } catch {
      dispatch({ type: "SET_LOADING_MORE_SHOWS", value: false });
    }
  }, []);

  const loadMorePopular = useCallback(async () => {
    const s = stateRef.current;
    if (s.loadingMorePopular) return;
    dispatch({ type: "SET_LOADING_MORE_POPULAR", value: true });
    const target = s.popularDisplayCount + PAGE_SIZE;
    let movies = [...s.movies];
    let shows = [...s.shows];
    let movieHasMore = s.movieHasMore;
    let showHasMore = s.showHasMore;
    const { followedMovieIds, followedShowIds } = s;

    try {
      while (true) {
        const mergedLen = mergePopularItems(movies, shows, followedMovieIds, followedShowIds).length;
        if (mergedLen >= target) {
          dispatch({
            type: "SET_POPULAR_MERGE",
            payload: {
              movies,
              shows,
              movieHasMore,
              showHasMore,
              popularDisplayCount: target,
            },
          });
          return;
        }
        if (!movieHasMore && !showHasMore) {
          dispatch({
            type: "SET_POPULAR_MERGE",
            payload: {
              movies,
              shows,
              movieHasMore,
              showHasMore,
              popularDisplayCount: Math.min(target, mergedLen),
            },
          });
          return;
        }
        if (movieHasMore) {
          const from = movies.length;
          // Keep paging movie rows while building the merged popular list.
          let q = supabase
            .from("movie")
            .select("id, tmdb_id, title, tmdb_popularity, poster_path, slug, movie_genre(genres_id)")
            .is("deleted_at", null)
            .order("tmdb_popularity", { ascending: false })
            .range(from, from + PAGE_SIZE - 1);
          if (!showAdultRef.current) q = q.eq("adult", false);
          const { data, error: qErr } = await q;
          if (qErr) throw qErr;
          const rows = data ?? [];
          movies = [...movies, ...rows];
          movieHasMore = rows.length >= PAGE_SIZE;
        }
        if (showHasMore) {
          const from = shows.length;
          // Keep paging show rows while building the merged popular list.
          let q = supabase
            .from("show")
            .select("id, tmdb_id, name, tmdb_popularity, poster_path, slug, show_genre(genres_id)")
            .is("deleted_at", null)
            .order("tmdb_popularity", { ascending: false })
            .range(from, from + PAGE_SIZE - 1);
          if (!showAdultRef.current) q = q.eq("adult", false);
          const { data, error: qErr } = await q;
          if (qErr) throw qErr;
          const rows = data ?? [];
          shows = [...shows, ...rows];
          showHasMore = rows.length >= PAGE_SIZE;
        }
      }
    } catch {
      dispatch({ type: "SET_LOADING_MORE_POPULAR", value: false });
    }
  }, []);

  const {
    movies,
    shows,
    comingSoonMovies,
    comingSoonShows,
    followedMovieIds,
    followedShowIds,
    isLoading,
    error,
    followLimitError,
    movieHasMore,
    showHasMore,
    popularDisplayCount,
    loadingMoreMovies,
    loadingMoreShows,
    loadingMorePopular,
  } = state;

  const movieItems = movies.map((m) => ({
    ...toMovieItem(m, followedMovieIds),
    onFollowToggle: () => toggleMovieFollow(m.id),
  }));

  const showItems = shows.map((s) => ({
    ...toShowItem(s, followedShowIds),
    onFollowToggle: () => toggleShowFollow(s.id),
  }));

  const todayStr = new Date().toISOString().slice(0, 10);
  const comingSoonItems = [
    ...comingSoonMovies.map((m) => ({
      ...toMovieItem(m, followedMovieIds),
      releaseLabel: formatReleaseLabel(m.release_date),
      onFollowToggle: () => toggleMovieFollow(m.id),
    })),
    ...comingSoonShows.map((s) => ({
      ...toShowItem(s, followedShowIds),
      releaseLabel: s.first_air_date > todayStr ? formatReleaseLabel(s.first_air_date) : "Airing",
      onFollowToggle: () => toggleShowFollow(s.id),
    })),
  ].sort((a, b) => b.tmdbPopularity - a.tmdbPopularity);

  const mergedPopular = mergePopularItems(movies, shows, followedMovieIds, followedShowIds);
  const popular = mergedPopular.slice(0, popularDisplayCount).map((item) => ({
    ...item,
    onFollowToggle:
      item.type === "movie"
        ? () => toggleMovieFollow(item.id)
        : () => toggleShowFollow(item.id),
  }));

  const mergedPopularLen = mergedPopular.length;
  const hasMoreMovies = movieHasMore;
  const hasMoreShows = showHasMore;
  const hasMorePopular =
    popularDisplayCount < mergedPopularLen || movieHasMore || showHasMore;

  return {
    popular,
    comingSoonItems,
    movieItems,
    showItems,
    isLoading,
    error,
    followLimitError,
    clearFollowLimitError: () => dispatch({ type: "CLEAR_FOLLOW_LIMIT" }),
    hasMoreMovies,
    hasMoreShows,
    hasMorePopular,
    loadMoreMovies,
    loadMoreShows,
    loadMorePopular,
    loadingMoreMovies,
    loadingMoreShows,
    loadingMorePopular,
  };
}
