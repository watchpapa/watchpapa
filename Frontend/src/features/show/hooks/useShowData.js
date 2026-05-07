// Used by:
// - Frontend/src/pages/app/ShowPage.jsx
import { useCallback, useEffect, useReducer } from "react";
import { supabase } from "../../../lib/supabase.js";
import { toCast, toCrew } from "../../../lib/credits.js";

// Apply state updates for show data loaded from the database.
function reducer(state, action) {
  switch (action.type) {
    case "LOADED":
      return { ...state, ...action.payload, isLoading: false, error: null };
    case "ERROR":
      return { ...state, isLoading: false, error: action.error };
    case "TOGGLE_FOLLOW":
      return { ...state, isFollowing: !state.isFollowing };
    default:
      return state;
  }
}

const initialState = {
  show: null,
  genres: [],
  seasons: [],
  cast: [],
  crew: [],
  isFollowing: false,
  isLoading: true,
  error: null,
};

// Load show details, related rows, and follow state for the Show page.
export function useShowData(rawShowId, session, showAdult = false) {
  const showId = rawShowId ? parseInt(rawShowId, 10) : null;
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (!showId) return;
    let cancelled = false;

    // Read show details and current follow state from the database.
    async function load() {
      try {
        const [showRes, followRes] = await Promise.all([
          supabase
            .from("show")
            .select(`*, show_genre(genres(*)), season(id, name, season_number, air_date, poster_path, episode(id)), show_credits(title, person(id, name, profile_path), job(name, department(name)))`)
            .eq("id", showId)
            .is("deleted_at", null)
            .single(),
          session?.user?.id
            ? supabase
                .from("user_followed_shows")
                .select("id")
                .eq("profile_id", session.user.id)
                .eq("show_id", showId)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ]);

        if (showRes.error) throw showRes.error;
        if (cancelled) return;

        const row = showRes.data;
        if (!showAdult && row.adult) {
          dispatch({ type: "ERROR", error: "This content is restricted." });
          return;
        }
        const seasons = (row.season ?? [])
          .filter((s) => s.season_number > 0)
          .sort((a, b) => a.season_number - b.season_number);

        dispatch({
          type: "LOADED",
          payload: {
            show: row,
            genres: row.show_genre?.map((g) => g.genres).filter(Boolean) ?? [],
            seasons,
            cast: toCast(row.show_credits ?? []),
            crew: toCrew(row.show_credits ?? []),
            isFollowing: !!followRes.data,
          },
        });
      } catch (err) {
        if (!cancelled) dispatch({ type: "ERROR", error: err.message });
      }
    }

    load();
    return () => { cancelled = true; };
  }, [showId, session?.user?.id, showAdult]);

  const toggleFollow = useCallback(async () => {
    if (!session?.user?.id) return;
    const wasFollowing = state.isFollowing;
    dispatch({ type: "TOGGLE_FOLLOW" });

    // Write follow/unfollow in user_followed_shows.
    const { error } = wasFollowing
      ? await supabase
          .from("user_followed_shows")
          .delete()
          .eq("profile_id", session.user.id)
          .eq("show_id", showId)
      : await supabase
          .from("user_followed_shows")
          .insert({ profile_id: session.user.id, show_id: showId });

    if (error) dispatch({ type: "TOGGLE_FOLLOW" });
  }, [showId, session?.user?.id, state.isFollowing]);

  return { ...state, toggleFollow };
}
