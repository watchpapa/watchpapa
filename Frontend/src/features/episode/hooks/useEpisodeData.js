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
  episode: null,
  season: null,
  show: null,
  siblings: [],
  cast: [],
  isLoading: true,
  error: null,
};

export function useEpisodeData(rawEpisodeId, rawSeasonId, rawShowId) {
  const episodeId = rawEpisodeId ? parseInt(rawEpisodeId, 10) : null;
  const seasonId = rawSeasonId ? parseInt(rawSeasonId, 10) : null;
  const showId = rawShowId ? parseInt(rawShowId, 10) : null;
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (!episodeId || !seasonId || !showId) return;
    let cancelled = false;

    async function load() {
      try {
        const [epRes, seasonRes, showRes] = await Promise.all([
          supabase
            .from("episode")
            .select(`*, episode_credits(title, person(id, name, profile_path), job(name))`)
            .eq("id", episodeId)
            .single(),
          supabase
            .from("season")
            .select(`id, name, season_number, episode(id, name, episode_number, air_date, runtime, poster_path)`)
            .eq("id", seasonId)
            .single(),
          supabase
            .from("show")
            .select(`id, name`)
            .eq("id", showId)
            .single(),
        ]);

        if (epRes.error) throw epRes.error;
        if (seasonRes.error) throw seasonRes.error;
        if (showRes.error) throw showRes.error;
        if (cancelled) return;

        const siblings = (seasonRes.data.episode ?? [])
          .filter((e) => e.id !== episodeId)
          .sort((a, b) => a.episode_number - b.episode_number);

        dispatch({
          type: "LOADED",
          payload: {
            episode: epRes.data,
            season: seasonRes.data,
            show: showRes.data,
            siblings,
            cast: toCredits(epRes.data.episode_credits ?? []),
          },
        });
      } catch (err) {
        if (!cancelled) dispatch({ type: "ERROR", error: err.message });
      }
    }

    load();
    return () => { cancelled = true; };
  }, [episodeId, seasonId, showId]);

  return state;
}
