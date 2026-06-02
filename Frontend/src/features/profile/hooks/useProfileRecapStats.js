import { useEffect, useReducer } from "react";
import { supabase } from "../../../lib/supabase.js";

function reducer(state, action) {
  switch (action.type) {
    case "LOADED":
      return { ...state, ...action.payload, loading: false, error: null };
    case "ERROR":
      return { ...state, loading: false, error: action.error };
    default:
      return state;
  }
}

const initialState = {
  weekly: null,
  monthly: null,
  loading: true,
  error: null,
};

export function useProfileRecapStats(profileId, tier) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (!profileId || !tier) {
      dispatch({ type: "LOADED", payload: { weekly: null, monthly: null } });
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const { data, error } = await supabase
          .from("user_rating")
          .select(`value, created_at, movie_id, show_id,
            movie:movie_id(poster_path),
            show:show_id(poster_path)`)
          .eq("profile_id", profileId)
          .gte("created_at", since30);

        if (error) throw error;
        if (cancelled) return;

        const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const weekRows = (data || []).filter(r => r.created_at >= since7);
        const monthRows = data || [];

        const aggregate = (rows) => {
          if (!rows.length) return { count: 0, avg: null, movieCount: 0, showCount: 0, posters: [] };
          const avg = +(rows.reduce((s, r) => s + r.value, 0) / rows.length).toFixed(1);
          const posters = rows
            .map(r => r.movie?.poster_path || r.show?.poster_path)
            .filter(Boolean)
            .slice(0, 6); // limit to 6 posters
          return {
            count: rows.length,
            avg,
            movieCount: rows.filter(r => r.movie_id).length,
            showCount: rows.filter(r => r.show_id).length,
            posters,
          };
        };

        dispatch({
          type: "LOADED",
          payload: {
            weekly: aggregate(weekRows),
            monthly: aggregate(monthRows),
          },
        });
      } catch (err) {
        if (!cancelled) dispatch({ type: "ERROR", error: err.message });
      }
    }

    load();
    return () => { cancelled = true; };
  }, [profileId, tier]);

  return state;
}
