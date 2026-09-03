// Used by:
// - Frontend/src/pages/app/MoviePage.jsx
//
// Movie metadata now comes live from the watchpapa Worker (TMDB). Only the
// follow relationship is in Supabase, keyed by tmdb_id.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";
import { toCast, toCrew } from "../../../lib/credits.js";
import { useMovie } from "../../content/hooks/useContent.js";

export function useMovieData(rawMovieId, session, showAdult = false) {
  const tmdbId = rawMovieId ? parseInt(rawMovieId, 10) : null;
  const { data: movie, loading, error } = useMovie(tmdbId);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followLimitError, setFollowLimitError] = useState(null);

  useEffect(() => {
    if (!tmdbId || !session?.user?.id) {
      setIsFollowing(false);
      return;
    }
    let cancelled = false;
    supabase
      .from("user_followed_movies")
      .select("id")
      .eq("profile_id", session.user.id)
      .eq("tmdb_id", tmdbId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setIsFollowing(!!data);
      });
    return () => {
      cancelled = true;
    };
  }, [tmdbId, session?.user?.id]);

  const toggleFollow = useCallback(async () => {
    if (!session?.user?.id || !tmdbId) return;
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);

    const { error: writeError } = wasFollowing
      ? await supabase
          .from("user_followed_movies")
          .delete()
          .eq("profile_id", session.user.id)
          .eq("tmdb_id", tmdbId)
      : await supabase
          .from("user_followed_movies")
          .insert({ profile_id: session.user.id, tmdb_id: tmdbId });

    if (writeError) {
      if (writeError.message?.includes("FOLLOW_LIMIT_REACHED")) {
        setIsFollowing(false);
        setFollowLimitError(writeError.message.replace("FOLLOW_LIMIT_REACHED: ", ""));
      } else {
        setIsFollowing(wasFollowing);
      }
    }
  }, [tmdbId, session?.user?.id, isFollowing]);

  const restricted = movie && !showAdult && movie.adult;

  return {
    movie: restricted ? null : movie,
    genres: movie?.genres ?? [],
    cast: toCast(movie?.cast),
    crew: toCrew(movie?.crew),
    isFollowing,
    followLimitError,
    isLoading: loading,
    error: restricted ? "This content is restricted." : error?.message ?? null,
    toggleFollow,
    clearFollowLimitError: () => setFollowLimitError(null),
  };
}
