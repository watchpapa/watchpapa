import { useEffect, useState } from "react";
import { useAdminAnnouncements } from "../../features/admin/hooks/useAdminAnnouncements.js";

function fmt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function UuidField({ label, value }) {
  if (!value) return null;
  return (
    <span className="text-[#4a4a8a]">
      {label}: <span className="font-mono text-[#5a5a78]">{value}</span>
    </span>
  );
}

function PostRow({ post, onRestore, onDelete }) {
  const [busy, setBusy] = useState(false);

  const handleRestore = async () => {
    setBusy(true);
    await onRestore(post.id);
    setBusy(false);
  };

  const handleDelete = async () => {
    if (!window.confirm(`Permanently delete "${post.title}"? This cannot be undone.`)) return;
    setBusy(true);
    await onDelete(post.id);
    setBusy(false);
  };

  return (
    <div className={`rounded-xl border p-4 ${post.archived ? "border-[#1a1a2e] bg-[#0a0b18] opacity-70" : "border-[#1e2240] bg-[#0e1028]"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-extrabold text-white truncate">{post.title}</span>
            {post.archived && (
              <span className="rounded-full border border-[#2a2a4a] bg-[#12123a] px-2 py-0.5 text-[10px] font-semibold text-[#5a5a78]">
                archived
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px]">
            <span className="text-[#4a4a8a]">created: <span className="text-[#5a5a78]">{fmt(post.created_at)}</span></span>
            {post.updated_at !== post.created_at && (
              <span className="text-[#4a4a8a]">updated: <span className="text-[#5a5a78]">{fmt(post.updated_at)}</span></span>
            )}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px]">
            <UuidField label="author" value={post.author_id} />
            {post.archived_by && <UuidField label="archived by" value={post.archived_by} />}
            {post.archived_at && (
              <span className="text-[#4a4a8a]">archived at: <span className="text-[#5a5a78]">{fmt(post.archived_at)}</span></span>
            )}
          </div>

          {post.image_url && (
            <p className="truncate text-[11px] text-[#3a3a58]">{post.image_url}</p>
          )}
          <p className="line-clamp-2 text-[13px] leading-relaxed text-[#7070a0]"
            dangerouslySetInnerHTML={{ __html: post.body }}
          />
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          {post.archived && (
            <button
              onClick={handleRestore}
              disabled={busy}
              className="rounded-lg border border-emerald-700/50 px-3 py-1.5 text-[12px] font-semibold text-emerald-400 transition hover:bg-emerald-900/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "…" : "Restore"}
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={busy}
            className="rounded-lg border border-red-700/50 px-3 py-1.5 text-[12px] font-semibold text-red-400 transition hover:bg-red-900/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AnnouncementsPage() {
  const { announcements, isLoading, error, fetchAnnouncements, restoreAnnouncement, deleteAnnouncement } = useAdminAnnouncements();
  const [filter, setFilter] = useState("live");

  useEffect(() => { fetchAnnouncements(); }, [fetchAnnouncements]);

  const handleRestore = async (id) => {
    await restoreAnnouncement(id);
    await fetchAnnouncements();
  };

  const handleDelete = async (id) => {
    await deleteAnnouncement(id);
    await fetchAnnouncements();
  };

  const filtered = announcements.filter((p) =>
    filter === "all" ? true : filter === "live" ? !p.archived : p.archived
  );

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <h1 className="text-[20px] font-extrabold text-white">Announcements</h1>
        <div className="flex gap-1">
          {["live", "archived", "all"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold capitalize transition ${
                filter === f ? "bg-[#141728] text-white" : "text-[#8080a8] hover:bg-[#141728] hover:text-white"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <p className="text-sm text-[#5a5a78]">Loading...</p>}
      {error && <p className="text-sm font-semibold text-pink-300">{error}</p>}
      {!isLoading && !error && filtered.length === 0 && (
        <p className="text-sm text-[#5a5a78]">No posts in this view.</p>
      )}

      <div className="space-y-3">
        {filtered.map((post) => (
          <PostRow key={post.id} post={post} onRestore={handleRestore} onDelete={handleDelete} />
        ))}
      </div>
    </div>
  );
}

export default AnnouncementsPage;
