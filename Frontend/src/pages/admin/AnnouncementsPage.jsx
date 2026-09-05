import { useEffect, useState } from "react";
import { useAdminAnnouncements } from "../../features/admin/hooks/useAdminAnnouncements.js";
import PageHeader from "../../components/ui/PageHeader.jsx";
import PillTabs from "../../components/ui/PillTabs.jsx";
import Button from "../../components/ui/Button.jsx";
import Badge from "../../components/ui/Badge.jsx";
import ErrorNote from "../../components/ui/ErrorNote.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import { Skeleton } from "../../components/ui/Skeleton.jsx";

function fmt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function PostRow({ post, onRestore, onDelete }) {
  const [busy, setBusy] = useState(false);
  const handleRestore = async () => { setBusy(true); await onRestore(post.id); setBusy(false); };
  const handleDelete = async () => {
    if (!window.confirm(`Permanently delete "${post.title}"? This cannot be undone.`)) return;
    setBusy(true);
    await onDelete(post.id);
    setBusy(false);
  };

  return (
    <div className={`rounded-xl border p-4 ${post.archived ? "border-border/30 bg-surface/60 opacity-75" : "border-border/50 bg-surface"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[15px] font-extrabold text-white">{post.title}</span>
            {post.archived && <Badge size="xs">archived</Badge>}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-text-faint">
            <span>created: <span className="text-text-dim">{fmt(post.created_at)}</span></span>
            {post.updated_at !== post.created_at && <span>updated: <span className="text-text-dim">{fmt(post.updated_at)}</span></span>}
            {post.archived_at && <span>archived: <span className="text-text-dim">{fmt(post.archived_at)}</span></span>}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 break-all font-mono text-[10px] text-text-faint">
            {post.author_id && <span>author {post.author_id}</span>}
            {post.archived_by && <span>archived by {post.archived_by}</span>}
          </div>
          <p className="line-clamp-2 text-[13px] leading-relaxed text-text-dim" dangerouslySetInnerHTML={{ __html: post.body }} />
        </div>
        <div className="flex gap-2 sm:shrink-0 sm:flex-col">
          {post.archived && <Button variant="success" size="xs" onClick={handleRestore} loading={busy}>Restore</Button>}
          <Button variant="danger" size="xs" onClick={handleDelete} loading={busy}>Delete</Button>
        </div>
      </div>
    </div>
  );
}

function AnnouncementsPage() {
  const { announcements, isLoading, error, fetchAnnouncements, restoreAnnouncement, deleteAnnouncement } = useAdminAnnouncements();
  const [filter, setFilter] = useState("live");

  useEffect(() => { fetchAnnouncements(); }, [fetchAnnouncements]);

  const handleRestore = async (id) => { await restoreAnnouncement(id); await fetchAnnouncements(); };
  const handleDelete = async (id) => { await deleteAnnouncement(id); await fetchAnnouncements(); };
  const filtered = announcements.filter((p) => (filter === "all" ? true : filter === "live" ? !p.archived : p.archived));

  return (
    <div>
      <PageHeader
        size="sm"
        title="Announcements"
        subtitle="Restore archived posts or delete them for good. Editing happens on /updates."
        actions={<PillTabs size="sm" aria-label="Filter" tabs={[{ value: "live", label: "Live" }, { value: "archived", label: "Archived" }, { value: "all", label: "All" }]} value={filter} onChange={setFilter} />}
      />
      {isLoading && <div className="space-y-3"><Skeleton className="h-28 rounded-xl" /><Skeleton className="h-28 rounded-xl" /></div>}
      {error && <ErrorNote>{error}</ErrorNote>}
      {!isLoading && !error && filtered.length === 0 && <EmptyState compact title="No posts in this view." />}
      <div className="space-y-3">
        {filtered.map((post) => <PostRow key={post.id} post={post} onRestore={handleRestore} onDelete={handleDelete} />)}
      </div>
    </div>
  );
}

export default AnnouncementsPage;
