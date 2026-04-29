import { useCallback, useEffect, useReducer } from "react";
import { supabase } from "../../../lib/supabase.js";
import { toCast, toCrew } from "../../../lib/credits.js";

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
  movie: null,
  genres: [],
  cast: [],
  crew: [],
  isFollowing: false,
  isLoading: true,
  error: null,
};

export function useMovieData(rawMovieId, session, showAdult = false) {
  const movieId = rawMovieId ? parseInt(rawMovieId, 10) : null;
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (!movieId) return;
    let cancelled = false;

    async function load() {
      try {
        const [movieRes, followRes] = await Promise.all([
          supabase
            .from("movie")
            .select(`*, movie_genre(genres(*)), movie_credits(title, person(id, name, profile_path), job(name, department(name)))`)
            .eq("id", movieId)
            .is("deleted_at", null)
            .single(),
          session?.user?.id
            ? supabase
                .from("user_followed_movies")
                .select("id")
                .eq("profile_id", session.user.id)
                .eq("movie_id", movieId)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ]);

        if (movieRes.error) throw movieRes.error;
        if (cancelled) return;

        const row = movieRes.data;
        if (!showAdult && row.adult) {
          dispatch({ type: "ERROR", error: "This content is restricted." });
          return;
        }
        dispatch({
          type: "LOADED",
          payload: {
            movie: row,
            genres: row.movie_genre?.map((g) => g.genres).filter(Boolean) ?? [],
            cast: toCast(row.movie_credits ?? []),
            crew: toCrew(row.movie_credits ?? []),
            isFollowing: !!followRes.data,
          },
        });
      } catch (err) {
        if (!cancelled) dispatch({ type: "ERROR", error: err.message });
      }
    }

    load();
    return () => { cancelled = true; };
  }, [movieId, session?.user?.id, showAdult]);

  const toggleFollow = useCallback(async () => {
    if (!session?.user?.id) return;
    const wasFollowing = state.isFollowing;
    dispatch({ type: "TOGGLE_FOLLOW" });

    const { error } = wasFollowing
      ? await supabase
          .from("user_followed_movies")
          .delete()
          .eq("profile_id", session.user.id)
          .eq("movie_id", movieId)
      : await supabase
          .from("user_followed_movies")
          .insert({ profile_id: session.user.id, movie_id: movieId });

    if (error) dispatch({ type: "TOGGLE_FOLLOW" });
  }, [movieId, session?.user?.id, state.isFollowing]);

  return { ...state, toggleFollow };
}
