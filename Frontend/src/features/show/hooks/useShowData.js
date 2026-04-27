import { useCallback, useEffect, useReducer } from "react";
import { supabase } from "../../../lib/supabase.js";

function toCredits(rows) {
  return rows
    .filter((r) => r.person && r.job?.name === "Actor")
    .map((r) => ({
      id: `${r.person.id}-${r.title}`,
      personId: r.person.id,
      name: r.person.name,
      profilePath: r.person.profile_path ?? null,
      character: r.title ?? null,
    }));
}

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
  isFollowing: false,
  isLoading: true,
  error: null,
};

export function useShowData(rawShowId, session) {
  const showId = rawShowId ? parseInt(rawShowId, 10) : null;
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (!showId) return;
    let cancelled = false;

    async function load() {
      try {
        const [showRes, followRes] = await Promise.all([
          supabase
            .from("show")
            .select(`*, show_genre(genres(*)), season(id, name, season_number, air_date, poster_path, episode(id)), show_credits(title, person(id, name, profile_path), job(name))`)
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
        const seasons = (row.season ?? [])
          .filter((s) => s.season_number > 0)
          .sort((a, b) => a.season_number - b.season_number);

        dispatch({
          type: "LOADED",
          payload: {
            show: row,
            genres: row.show_genre?.map((g) => g.genres).filter(Boolean) ?? [],
            seasons,
            cast: toCredits(row.show_credits ?? []),
            isFollowing: !!followRes.data,
          },
        });
      } catch (err) {
        if (!cancelled) dispatch({ type: "ERROR", error: err.message });
      }
    }

    load();
    return () => { cancelled = true; };
  }, [showId, session?.user?.id]);

  const toggleFollow = useCallback(async () => {
    if (!session?.user?.id) return;
    const wasFollowing = state.isFollowing;
    dispatch({ type: "TOGGLE_FOLLOW" });

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
