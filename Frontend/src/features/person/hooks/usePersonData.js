// Used by:
// - Frontend/src/pages/app/PersonPage.jsx
import { useEffect, useReducer } from "react";
import { supabase } from "../../../lib/supabase.js";

// Apply state updates for person data loaded from the database.
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
  knownForDepartment: null,
  nicknames: [],
  movieCredits: [],
  showCredits: [],
  isLoading: true,
  error: null,
};

// Load person details and credits for the Person page.
export function usePersonData(slugOrId, showAdult = false) {
  const isNumericId = slugOrId ? /^\d+$/.test(slugOrId) : false;
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (!slugOrId) return;
    let cancelled = false;

    // Read person profile, aliases, and credits from related tables.
    async function load() {
      try {
        const personQuery = supabase
          .from("person")
          .select(`
            *,
            known_for:known_for_department_id(name),
            person_aka(nickname),
            movie_credits(title, job(name, department(name)), movie(id, title, poster_path, adult, slug)),
            show_credits(title, job(name, department(name)), show(id, name, poster_path, adult, slug))
          `)
          .is("deleted_at", null)
          .single();

        const { data, error } = await (isNumericId ? personQuery.eq("id", Number(slugOrId)) : personQuery.eq("slug", slugOrId));

        if (error) throw error;
        if (cancelled) return;

        if (!showAdult && data.adult) {
          dispatch({ type: "ERROR", error: "This content is restricted." });
          return;
        }

        const movieCredits = (data.movie_credits ?? [])
          .filter((c) => c.movie && (showAdult || !c.movie.adult))
          .map((c) => ({
            id: `m-${c.movie.id}-${c.title}`,
            mediaId: c.movie.id,
            mediaSlug: c.movie.slug ?? null,
            type: "movie",
            title: c.movie.title,
            posterPath: c.movie.poster_path ?? null,
            role: c.title ?? null,
            job: c.job?.name ?? null,
            department: c.job?.department?.name ?? null,
          }));

        const showCredits = (data.show_credits ?? [])
          .filter((c) => c.show && (showAdult || !c.show.adult))
          .map((c) => ({
            id: `s-${c.show.id}-${c.title}`,
            mediaId: c.show.id,
            mediaSlug: c.show.slug ?? null,
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
            knownForDepartment: data.known_for?.name ?? null,
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
  }, [slugOrId, showAdult]);

  return state;
}
