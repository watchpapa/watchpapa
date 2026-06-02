import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import { useNotifications } from "../../features/notifications/hooks/useNotifications.js";
import { notificationContent } from "../../features/notifications/lib/notificationContent.js";

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function NotificationRow({ n }) {
  const { text, to } = notificationContent(n);
  const initials = (n.actor_username?.[0] ?? "?").toUpperCase();
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 rounded-xl border px-3 py-3 transition hover:border-[#5a5aaa] ${
        n.read_at ? "border-[#2a3570]/50 bg-[#0d0f1e]" : "border-[#2a2f6a] bg-[#12152e]"
      }`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#3a3a7a] bg-[#1a1d35] text-sm font-bold text-[#a0a0e8]">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-white">{text}</p>
        <p className="text-xs text-[#5050a0]">{timeAgo(n.created_at)}</p>
      </div>
      {!n.read_at && <span className="h-2 w-2 shrink-0 rounded-full bg-[#7070d0]" />}
    </Link>
  );
}

function NotificationsPage({ session }) {
  const { items, loading, hasMore, loadMore, markAllRead, clearAll } = useNotifications(session);
  const [clearing, setClearing] = useState(false);

  const handleClearAll = async () => {
    if (!window.confirm("Delete all notifications? This cannot be undone.")) return;
    setClearing(true);
    await clearAll();
    setClearing(false);
  };

  useEffect(() => {
    const t = setTimeout(() => markAllRead(), 800);
    return () => clearTimeout(t);
  }, [markAllRead]);

  return (
    <AppLayout session={session} breadcrumbs={[{ label: "Notifications" }]}>
      <PageHead title="Notifications" path="/notifications" noindex />
      <div className="mx-auto max-w-2xl space-y-4 py-6 px-4 sm:px-0">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold text-white">Notifications</h1>
          {items.length > 0 && (
            <button
              onClick={handleClearAll}
              disabled={clearing}
              className="text-xs font-semibold text-[#7070d0] transition hover:text-[#8888e8] disabled:opacity-50"
            >
              Clear all
            </button>
          )}
        </div>

        {loading && items.length === 0 && (
          <div className="animate-pulse space-y-2">
            <div className="h-16 rounded-xl bg-[#1a1f3a]" />
            <div className="h-16 rounded-xl bg-[#1a1f3a]" />
          </div>
        )}

        {!loading && items.length === 0 && (
          <p className="rounded-2xl border border-[#2a3570]/50 bg-[#0a0c18] py-16 text-center text-sm text-[#5050a0]">
            No notifications yet.
          </p>
        )}

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((n) => <NotificationRow key={n.id} n={n} />)}
          </div>
        )}

        {hasMore && items.length > 0 && (
          <button
            onClick={loadMore}
            disabled={loading}
            className="w-full rounded-xl border border-[#2a2f5a] py-2.5 text-sm font-semibold text-[#8383e7] transition hover:border-[#5a5aaa] hover:text-white disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        )}
      </div>
    </AppLayout>
  );
}

export default NotificationsPage;
