import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase.js";
import { notificationContent } from "../../features/notifications/lib/notificationContent.js";
import { useCurrentUser } from "../../features/profile/CurrentUserContext.jsx";
import IconButton from "../ui/IconButton.jsx";
import Popover from "../ui/Popover.jsx";
import { BellIcon } from "../icons/index.jsx";

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

// Header bell: unread badge from CurrentUserContext (shared with the account
// menu / tab bar badges), latest 8 notifications in a viewport-clamped popover.
function NotificationBell() {
  const navigate = useNavigate();
  const me = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const anchorRef = useRef(null);

  if (!me.isAuthenticated) return null;

  const handleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      const { data } = await supabase.rpc("get_notifications", { p_limit: 8, p_offset: 0 });
      setItems(data ?? []);
      setLoaded(true);
      if (me.unreadNotifications > 0) {
        me.setUnreadNotifications(0);
        setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
        await supabase.rpc("mark_notifications_read", { p_ids: null });
      }
    }
  };

  return (
    <>
      <IconButton ref={anchorRef} label="Notifications" onClick={handleOpen} badge={me.unreadNotifications} active={open} aria-haspopup="dialog" aria-expanded={open} className="h-9 w-9 md:h-10 md:w-10">
        <BellIcon size={19} />
      </IconButton>
      <Popover open={open} anchorRef={anchorRef} onClose={() => setOpen(false)} width={340} aria-label="Notifications">
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
          <p className="text-sm font-bold text-white">Notifications</p>
          <Link to="/notifications" onClick={() => setOpen(false)} className="text-xs font-semibold text-heading hover:text-white">
            See all
          </Link>
        </div>
        <div className="max-h-[60svh] overflow-y-auto p-2">
          {!loaded ? (
            <p className="py-8 text-center text-xs text-text-faint">Loading…</p>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-xs text-text-faint">No notifications</p>
          ) : (
            items.map((n) => {
              const { text, to } = notificationContent(n);
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => { setOpen(false); navigate(to); }}
                  className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition hover:bg-surface-2"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface-3 text-xs font-bold text-text-link">
                    {(n.actor_username?.[0] ?? "?").toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-text">{text}</span>
                  <span className="shrink-0 text-[10px] text-text-faint">{timeAgo(n.created_at)}</span>
                </button>
              );
            })
          )}
        </div>
      </Popover>
    </>
  );
}

export default NotificationBell;
