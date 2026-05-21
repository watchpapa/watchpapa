// Used by:
// - Frontend/src/pages/app/SeasonPage.jsx
import { useEffect, useReducer } from "react";
import { supabase } from "../../../lib/supabase.js";
import { toCast, toCrew } from "../../../lib/credits.js";

// Apply state updates for season data loaded from the database.
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
  crew: [],
  isLoading: true,
  error: null,
};

// Load season details, show details, and credits for the Season page.
// showSlugOrId: show slug or numeric id; seasonNumber: season_number integer.
export function useSeasonData(showSlugOrId, seasonNumber) {
  const isNumericShowId = showSlugOrId ? /^\d+$/.test(showSlugOrId) : false;
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (!showSlugOrId || !seasonNumber) return;
    let cancelled = false;

    // Read show → season → episodes and credits from the database.
    async function load() {
      try {
        // Step 1: resolve show by slug or numeric id.
        const showQuery = supabase
          .from("show")
          .select(`id, name, slug, show_credits(title, person(id, name, profile_path, slug), job(name, department(name)))`)
          .single();
        const showRes = await (isNumericShowId
          ? showQuery.eq("id", Number(showSlugOrId))
          : showQuery.eq("slug", showSlugOrId));

        if (showRes.error) throw showRes.error;
        if (cancelled) return;

        // Step 2: resolve season by show_id + season_number.
        const seasonRes = await supabase
          .from("season")
          .select(`*, episode(id, name, episode_number, air_date, runtime, poster_path)`)
          .eq("show_id", showRes.data.id)
          .eq("season_number", Number(seasonNumber))
          .single();

        if (seasonRes.error) throw seasonRes.error;
        if (cancelled) return;

        const episodes = (seasonRes.data.episode ?? []).sort((a, b) => a.episode_number - b.episode_number);
        const credits = showRes.data.show_credits ?? [];

        dispatch({
          type: "LOADED",
          payload: {
            season: seasonRes.data,
            show: showRes.data,
            episodes,
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
  }, [showSlugOrId, seasonNumber]);

  return state;
}
