import { useCallback, useEffect, useReducer } from "react";
import { supabase } from "../../../lib/supabase.js";

function reducer(state, action) {
  switch (action.type) {
    case "LOADED":
      return { ...state, ...action.payload, isLoading: false, error: null };
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
  followedShows: [],
  followedMovies: [],
  followedShowIds: new Set(),
  followedMovieIds: new Set(),
  calendarEntries: {},
  isLoading: true,
  error: null,
};

export function useCalendarData(session, year, month) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (!session?.user?.id) return;
    let cancelled = false;

    async function load() {
      try {
        const profileId = session.user.id;

        const [fsRes, fmRes] = await Promise.all([
          supabase
            .from("user_followed_shows")
            .select("show_id, show(id, name, poster_path)")
            .eq("profile_id", profileId),
          supabase
            .from("user_followed_movies")
            .select("movie_id, movie(id, title, poster_path, release_date)")
            .eq("profile_id", profileId),
        ]);

        if (fsRes.error) throw fsRes.error;
        if (fmRes.error) throw fmRes.error;

        const followedShows = (fsRes.data ?? []).map((r) => r.show).filter(Boolean);
        const followedMovies = (fmRes.data ?? []).map((r) => r.movie).filter(Boolean);
        const followedShowIds = new Set(followedShows.map((s) => s.id));
        const followedMovieIds = new Set(followedMovies.map((m) => m.id));

        const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;

        const calendarEntries = {};

        if (followedShowIds.size > 0) {
          const { data: episodes, error: epErr } = await supabase
            .from("episode")
            .select("id, name, air_date, runtime, episode_number, season(id, show_id, season_number, show(id, name))")
            .gte("air_date", startDate)
            .lte("air_date", endDate)
            .is("deleted_at", null);

          if (epErr) throw epErr;

          for (const ep of episodes ?? []) {
            const showId = ep.season?.show_id;
            if (!followedShowIds.has(showId)) continue;
            const dateKey = ep.air_date;
            if (!calendarEntries[dateKey]) calendarEntries[dateKey] = [];
            calendarEntries[dateKey].push({
              type: "episode",
              id: ep.id,
              name: ep.name,
              showName: ep.season?.show?.name ?? "",
              showId,
              seasonId: ep.season?.id,
              seasonNumber: ep.season?.season_number,
              episodeNumber: ep.episode_number,
            });
          }
        }

        for (const movie of followedMovies) {
          if (!movie.release_date) continue;
          const d = movie.release_date.slice(0, 10);
          if (d < startDate || d > endDate) continue;
          if (!calendarEntries[d]) calendarEntries[d] = [];
          calendarEntries[d].push({
            type: "movie",
            id: movie.id,
            name: movie.title,
            movieId: movie.id,
          });
        }

        if (cancelled) return;

        dispatch({
          type: "LOADED",
          payload: { followedShows, followedMovies, followedShowIds, followedMovieIds, calendarEntries },
        });
      } catch (err) {
        if (!cancelled) dispatch({ type: "ERROR", error: err.message });
      }
    }

    load();
    return () => { cancelled = true; };
  }, [session?.user?.id, year, month]);

  const unfollowShow = useCallback(async (showId) => {
    if (!session?.user?.id) return;
    dispatch({ type: "TOGGLE_SHOW", id: showId });
    const { error } = await supabase
      .from("user_followed_shows")
      .delete()
      .eq("profile_id", session.user.id)
      .eq("show_id", showId);
    if (error) dispatch({ type: "TOGGLE_SHOW", id: showId });
  }, [session?.user?.id]);

  const unfollowMovie = useCallback(async (movieId) => {
    if (!session?.user?.id) return;
    dispatch({ type: "TOGGLE_MOVIE", id: movieId });
    const { error } = await supabase
      .from("user_followed_movies")
      .delete()
      .eq("profile_id", session.user.id)
      .eq("movie_id", movieId);
    if (error) dispatch({ type: "TOGGLE_MOVIE", id: movieId });
  }, [session?.user?.id]);

  const visibleShows = state.followedShows.filter((s) => state.followedShowIds.has(s.id));
  const visibleMovies = state.followedMovies.filter((m) => state.followedMovieIds.has(m.id));

  return { ...state, visibleShows, visibleMovies, unfollowShow, unfollowMovie };
}
