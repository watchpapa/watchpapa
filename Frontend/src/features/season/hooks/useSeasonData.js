import { useEffect, useReducer } from "react";
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
    default:
      return state;
  }
}

const initialState = {
  season: null,
  show: null,
  episodes: [],
  cast: [],
  isLoading: true,
  error: null,
};

export function useSeasonData(rawSeasonId, rawShowId) {
  const seasonId = rawSeasonId ? parseInt(rawSeasonId, 10) : null;
  const showId = rawShowId ? parseInt(rawShowId, 10) : null;
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (!seasonId || !showId) return;
    let cancelled = false;

    async function load() {
      try {
        const [seasonRes, showRes] = await Promise.all([
          supabase
            .from("season")
            .select(`*, episode(id, name, episode_number, air_date, runtime, poster_path)`)
            .eq("id", seasonId)
            .single(),
          supabase
            .from("show")
            .select(`id, name, show_credits(title, person(id, name, profile_path), job(name))`)
            .eq("id", showId)
            .single(),
        ]);

        if (seasonRes.error) throw seasonRes.error;
        if (showRes.error) throw showRes.error;
        if (cancelled) return;

        const episodes = (seasonRes.data.episode ?? []).sort((a, b) => a.episode_number - b.episode_number);

        dispatch({
          type: "LOADED",
          payload: {
            season: seasonRes.data,
            show: showRes.data,
            episodes,
            cast: toCredits(showRes.data.show_credits ?? []),
          },
        });
      } catch (err) {
        if (!cancelled) dispatch({ type: "ERROR", error: err.message });
      }
    }

    load();
    return () => { cancelled = true; };
  }, [seasonId, showId]);

  return state;
}
