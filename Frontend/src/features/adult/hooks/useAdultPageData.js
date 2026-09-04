// Used by:
// - Frontend/src/pages/app/AdultPage.jsx
//
// One filterable/sortable grid off the Worker's /discover/:type route with
// `adult_only=1` (see worker/src/tmdb/discover.js) — type (movie/show), sort
// (popular/rated/newest), and either an NSFW keyword category or a genre.
// Any filter change resets to page 1; "load more" appends. That route returns
// nothing at all unless the request carries include_adult=true, which is the
// same `showAdult` this hook is only ever enabled with.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";
import { apiFetch } from "../../../lib/api.js";
import { followBlock } from "../../../lib/followGate.js";

const KIND = {
  movie: { discover: "movie", followTable: "user_followed_movies" },
  show: { discover: "tv", followTable: "user_followed_shows" },
};

function buildPath(type, { sort, keyword, genreId }, page) {
  const q = new URLSearchParams({ adult_only: "1", include_adult: "true", page: String(page) });
  if (sort) q.set("sort", sort);
  if (keyword) q.set("keyword", keyword);
  if (genreId) q.set("with_genres", String(genreId));
  return `/api/content/discover/${KIND[type].discover}?${q}`;
}

export function useAdultPageData(session, enabled, filters) {
  const { type, sort, keyword, genreId } = filters;
  const K = KIND[type];
  const [cards, setCards] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [followedIds, setFollowedIds] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  // First page — refetched whenever any filter changes.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { results, total_pages } = await apiFetch(buildPath(type, { sort, keyword, genreId }, 1));
        if (cancelled) return;
        setCards(results ?? []);
        setPage(1);
        setTotalPages(total_pages ?? 1);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, type, sort, keyword, genreId]);

  // Follow state — only depends on type + user, not the other filters.
  useEffect(() => {
    if (!enabled || !session?.user?.id) {
      setFollowedIds(new Set());
      return;
    }
    let cancelled = false;
    supabase
      .from(K.followTable)
      .select("tmdb_id")
      .eq("profile_id", session.user.id)
      .then(({ data }) => {
        if (!cancelled) setFollowedIds(new Set((data ?? []).map((r) => Number(r.tmdb_id))));
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, K.followTable, session?.user?.id]);

  const loadMore = useCallback(async () => {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    try {
      const { results } = await apiFetch(buildPath(type, { sort, keyword, genreId }, page + 1));
      setCards((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...(results ?? []).filter((c) => !seen.has(c.id))];
      });
      setPage((p) => p + 1);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, page, totalPages, type, sort, keyword, genreId]);

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
        ? await supabase.from(K.followTable).delete().eq("profile_id", session.user.id).eq("tmdb_id", id)
        : await supabase.from(K.followTable).insert({ profile_id: session.user.id, tmdb_id: id });
      if (writeError) {
        setFollowedIds((prev) => {
          const next = new Set(prev);
          wasFollowing ? next.add(id) : next.delete(id);
          return next;
        });
      }
    },
    [session?.user?.id, followedIds, K.followTable],
  );

  const items = cards.map((c) => ({
    id: c.id,
    type,
    title: c.title,
    posterPath: c.poster_path ?? null,
    isFollowing: followedIds.has(c.id),
    onFollowToggle: () => toggleFollow(c.id),
    followBlockedLabel: followBlock(type, c),
    // Already behind the page's own "you're about to see adult content"
    // warning — no point re-blurring every poster on top of that.
    blurDisabled: true,
  }));

  return { items, isLoading: enabled && isLoading, error, hasMore: page < totalPages, loadMore, loadingMore };
}
