import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";

const PAGE_SIZE = 30;

// Recent ratings from people the current user observes (newest first).
export function useActivityFeed(session, showAdult = false) {
  const uid = session?.user?.id ?? null;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const fetchPage = useCallback(async (pageNum, append) => {
    if (!uid) return;
    setLoading(true);
    const { data } = await supabase.rpc("get_activity_feed", {
      p_limit: PAGE_SIZE,
      p_offset: pageNum * PAGE_SIZE,
      p_include_adult: showAdult,
    });
    const rows = data ?? [];
    setLoading(false);
    setHasMore(rows.length === PAGE_SIZE);
    setItems((prev) => (append ? [...prev, ...rows] : rows));
  }, [uid, showAdult]);

  useEffect(() => {
    setItems([]);
    setPage(0);
    setHasMore(true);
    if (uid) fetchPage(0, false);
  }, [uid, fetchPage]);

  const loadMore = useCallback(() => {
    const next = page + 1;
    setPage(next);
    fetchPage(next, true);
  }, [page, fetchPage]);

  return { items, loading, hasMore, loadMore };
}
