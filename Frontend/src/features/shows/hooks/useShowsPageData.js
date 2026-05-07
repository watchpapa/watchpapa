// Used by:
// - Frontend/src/pages/app/ShowsPage.jsx
import { useCallback, useEffect, useReducer, useRef } from "react";
import { supabase } from "../../../lib/supabase.js";
import { isValidId } from "../../../lib/validate.js";

const PAGE_SIZE = 100;
const MIN_GENRE_COUNT = 3;

const SHOW_SELECT =
  "id, name, poster_path, tmdb_popularity, show_genre(genres(id, name))";

// Apply state updates for show data loaded from the database.
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
        shows: action.payload.shows,
        showHasMore: action.payload.showHasMore,
        popularDisplayCount: action.payload.popularDisplayCount,
        loadingMorePopular: false,
      };
    case "UPDATE_AFTER_GENRE_LOAD":
      return {
        ...state,
        shows: action.payload.shows,
        showHasMore: action.payload.showHasMore,
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

// Build a stable object key for genre-based state maps.
function genreKey(id) {
  return String(id);
}

// Return loaded shows that belong to a specific genre.
function showsForGenre(shows, genreId) {
  const out = [];
  for (const show of shows) {
    const has = (show.show_genre ?? []).some((sg) => sg.genres?.id === genreId);
    if (has) out.push(show);
  }
  return out;
}

const initialState = {
  shows: [],
  followedIds: new Set(),
  isLoading: true,
  error: null,
  showHasMore: true,
  popularDisplayCount: PAGE_SIZE,
  genreRowLimits: {},
  loadingMorePopular: false,
  loadingMoreGenreId: null,
};

// Load, paginate, and follow shows for the Shows page.
export function useShowsPageData(session, showAdult = false) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const showAdultRef = useRef(showAdult);
  showAdultRef.current = showAdult;

  useEffect(() => {
    let cancelled = false;

    // Load initial show rows and followed ids from the database.
    async function load() {
      try {
        // Read the first popularity page from the show table.
        let showQ = supabase
          .from("show")
          .select(SHOW_SELECT)
          .is("deleted_at", null)
          .order("tmdb_popularity", { ascending: false })
          .range(0, PAGE_SIZE - 1);
        if (!showAdultRef.current) showQ = showQ.eq("adult", false);

        // Read current user's followed show ids from the join table.
        const [showsRes, followRes] = await Promise.all([
          showQ,
          session?.user?.id
            ? supabase.from("user_followed_shows").select("show_id").eq("profile_id", session.user.id)
            : Promise.resolve({ data: [] }),
        ]);

        if (showsRes.error) throw showsRes.error;
        if (cancelled) return;

        const rows = showsRes.data ?? [];
        dispatch({
          type: "LOADED",
          payload: {
            shows: rows,
            followedIds: new Set((followRes.data ?? []).map((r) => r.show_id)),
            showHasMore: rows.length >= PAGE_SIZE,
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
  const toggleFollow = useCallback(async (showId) => {
    if (!session?.user?.id || !isValidId(showId)) return;
    const was = stateRef.current.followedIds.has(showId);
    dispatch({ type: "TOGGLE", id: showId });
    // Write follow/unfollow in user_followed_shows.
    const { error } = was
      ? await supabase.from("user_followed_shows").delete().eq("profile_id", session.user.id).eq("show_id", showId)
      : await supabase.from("user_followed_shows").insert({ profile_id: session.user.id, show_id: showId });
    if (error) dispatch({ type: "TOGGLE", id: showId });
  }, [session?.user?.id]);

  // Fetch one show page starting from a row offset.
  const appendShowsFromOffset = useCallback(async (from) => {
    // Fetch another popularity-ordered show page from the database.
    let q = supabase
      .from("show")
      .select(SHOW_SELECT)
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
    let shows = [...s.shows];
    let showHasMore = s.showHasMore;

    try {
      while (shows.length < target && showHasMore) {
        const { rows, hasMore } = await appendShowsFromOffset(shows.length);
        shows = [...shows, ...rows];
        showHasMore = hasMore;
      }
      dispatch({
        type: "UPDATE_AFTER_POPULAR_LOAD",
        payload: {
          shows,
          showHasMore,
          popularDisplayCount: Math.min(target, shows.length),
        },
      });
    } catch {
      dispatch({ type: "SET_LOADING_MORE_POPULAR", value: false });
    }
  }, [appendShowsFromOffset]);

  // Extend one genre row by loading enough matching shows.
  const loadMoreGenre = useCallback(async (genreId) => {
    const s = stateRef.current;
    if (s.loadingMoreGenreId != null || s.loadingMorePopular) return;
    dispatch({ type: "SET_LOADING_MORE_GENRE", genreId });
    const key = genreKey(genreId);
    const currentLimit = s.genreRowLimits[key] ?? PAGE_SIZE;
    const target = currentLimit + PAGE_SIZE;
    let shows = [...s.shows];
    let showHasMore = s.showHasMore;

    try {
      while (showsForGenre(shows, genreId).length < target && showHasMore) {
        const { rows, hasMore } = await appendShowsFromOffset(shows.length);
        shows = [...shows, ...rows];
        showHasMore = hasMore;
      }
      const inGenre = showsForGenre(shows, genreId).length;
      dispatch({
        type: "UPDATE_AFTER_GENRE_LOAD",
        payload: {
          shows,
          showHasMore,
          genreRowLimits: { [key]: Math.min(target, inGenre) },
        },
      });
    } catch {
      dispatch({ type: "SET_LOADING_MORE_GENRE", genreId: null });
    }
  }, [appendShowsFromOffset]);

  const {
    shows,
    followedIds,
    isLoading,
    error,
    showHasMore,
    popularDisplayCount,
    genreRowLimits,
    loadingMorePopular,
    loadingMoreGenreId,
  } = state;

  // Convert a show row into the UI item shape.
  const toItem = useCallback(
    (row) => ({
      id: row.id,
      type: "show",
      title: row.name,
      posterPath: row.poster_path ?? null,
      isFollowing: followedIds.has(row.id),
      onFollowToggle: () => toggleFollow(row.id),
    }),
    [followedIds, toggleFollow],
  );

  const popular = shows.slice(0, popularDisplayCount).map(toItem);
  const hasMorePopular = popularDisplayCount < shows.length || showHasMore;

  const genreMap = new Map();
  for (const show of shows) {
    for (const sg of show.show_genre ?? []) {
      const genre = sg.genres;
      if (!genre) continue;
      if (!genreMap.has(genre.id)) genreMap.set(genre.id, { id: genre.id, name: genre.name, shows: [] });
      const entry = genreMap.get(genre.id);
      if (!entry.shows.some((s) => s.id === show.id)) entry.shows.push(show);
    }
  }

  const byGenre = [...genreMap.values()]
    .filter((g) => g.shows.length >= MIN_GENRE_COUNT)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((g) => {
      const key = genreKey(g.id);
      const limit = genreRowLimits[key] ?? PAGE_SIZE;
      const items = g.shows.slice(0, limit).map(toItem);
      const hasMore = limit < g.shows.length || showHasMore;
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
