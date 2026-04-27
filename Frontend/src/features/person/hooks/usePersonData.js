import { useEffect, useReducer } from "react";
import { supabase } from "../../../lib/supabase.js";

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
  person: null,
  nicknames: [],
  movieCredits: [],
  showCredits: [],
  isLoading: true,
  error: null,
};

export function usePersonData(rawPersonId) {
  const personId = rawPersonId ? parseInt(rawPersonId, 10) : null;
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (!personId) return;
    let cancelled = false;

    async function load() {
      try {
        const { data, error } = await supabase
          .from("person")
          .select(`
            *,
            person_aka(nickname),
            movie_credits(title, job(name, department(name)), movie(id, title, poster_path)),
            show_credits(title, job(name, department(name)), show(id, name, poster_path))
          `)
          .eq("id", personId)
          .is("deleted_at", null)
          .single();

        if (error) throw error;
        if (cancelled) return;

        const movieCredits = (data.movie_credits ?? [])
          .filter((c) => c.movie)
          .map((c) => ({
            id: `m-${c.movie.id}-${c.title}`,
            mediaId: c.movie.id,
            type: "movie",
            title: c.movie.title,
            posterPath: c.movie.poster_path ?? null,
            role: c.title ?? null,
            job: c.job?.name ?? null,
            department: c.job?.department?.name ?? null,
          }));

        const showCredits = (data.show_credits ?? [])
          .filter((c) => c.show)
          .map((c) => ({
            id: `s-${c.show.id}-${c.title}`,
            mediaId: c.show.id,
            type: "show",
            title: c.show.name,
            posterPath: c.show.poster_path ?? null,
            role: c.title ?? null,
            job: c.job?.name ?? null,
            department: c.job?.department?.name ?? null,
          }));

        dispatch({
          type: "LOADED",
          payload: {
            person: data,
            nicknames: (data.person_aka ?? []).map((a) => a.nickname),
            movieCredits,
            showCredits,
          },
        });
      } catch (err) {
        if (!cancelled) dispatch({ type: "ERROR", error: err.message });
      }
    }

    load();
    return () => { cancelled = true; };
  }, [personId]);

  return state;
}
