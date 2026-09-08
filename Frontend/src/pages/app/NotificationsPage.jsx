import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import PageContainer from "../../components/ui/PageContainer.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Button from "../../components/ui/Button.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import LoadMoreButton from "../../components/ui/LoadMoreButton.jsx";
import { Skeleton } from "../../components/ui/Skeleton.jsx";
import { useNotifications } from "../../features/notifications/hooks/useNotifications.js";
import { notificationContent } from "../../features/notifications/lib/notificationContent.js";
import { useCurrentUser } from "../../features/profile/CurrentUserContext.jsx";
import { BellIcon, TrashIcon } from "../../components/icons/index.jsx";

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
  const { text, to, icon: Icon } = notificationContent(n);
  return (
    <Link to={to} className={`flex min-h-16 items-center gap-3 rounded-xl border px-3 py-3 transition hover:border-border-hover ${n.read_at ? "border-border/50 bg-surface" : "border-brand/40 bg-surface-2"}`}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface-3 text-sm font-bold text-text-link">{Icon ? <Icon size={18} /> : (n.actor_username?.[0] ?? "?").toUpperCase()}</div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm text-white">{text}</p>
        <p className="text-xs text-text-faint">{timeAgo(n.created_at)}</p>
      </div>
      {!n.read_at && <span className="h-2 w-2 shrink-0 rounded-full bg-brand" aria-label="Unread" />}
    </Link>
  );
}

function NotificationsPage({ session }) {
  const { items, loading, hasMore, loadMore, markAllRead, clearAll } = useNotifications(session);
  const { setUnreadNotifications } = useCurrentUser();
  const [clearing, setClearing] = useState(false);

  const handleClearAll = async () => {
    if (!window.confirm("Delete all notifications? This cannot be undone.")) return;
    setClearing(true);
    await clearAll();
    setClearing(false);
  };

  useEffect(() => {
    const t = setTimeout(() => { markAllRead(); setUnreadNotifications(0); }, 800);
    return () => clearTimeout(t);
  }, [markAllRead, setUnreadNotifications]);

  return (
    <AppLayout session={session} breadcrumbs={[{ label: "Notifications" }]}>
      <PageHead title="Notifications" path="/notifications" noindex />
      <PageContainer width="narrow" className="space-y-4">
        <PageHeader title="Notifications" actions={items.length > 0 && <Button variant="ghost" size="sm" icon={TrashIcon} onClick={handleClearAll} loading={clearing}>Clear all</Button>} />
        {loading && items.length === 0 && <div className="space-y-2"><Skeleton className="h-16 rounded-xl" /><Skeleton className="h-16 rounded-xl" /></div>}
        {!loading && items.length === 0 && <EmptyState icon={BellIcon} title="No notifications yet" description="Observe requests, accepted requests and mentions show up here." className="rounded-2xl border border-border/50 bg-surface" />}
        {items.length > 0 && <div className="space-y-2">{items.map((n) => <NotificationRow key={n.id} n={n} />)}</div>}
        {items.length > 0 && <LoadMoreButton onClick={loadMore} loading={loading} hasMore={hasMore} />}
      </PageContainer>
    </AppLayout>
  );
}

export default NotificationsPage;
