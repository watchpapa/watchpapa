import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase.js";
import { useContentBatch } from "../../content/hooks/useContentBatch.js";
import { cardKey, itemFromRow } from "../../content/lib/keys.js";

const PAGE_SIZE = 30;

// Recent ratings from people the current user observes. The RPC returns ids only
// (get_activity_feed_v2); title/poster + adult filtering happen client-side.
export function useActivityFeed(session, showAdult = false) {
  const uid = session?.user?.id ?? null;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const fetchPage = useCallback(
    async (pageNum, append) => {
      if (!uid) return;
      setLoading(true);
      const { data } = await supabase.rpc("get_activity_feed_v2", {
        p_limit: PAGE_SIZE,
        p_offset: pageNum * PAGE_SIZE,
      });
      const raw = (data ?? []).map((r) => ({
        ...r,
        tmdb_id: Number(r.tmdb_id),
        tmdb_show_id: r.tmdb_show_id ? Number(r.tmdb_show_id) : null,
      }));
      setLoading(false);
      setHasMore(raw.length === PAGE_SIZE);
      setRows((prev) => (append ? [...prev, ...raw] : raw));
    },
    [uid],
  );

  useEffect(() => {
    setRows([]);
    setPage(0);
    setHasMore(true);
    if (uid) fetchPage(0, false);
  }, [uid, fetchPage]);

  const { cards, loading: cardsLoading } = useContentBatch(
    useMemo(() => rows.map(itemFromRow), [rows]),
  );

  const items = useMemo(
    () =>
      rows
        .map((r) => {
          const card = cards[cardKey(itemFromRow(r))];
          return {
            rating_id: r.rating_id,
            username: r.username,
            value: r.value,
            rated_at: r.rated_at,
            media_type: r.media_type,
            showId: r.tmdb_show_id ?? r.tmdb_id,
            seasonNumber: r.season_number,
            episodeNumber: r.episode_number,
            tmdbId: r.tmdb_id,
            title: card?.title ?? null,
            poster_path: card?.poster_path ?? null,
            adult: card?.adult ?? false,
          };
        })
        .filter((it) => showAdult || !it.adult),
    [rows, cards, showAdult],
  );

  const loadMore = useCallback(() => {
    const next = page + 1;
    setPage(next);
    fetchPage(next, true);
  }, [page, fetchPage]);

  return { items, loading: loading || cardsLoading, hasMore, loadMore };
}
