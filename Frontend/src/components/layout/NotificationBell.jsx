import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase.js";
import { notificationContent } from "../../features/notifications/lib/notificationContent.js";

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function NotificationBell({ session }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef(null);

  const uid = session?.user?.id ?? null;

  useEffect(() => {
    if (!uid) { setUnread(0); return; }
    let active = true;
    supabase.rpc("get_unread_notification_count").then(({ data }) => {
      if (active) setUnread(data ?? 0);
    });
    return () => { active = false; };
  }, [uid]);

  useEffect(() => {
    function onPointerdown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener("pointerdown", onPointerdown);
    return () => document.removeEventListener("pointerdown", onPointerdown);
  }, [open]);

  const handleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next && !loaded) {
      const { data } = await supabase.rpc("get_notifications", { p_limit: 8, p_offset: 0 });
      setItems(data ?? []);
      setLoaded(true);
      if (unread > 0) {
        setUnread(0);
        setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
        await supabase.rpc("mark_notifications_read", { p_ids: null });
      }
    }
  };

  if (!session) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={handleOpen}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl text-[#8888c8] transition hover:bg-[#1a1d35] hover:text-white"
        aria-label="Notifications"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e8554a] px-1 text-[9px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 max-w-[calc(100vw-1rem)] origin-top-right animate-[fadeSlideDown_0.15s_ease-out] rounded-2xl border border-[#2a3570] bg-[#0d0f1e] shadow-xl shadow-black/40">
          <div className="flex items-center justify-between border-b border-[#1a1f3a] px-4 py-3">
            <p className="text-sm font-bold text-white">Notifications</p>
            <Link to="/notifications" onClick={() => setOpen(false)} className="text-xs font-semibold text-[#8383e7] hover:text-white">
              See all
            </Link>
          </div>
          <div className="max-h-96 overflow-y-auto p-2">
            {items.length === 0 ? (
              <p className="py-8 text-center text-xs text-[#5050a0]">No notifications</p>
            ) : (
              items.map((n) => {
                const { text, to } = notificationContent(n);
                return (
                  <button
                    key={n.id}
                    onClick={() => { setOpen(false); navigate(to); }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition hover:bg-[#141728]"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#3a3a7a] bg-[#1a1d35] text-xs font-bold text-[#a0a0e8]">
                      {(n.actor_username?.[0] ?? "?").toUpperCase()}
                    </div>
                    <span className="min-w-0 flex-1 truncate text-sm text-[#c0c0e8]">{text}</span>
                    <span className="shrink-0 text-[10px] text-[#5050a0]">{timeAgo(n.created_at)}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
