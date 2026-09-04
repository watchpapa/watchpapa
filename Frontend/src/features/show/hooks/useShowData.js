// Used by:
// - Frontend/src/pages/app/ShowPage.jsx
//
// Show metadata comes live from the watchpapa Worker (TMDB). Follow state is in
// Supabase, keyed by tmdb_id.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";
import { toCast, toCrew } from "../../../lib/credits.js";
import { useShow } from "../../content/hooks/useContent.js";
import { showFollowBlock } from "../../../lib/followGate.js";

export function useShowData(rawShowId, session, showAdult = false) {
  const tmdbId = rawShowId ? parseInt(rawShowId, 10) : null;
  const { data: show, loading, error } = useShow(tmdbId);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followLimitError, setFollowLimitError] = useState(null);

  useEffect(() => {
    if (!tmdbId || !session?.user?.id) {
      setIsFollowing(false);
      return;
    }
    let cancelled = false;
    supabase
      .from("user_followed_shows")
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
    if (!wasFollowing && showFollowBlock(show)) return; // already ended — no new follows
    setIsFollowing(!wasFollowing);

    const { error: writeError } = wasFollowing
      ? await supabase
          .from("user_followed_shows")
          .delete()
          .eq("profile_id", session.user.id)
          .eq("tmdb_id", tmdbId)
      : await supabase
          .from("user_followed_shows")
          .insert({ profile_id: session.user.id, tmdb_id: tmdbId });

    if (writeError) {
      if (writeError.message?.includes("FOLLOW_LIMIT_REACHED")) {
        setIsFollowing(false);
        setFollowLimitError(writeError.message.replace("FOLLOW_LIMIT_REACHED: ", ""));
      } else {
        setIsFollowing(wasFollowing);
      }
    }
  }, [tmdbId, session?.user?.id, isFollowing, show]);

  const restricted = show && !showAdult && (show.adult || show.nsfw);

  const seasons = (show?.seasons ?? [])
    .filter((s) => s.season_number > 0)
    .sort((a, b) => a.season_number - b.season_number);

  return {
    show: restricted ? null : show,
    genres: show?.genres ?? [],
    seasons,
    cast: toCast(show?.cast),
    crew: toCrew(show?.crew),
    isFollowing,
    followLimitError,
    isLoading: loading,
    error: restricted ? "This content is restricted." : error?.message ?? null,
    toggleFollow,
    clearFollowLimitError: () => setFollowLimitError(null),
  };
}
