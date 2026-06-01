import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";

const PAGE_SIZE = 30;

// Loads the current user's notifications + unread count, and marks them read.
export function useNotifications(session) {
  const uid = session?.user?.id ?? null;
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const loadUnread = useCallback(async () => {
    if (!uid) { setUnread(0); return; }
    const { data } = await supabase.rpc("get_unread_notification_count");
    setUnread(data ?? 0);
  }, [uid]);

  const fetchPage = useCallback(async (pageNum, append) => {
    if (!uid) return;
    setLoading(true);
    const { data } = await supabase.rpc("get_notifications", {
      p_limit: PAGE_SIZE,
      p_offset: pageNum * PAGE_SIZE,
    });
    const rows = data ?? [];
    setLoading(false);
    setHasMore(rows.length === PAGE_SIZE);
    setItems((prev) => (append ? [...prev, ...rows] : rows));
  }, [uid]);

  useEffect(() => {
    setItems([]);
    setPage(0);
    setHasMore(true);
    if (uid) {
      fetchPage(0, false);
      loadUnread();
    }
  }, [uid, fetchPage, loadUnread]);

  const loadMore = useCallback(() => {
    const next = page + 1;
    setPage(next);
    fetchPage(next, true);
  }, [page, fetchPage]);

  const markAllRead = useCallback(async () => {
    if (!uid || unread === 0) return;
    setUnread(0);
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
    await supabase.rpc("mark_notifications_read", { p_ids: null });
  }, [uid, unread]);

  return { items, unread, loading, hasMore, loadMore, markAllRead, reloadUnread: loadUnread };
}
