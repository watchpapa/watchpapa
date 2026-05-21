// Used by:
// - Frontend/src/pages/app/MoviePage.jsx
import { useCallback, useEffect, useReducer } from "react";
import { supabase } from "../../../lib/supabase.js";
import { toCast, toCrew } from "../../../lib/credits.js";

// Apply state updates for movie data loaded from the database.
function reducer(state, action) {
  switch (action.type) {
    case "LOADED":
      return { ...state, ...action.payload, isLoading: false, error: null };
    case "ERROR":
      return { ...state, isLoading: false, error: action.error };
    case "TOGGLE_FOLLOW":
      return { ...state, isFollowing: !state.isFollowing };
    case "FOLLOW_LIMIT":
      return { ...state, isFollowing: false, followLimitError: action.message };
    case "CLEAR_FOLLOW_LIMIT":
      return { ...state, followLimitError: null };
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
  followLimitError: null,
  isLoading: true,
  error: null,
};

export function useMovieData(slugOrId, session, showAdult = false) {
  const isNumericId = slugOrId ? /^\d+$/.test(slugOrId) : false;
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (!slugOrId) return;
    let cancelled = false;

    async function load() {
      try {
        // Read the movie row with joined genres/credits and follow state.
        const movieQuery = supabase
          .from("movie")
          .select(`*, movie_genre(genres(*)), movie_credits(title, person(id, name, profile_path, slug), job(name, department(name)))`)
          .is("deleted_at", null)
          .single();

        const [movieRes, followRes] = await Promise.all([
          isNumericId ? movieQuery.eq("id", Number(slugOrId)) : movieQuery.eq("slug", slugOrId),
          session?.user?.id
            ? supabase
                .from("user_followed_movies")
                .select("id")
                .eq("profile_id", session.user.id)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ]);

        if (movieRes.error) throw movieRes.error;
        if (cancelled) return;

        const row = movieRes.data;

        // Fix the follow query — we need movie id for the eq filter, get it from row
        let isFollowing = false;
        if (session?.user?.id) {
          const { data: fData } = await supabase
            .from("user_followed_movies")
            .select("id")
            .eq("profile_id", session.user.id)
            .eq("movie_id", row.id)
            .maybeSingle();
          isFollowing = !!fData;
        }

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
            isFollowing,
          },
        });
      } catch (err) {
        if (!cancelled) dispatch({ type: "ERROR", error: err.message });
      }
    }

    load();
    return () => { cancelled = true; };
  }, [slugOrId, session?.user?.id, showAdult]);

  const toggleFollow = useCallback(async () => {
    if (!session?.user?.id || !state.movie?.id) return;
    const movieId = state.movie.id;
    const wasFollowing = state.isFollowing;
    dispatch({ type: "TOGGLE_FOLLOW" });

    // Write follow/unfollow in user_followed_movies.
    const { error } = wasFollowing
      ? await supabase
          .from("user_followed_movies")
          .delete()
          .eq("profile_id", session.user.id)
          .eq("movie_id", movieId)
      : await supabase
          .from("user_followed_movies")
          .insert({ profile_id: session.user.id, movie_id: movieId });

    if (error) {
      if (error.message?.includes("FOLLOW_LIMIT_REACHED")) {
        dispatch({ type: "FOLLOW_LIMIT", message: error.message.replace("FOLLOW_LIMIT_REACHED: ", "") });
      } else {
        dispatch({ type: "TOGGLE_FOLLOW" });
      }
    }
  }, [state.movie?.id, session?.user?.id, state.isFollowing]);

  return {
    ...state,
    toggleFollow,
    clearFollowLimitError: () => dispatch({ type: "CLEAR_FOLLOW_LIMIT" }),
  };
}
