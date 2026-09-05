// Used by:
// - Frontend/src/pages/app/CollectionPage.jsx
//
// A collection's `parts` (from GET /api/content/collection/:id) come back as
// ordinary movie cards; follow state stays in Supabase, keyed by tmdb_id, same
// as everywhere else (see features/movies/hooks/useMediaBrowse.js).
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase.js";
import { useCollection } from "../../content/hooks/useContent.js";
import { followBlock } from "../../../lib/followGate.js";

export function useCollectionData(rawId, session) {
  const tmdbId = rawId ? parseInt(rawId, 10) : null;
  const { data: collection, loading, error } = useCollection(tmdbId);
  const [followedIds, setFollowedIds] = useState(new Set());
  const [followLimitError, setFollowLimitError] = useState(null);

  useEffect(() => {
    if (!session?.user?.id) {
      setFollowedIds(new Set());
      return;
    }
    let cancelled = false;
    supabase
      .from("user_followed_movies")
      .select("tmdb_id")
      .eq("profile_id", session.user.id)
      .then(({ data }) => {
        if (!cancelled) setFollowedIds(new Set((data ?? []).map((r) => Number(r.tmdb_id))));
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const toggleFollow = useCallback(
    async (id) => {
      if (!session?.user?.id || !id) return;
      const wasFollowing = followedIds.has(id);
      setFollowedIds((prev) => {
        const next = new Set(prev);
        wasFollowing ? next.delete(id) : next.add(id);
        return next;
      });
      const { error: writeError } = wasFollowing
        ? await supabase.from("user_followed_movies").delete().eq("profile_id", session.user.id).eq("tmdb_id", id)
        : await supabase.from("user_followed_movies").insert({ profile_id: session.user.id, tmdb_id: id });
      if (writeError) {
        if (writeError.message?.includes("FOLLOW_LIMIT_REACHED")) {
          setFollowLimitError(writeError.message.replace("FOLLOW_LIMIT_REACHED: ", ""));
        }
        setFollowedIds((prev) => {
          const next = new Set(prev);
          wasFollowing ? next.add(id) : next.delete(id);
          return next;
        });
      }
    },
    [session?.user?.id, followedIds],
  );

  const items = useMemo(
    () =>
      (collection?.parts ?? []).map((c) => ({
        id: c.id,
        type: "movie",
        title: c.title,
        posterPath: c.poster_path ?? null,
        isFollowing: followedIds.has(c.id),
        onFollowToggle: () => toggleFollow(c.id),
        genreIds: c.genre_ids ?? [],
        followBlockedLabel: followBlock("movie", c),
        nsfw: Boolean(c.nsfw),
      })),
    [collection, followedIds, toggleFollow],
  );

  return {
    collection,
    items,
    isLoading: loading,
    error: error?.message ?? null,
    followLimitError,
    clearFollowLimitError: () => setFollowLimitError(null),
  };
}
