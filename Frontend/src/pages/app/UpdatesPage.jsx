import { useEffect, useState } from "react";
import AppLayout from "../../layouts/AppLayout.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import RichTextEditor from "../../components/ui/RichTextEditor.jsx";
import "../../components/ui/RichTextEditor.css";
import { useAnnouncements } from "../../features/announcements/hooks/useAnnouncements.js";
import { supabase } from "../../lib/supabase.js";

const EDITOR_ROLES = new Set([3, 4]);

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function PostCard({ post, canPost, onEdit, onArchive }) {
  const [archiving, setArchiving] = useState(false);

  const handleArchive = async () => {
    setArchiving(true);
    await onArchive(post.id, true);
    setArchiving(false);
  };

  return (
    <article className="rounded-2xl border border-[#1e2240] bg-[#0e1028] overflow-hidden">
      {post.image_url && (
        <img
          src={post.image_url}
          alt=""
          className="w-full max-h-64 object-cover"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
      )}
      <div className="p-5 sm:p-6">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4a4a8a]">
            watchpapa &mdash; {formatDate(post.created_at)}
          </p>
          {canPost && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => onEdit(post)}
                className="text-[11px] font-semibold text-[#5a5a78] transition hover:text-[#8383e7]"
              >
                Edit
              </button>
              <button
                onClick={handleArchive}
                disabled={archiving}
                className="text-[11px] font-semibold text-[#5a5a78] transition hover:text-amber-400 disabled:opacity-50"
              >
                {archiving ? "…" : "Archive"}
              </button>
            </div>
          )}
        </div>
        <h2 className="mb-4 text-[20px] font-extrabold leading-snug text-white sm:text-[22px]">
          {post.title}
        </h2>
        <div
          className="prose-content text-[14px]"
          dangerouslySetInnerHTML={{ __html: post.body }}
        />
      </div>
    </article>
  );
}

function PostModal({ post, onClose, onSaved }) {
  const { createAnnouncement, updateAnnouncement } = useAnnouncements();
  const isEdit = Boolean(post);

  const [form, setForm] = useState({
    title: post?.title ?? "",
    body: post?.body ?? "",
    image_url: post?.image_url ?? "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.title.trim() || !form.body.trim()) {
      setError("Title and body are required.");
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(),
        body: form.body.trim(),
        image_url: form.image_url.trim() || null,
      };
      if (isEdit) {
        await updateAnnouncement(post.id, payload);
      } else {
        await createAnnouncement(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    }
    setIsSubmitting(false);
  };

  return (
    <div
      className="fixed inset-0 z-[9500] flex flex-col bg-[#111320]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-modal-title"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-[#1a1f3a] bg-[#0d0f1e] px-4 py-3 sm:px-6 sm:py-4">
        <h2 id="post-modal-title" className="text-lg font-extrabold text-white sm:text-xl">
          {isEdit ? "Edit post" : "New post"}
        </h2>
        <button type="button" onClick={onClose} className="text-[#5a5a78] transition hover:text-white" aria-label="Close">
          ✕
        </button>
      </div>

      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
          <label className="flex shrink-0 flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5a5a78]">Title *</span>
            <input
              autoFocus
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="What's new?"
              className="rounded-lg border border-[#2a3570] bg-[#12163a] px-3 py-2 text-sm text-white placeholder-[#4a4a8a] outline-none focus:border-[#6868b8]"
            />
          </label>

          <div className="flex min-h-0 flex-1 flex-col gap-1">
            <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-[#5a5a78]">Body *</span>
            <RichTextEditor
              fill
              value={form.body}
              onChange={(v) => set("body", v)}
              placeholder="Describe the update…"
            />
          </div>

          <label className="flex shrink-0 flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5a5a78]">
              Image URL <span className="normal-case text-[#3a3a58]">(optional)</span>
            </span>
            <input
              value={form.image_url}
              onChange={(e) => set("image_url", e.target.value)}
              placeholder="https://..."
              type="url"
              className="rounded-lg border border-[#2a3570] bg-[#12163a] px-3 py-2 text-sm text-white placeholder-[#4a4a8a] outline-none focus:border-[#6868b8]"
            />
          </label>

          {error && <p className="shrink-0 text-[13px] font-semibold text-pink-300">{error}</p>}
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-[#1a1f3a] bg-[#0d0f1e] px-4 py-3 sm:px-6 sm:py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-[#8080a8] transition hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl border border-[#6f6fdc] bg-gradient-to-b from-[rgba(12,16,66,0.5)] to-[rgba(20,27,95,0.5)] px-5 py-2 text-sm font-extrabold text-[#8383e7] transition hover:text-[#a0a0f7] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Saving..." : isEdit ? "Save changes" : "Publish"}
            </button>
        </div>
      </form>
    </div>
  );
}

function UpdatesPage({ session }) {
  const { announcements, isLoading, error, fetchAnnouncements, archiveAnnouncement } = useAnnouncements();
  const [canPost, setCanPost] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => { fetchAnnouncements(); }, [fetchAnnouncements]);

  useEffect(() => {
    if (!session?.user?.id) return;
    supabase
      .from("profile")
      .select("role")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => { if (data && EDITOR_ROLES.has(data.role)) setCanPost(true); });
  }, [session?.user?.id]);

  const openCreate = () => { setEditingPost(null); setShowModal(true); };
  const openEdit = (post) => { setEditingPost(post); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditingPost(null); };

  const handleArchive = async (id, archived) => {
    await archiveAnnouncement(id, archived);
    fetchAnnouncements();
  };

  return (
    <AppLayout session={session} breadcrumbs={[{ label: "Updates" }]}>
      <PageHead
        title="Updates"
        description="Latest news, features, and announcements from the watchpapa team."
        path="/updates"
      />
      <div className="mx-auto max-w-[720px]">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-extrabold text-white sm:text-[30px]">Updates</h1>
            <p className="mt-1 text-[13px] text-[#5a5a78]">News and new features from watchpapa.</p>
          </div>
          {canPost && (
            <button
              onClick={openCreate}
              className="shrink-0 rounded-xl border border-[#6f6fdc] bg-gradient-to-b from-[rgba(12,16,66,0.5)] to-[rgba(20,27,95,0.5)] px-4 py-2 text-[13px] font-extrabold text-[#8383e7] transition hover:text-[#a0a0f7]"
            >
              + New post
            </button>
          )}
        </div>

        {isLoading && <p className="text-center text-[14px] text-[#5a5a78]">Loading...</p>}
        {error && <p className="text-center text-[13px] font-semibold text-pink-300">{error}</p>}
        {!isLoading && !error && announcements.length === 0 && (
          <p className="text-center text-[14px] text-[#5a5a78]">No updates yet. Check back soon.</p>
        )}

        <div className="space-y-5">
          {announcements.map((post) => (
            <PostCard key={post.id} post={post} canPost={canPost} onEdit={openEdit} onArchive={handleArchive} />
          ))}
        </div>
      </div>

      {showModal && (
        <PostModal
          post={editingPost}
          onClose={closeModal}
          onSaved={fetchAnnouncements}
        />
      )}
    </AppLayout>
  );
}

export default UpdatesPage;
