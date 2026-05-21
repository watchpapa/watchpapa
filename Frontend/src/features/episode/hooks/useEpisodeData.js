// Used by:
// - Frontend/src/pages/app/EpisodePage.jsx
import { useEffect, useReducer } from "react";
import { supabase } from "../../../lib/supabase.js";
import { toCast, toCrew } from "../../../lib/credits.js";

// Apply state updates for episode data loaded from the database.
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
  crew: [],
  isLoading: true,
  error: null,
};

// Load episode, season, and show details for the Episode page.
// showSlugOrId: show slug or numeric id; seasonNumber/episodeNumber: integers.
export function useEpisodeData(showSlugOrId, seasonNumber, episodeNumber) {
  const isNumericShowId = showSlugOrId ? /^\d+$/.test(showSlugOrId) : false;
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (!showSlugOrId || !seasonNumber || !episodeNumber) return;
    let cancelled = false;

    // Read show → season → episode rows (with related credits/episodes).
    async function load() {
      try {
        // Step 1: resolve show by slug or numeric id.
        const showQuery = supabase
          .from("show")
          .select(`id, name, slug`)
          .single();
        const showRes = await (isNumericShowId
          ? showQuery.eq("id", Number(showSlugOrId))
          : showQuery.eq("slug", showSlugOrId));

        if (showRes.error) throw showRes.error;
        if (cancelled) return;

        const showId = showRes.data.id;

        // Step 2: resolve season and its episode list.
        const seasonRes = await supabase
          .from("season")
          .select(`id, name, season_number, episode(id, name, episode_number, air_date, runtime, poster_path)`)
          .eq("show_id", showId)
          .eq("season_number", Number(seasonNumber))
          .single();

        if (seasonRes.error) throw seasonRes.error;
        if (cancelled) return;

        const seasonId = seasonRes.data.id;

        // Step 3: resolve episode by season_id + episode_number with credits.
        const epRes = await supabase
          .from("episode")
          .select(`*, episode_credits(title, person(id, name, profile_path, slug), job(name, department(name)))`)
          .eq("season_id", seasonId)
          .eq("episode_number", Number(episodeNumber))
          .single();

        if (epRes.error) throw epRes.error;
        if (cancelled) return;

        const siblings = (seasonRes.data.episode ?? [])
          .filter((e) => e.id !== epRes.data.id)
          .sort((a, b) => a.episode_number - b.episode_number);

        const credits = epRes.data.episode_credits ?? [];

        dispatch({
          type: "LOADED",
          payload: {
            episode: epRes.data,
            season: seasonRes.data,
            show: showRes.data,
            siblings,
            cast: toCast(credits),
            crew: toCrew(credits),
          },
        });
      } catch (err) {
        if (!cancelled) dispatch({ type: "ERROR", error: err.message });
      }
    }

    load();
    return () => { cancelled = true; };
  }, [showSlugOrId, seasonNumber, episodeNumber]);

  return state;
}
