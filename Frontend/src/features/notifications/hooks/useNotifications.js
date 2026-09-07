import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase.js";
import { listKey, readList, writeList } from "../../../lib/listCache.js";

const PAGE_SIZE = 30;
const TTL = 120_000; // "live" surface — restore on quick Back, else refetch

// Loads the current user's notifications + unread count, and marks them read.
export function useNotifications(session) {
  const uid = session?.user?.id ?? null;
  const key = uid ? listKey("notifications", { uid }) : null;
  const seed = readList(key, TTL);

  const [items, setItems] = useState(() => seed?.items ?? []);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(seed?.hasMore ?? true);
  const [page, setPage] = useState(seed?.page ?? 0);

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
    if (!uid) {
      setItems([]);
      setPage(0);
      setHasMore(true);
      return;
    }
    loadUnread();
    const warm = readList(key, TTL);
    if (warm) {
      setItems(warm.items);
      setPage(warm.page);
      setHasMore(warm.hasMore);
      return;
    }
    setItems([]);
    setPage(0);
    setHasMore(true);
    fetchPage(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, fetchPage, loadUnread]);

  // Write-through (short TTL).
  useEffect(() => {
    if (!key || loading || items.length === 0) return;
    writeList(key, { items, page, hasMore });
  }, [key, loading, items, page, hasMore]);

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

  const clearAll = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    await supabase.from("notification").delete().eq("recipient_id", uid);
    setItems([]);
    setUnread(0);
    setLoading(false);
    if (key) writeList(key, { items: [], page: 0, hasMore: false });
  }, [uid, key]);

  return { items, unread, loading, hasMore, loadMore, markAllRead, clearAll, reloadUnread: loadUnread };
}
