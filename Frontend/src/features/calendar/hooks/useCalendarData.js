// Used by:
// - Frontend/src/pages/app/ReleasesCalendarPage.jsx
import { useCallback, useEffect, useReducer } from "react";
import { supabase } from "../../../lib/supabase.js";
import { isValidId } from "../../../lib/validate.js";

// Apply state updates for calendar data loaded from the database.
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

// Load followed shows/movies and build calendar entries for a month.
export function useCalendarData(session, year, month) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (!session?.user?.id) return;
    let cancelled = false;

    // Fetch followed media and episode schedules from the database.
    async function load() {
      try {
        const profileId = session.user.id;

        // Read followed shows and movies for the current profile.
        const [fsRes, fmRes] = await Promise.all([
          supabase
            .from("user_followed_shows")
            .select("show_id, created_at, show(id, name, poster_path, first_air_date, last_air_date, status, slug)")
            .eq("profile_id", profileId),
          supabase
            .from("user_followed_movies")
            .select("movie_id, created_at, movie(id, title, poster_path, release_date, slug)")
            .eq("profile_id", profileId),
        ]);

        if (fsRes.error) throw fsRes.error;
        if (fmRes.error) throw fmRes.error;

        const followedShows = (fsRes.data ?? [])
          .map((r) => (r.show ? { ...r.show, followed_at: r.created_at } : null))
          .filter(Boolean);
        const followedMovies = (fmRes.data ?? [])
          .map((r) => (r.movie ? { ...r.movie, followed_at: r.created_at } : null))
          .filter(Boolean);
        const followedShowIds = new Set(followedShows.map((s) => s.id));
        const followedMovieIds = new Set(followedMovies.map((m) => m.id));

        const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;

        const calendarEntries = {};

        if (followedShowIds.size > 0) {
          // Read episodes that air during this month from the episode table.
          const { data: episodes, error: epErr } = await supabase
            .from("episode")
            .select("id, name, air_date, runtime, episode_number, season(id, show_id, season_number, show(id, name, slug))")
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
              showSlug: ep.season?.show?.slug ?? null,
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
            movieSlug: movie.slug ?? null,
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

  // Remove a followed show in the database with optimistic UI update.
  const unfollowShow = useCallback(async (showId) => {
    if (!session?.user?.id || !isValidId(showId)) return;
    dispatch({ type: "TOGGLE_SHOW", id: showId });
    // Delete the profile-show follow relation from the join table.
    const { error } = await supabase
      .from("user_followed_shows")
      .delete()
      .eq("profile_id", session.user.id)
      .eq("show_id", showId);
    if (error) dispatch({ type: "TOGGLE_SHOW", id: showId });
  }, [session?.user?.id]);

  // Remove a followed movie in the database with optimistic UI update.
  const unfollowMovie = useCallback(async (movieId) => {
    if (!session?.user?.id || !isValidId(movieId)) return;
    dispatch({ type: "TOGGLE_MOVIE", id: movieId });
    // Delete the profile-movie follow relation from the join table.
    const { error } = await supabase
      .from("user_followed_movies")
      .delete()
      .eq("profile_id", session.user.id)
      .eq("movie_id", movieId);
    if (error) dispatch({ type: "TOGGLE_MOVIE", id: movieId });
  }, [session?.user?.id]);

  // Re-follow a show that was previously unfollowed (used by undo).
  const refollowShow = useCallback(async (showId) => {
    if (!session?.user?.id || !isValidId(showId)) return;
    dispatch({ type: "TOGGLE_SHOW", id: showId });
    const { error } = await supabase
      .from("user_followed_shows")
      .insert({ profile_id: session.user.id, show_id: showId });
    if (error) dispatch({ type: "TOGGLE_SHOW", id: showId });
  }, [session?.user?.id]);

  // Re-follow a movie that was previously unfollowed (used by undo).
  const refollowMovie = useCallback(async (movieId) => {
    if (!session?.user?.id || !isValidId(movieId)) return;
    dispatch({ type: "TOGGLE_MOVIE", id: movieId });
    const { error } = await supabase
      .from("user_followed_movies")
      .insert({ profile_id: session.user.id, movie_id: movieId });
    if (error) dispatch({ type: "TOGGLE_MOVIE", id: movieId });
  }, [session?.user?.id]);

  const visibleShows = state.followedShows.filter((s) => state.followedShowIds.has(s.id));
  const visibleMovies = state.followedMovies.filter((m) => state.followedMovieIds.has(m.id));

  // Derive calendar entries filtered by current followed IDs so the calendar
  // updates immediately when a show or movie is unfollowed or re-followed.
  const calendarEntries = {};
  for (const [date, entries] of Object.entries(state.calendarEntries)) {
    const filtered = entries.filter((e) => {
      if (e.type === "episode") return state.followedShowIds.has(e.showId);
      if (e.type === "movie") return state.followedMovieIds.has(e.movieId);
      return true;
    });
    if (filtered.length > 0) calendarEntries[date] = filtered;
  }

  return { ...state, calendarEntries, visibleShows, visibleMovies, unfollowShow, unfollowMovie, refollowShow, refollowMovie };
}
