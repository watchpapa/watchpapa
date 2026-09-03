// Used by:
// - Frontend/src/pages/app/ReleasesCalendarPage.jsx
//
// Follows live in Supabase (tmdb_id + created_at). Followed-title metadata is
// hydrated from the Worker; episode air dates for the month come from
// POST /api/content/releases; movie releases from the hydrated movie card date.
import { useCallback, useEffect, useMemo, useReducer } from "react";
import { supabase } from "../../../lib/supabase.js";
import { isValidId } from "../../../lib/validate.js";
import { useContentBatch } from "../../content/hooks/useContentBatch.js";
import { useReleases } from "./useReleases.js";
import { cardKey } from "../../content/lib/keys.js";

function reducer(state, action) {
  switch (action.type) {
    case "FOLLOWS":
      return { ...state, ...action.payload, isLoading: false };
    case "ERROR":
      return { ...state, isLoading: false, error: action.error };
    case "TOGGLE_SHOW": {
      const next = new Set(state.followedShowIds);
      next.has(action.id) ? next.delete(action.id) : next.add(action.id);
      return { ...state, followedShowIds: next };
    }
    case "TOGGLE_MOVIE": {
      const next = new Set(state.followedMovieIds);
      next.has(action.id) ? next.delete(action.id) : next.add(action.id);
      return { ...state, followedMovieIds: next };
    }
    default:
      return state;
  }
}

const initialState = {
  showRows: [], // [{ tmdb_id, created_at }]
  movieRows: [],
  followedShowIds: new Set(),
  followedMovieIds: new Set(),
  isLoading: true,
  error: null,
};

export function useCalendarData(session, year, month) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const uid = session?.user?.id;

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      try {
        const [fs, fm] = await Promise.all([
          supabase.from("user_followed_shows").select("tmdb_id, created_at").eq("profile_id", uid),
          supabase.from("user_followed_movies").select("tmdb_id, created_at").eq("profile_id", uid),
        ]);
        if (cancelled) return;
        const showRows = (fs.data ?? []).map((r) => ({ ...r, tmdb_id: Number(r.tmdb_id) }));
        const movieRows = (fm.data ?? []).map((r) => ({ ...r, tmdb_id: Number(r.tmdb_id) }));
        dispatch({
          type: "FOLLOWS",
          payload: {
            showRows,
            movieRows,
            followedShowIds: new Set(showRows.map((r) => r.tmdb_id)),
            followedMovieIds: new Set(movieRows.map((r) => r.tmdb_id)),
          },
        });
      } catch (err) {
        if (!cancelled) dispatch({ type: "ERROR", error: err.message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const batchItems = useMemo(
    () => [
      ...state.showRows.map((r) => ({ type: "show", id: r.tmdb_id })),
      ...state.movieRows.map((r) => ({ type: "movie", id: r.tmdb_id })),
    ],
    [state.showRows, state.movieRows],
  );
  const { cards } = useContentBatch(batchItems);

  const followedShows = useMemo(
    () =>
      state.showRows
        .map((r) => {
          const c = cards[cardKey({ type: "show", id: r.tmdb_id })];
          if (!c) return null;
          return {
            id: r.tmdb_id,
            name: c.title,
            poster_path: c.poster_path,
            first_air_date: c.date,
            last_air_date: c.last_air_date ?? null,
            status: c.status ?? null,
            followed_at: r.created_at,
          };
        })
        .filter(Boolean),
    [state.showRows, cards],
  );
  const followedMovies = useMemo(
    () =>
      state.movieRows
        .map((r) => {
          const c = cards[cardKey({ type: "movie", id: r.tmdb_id })];
          if (!c) return null;
          return {
            id: r.tmdb_id,
            title: c.title,
            poster_path: c.poster_path,
            release_date: c.date,
            followed_at: r.created_at,
          };
        })
        .filter(Boolean),
    [state.movieRows, cards],
  );

  const visibleShowIds = useMemo(
    () => followedShows.map((s) => s.id).filter((id) => state.followedShowIds.has(id)),
    [followedShows, state.followedShowIds],
  );
  const { entries: episodeEntries } = useReleases(visibleShowIds, year, month);

  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const calendarEntries = useMemo(() => {
    const out = {};
    // Episodes (only for still-followed shows).
    for (const [date, list] of Object.entries(episodeEntries)) {
      for (const ep of list) {
        if (!state.followedShowIds.has(ep.showId)) continue;
        (out[date] ??= []).push({
          type: "episode",
          id: `${ep.showId}-${ep.seasonNumber}-${ep.episodeNumber}`,
          name: ep.name,
          showName: ep.showName,
          showId: ep.showId,
          seasonNumber: ep.seasonNumber,
          episodeNumber: ep.episodeNumber,
        });
      }
    }
    // Movie releases.
    for (const m of followedMovies) {
      if (!state.followedMovieIds.has(m.id) || !m.release_date) continue;
      const d = m.release_date.slice(0, 10);
      if (d < monthStart || d > monthEnd) continue;
      (out[d] ??= []).push({ type: "movie", id: m.id, name: m.title, movieId: m.id });
    }
    return out;
  }, [episodeEntries, followedMovies, state.followedShowIds, state.followedMovieIds, monthStart, monthEnd]);

  const mutate = useCallback(
    (table, col, idsKey, toggleType) => async (id) => {
      if (!uid || !isValidId(id)) return;
      dispatch({ type: toggleType, id });
      const { error } = await supabase.from(table).delete().eq("profile_id", uid).eq(col, id);
      if (error) dispatch({ type: toggleType, id });
    },
    [uid],
  );
  const reAdd = useCallback(
    (table, col, toggleType) => async (id) => {
      if (!uid || !isValidId(id)) return;
      dispatch({ type: toggleType, id });
      const { error } = await supabase.from(table).insert({ profile_id: uid, [col]: id });
      if (error) dispatch({ type: toggleType, id });
    },
    [uid],
  );

  const visibleShows = followedShows.filter((s) => state.followedShowIds.has(s.id));
  const visibleMovies = followedMovies.filter((m) => state.followedMovieIds.has(m.id));

  return {
    followedShows,
    followedMovies,
    followedShowIds: state.followedShowIds,
    followedMovieIds: state.followedMovieIds,
    calendarEntries,
    isLoading: state.isLoading,
    error: state.error,
    visibleShows,
    visibleMovies,
    unfollowShow: mutate("user_followed_shows", "tmdb_id", "followedShowIds", "TOGGLE_SHOW"),
    unfollowMovie: mutate("user_followed_movies", "tmdb_id", "followedMovieIds", "TOGGLE_MOVIE"),
    refollowShow: reAdd("user_followed_shows", "tmdb_id", "TOGGLE_SHOW"),
    refollowMovie: reAdd("user_followed_movies", "tmdb_id", "TOGGLE_MOVIE"),
  };
}
