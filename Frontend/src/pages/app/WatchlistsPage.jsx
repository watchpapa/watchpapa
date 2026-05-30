import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import UpgradePromptToast from "../../components/subscription/UpgradePromptToast.jsx";
import AddToWatchlistButton from "../../components/watchlist/AddToWatchlistButton.jsx";
import { OverLimitBanner } from "../../components/ui/OverLimitBanner.jsx";
import { useWatchlists } from "../../features/watchlist/hooks/useWatchlists.js";
import { useWatchlistItems } from "../../features/watchlist/hooks/useWatchlistItems.js";
import { useOverageStatus } from "../../features/follows/hooks/useOverageStatus.js";

const TMDB_IMG = "https://image.tmdb.org/t/p/w185";
const FILTERS = ["All", "Unwatched", "Watched"];

// ── Icons ────────────────────────────────────────────────────────────────────

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function FilmIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2" />
      <path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 7h5M17 17h5" />
    </svg>
  );
}

function TvIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="15" rx="2" />
      <polyline points="17 2 12 7 7 2" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

// ── Item card ─────────────────────────────────────────────────────────────────

function ItemCard({ item, onRemove, onToggleWatched, session, onMembershipChange }) {
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const media = item.media_type === "movie" ? item.movie : item.show;
  const title = media?.title ?? media?.name ?? "Unknown";
  const year = media?.release_date ?? media?.first_air_date;
  const displayYear = year ? new Date(year).getFullYear() : null;
  const posterSrc = media?.poster_path ? `${TMDB_IMG}${media.poster_path}` : null;
  const detailPath = item.media_type === "movie"
    ? `/movies/${item.movie_id}`
    : `/shows/${item.show_id}`;

  return (
    <div className={`group flex gap-3 rounded-2xl border p-3 transition ${
      item.watched
        ? "border-[#1a2a1a] bg-[#0a0f0a]"
        : "border-[#1a1f3a] bg-[#0d0f1e] hover:border-[#2a2f5a]"
    }`}>
      <Link to={detailPath} className="flex-shrink-0">
        <div className="h-20 w-14 overflow-hidden rounded-xl border border-[#2a3570] bg-[#12163a]">
          {posterSrc ? (
            <img src={posterSrc} alt={title} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[#3a3a7a]">
              {item.media_type === "movie" ? <FilmIcon /> : <TvIcon />}
            </div>
          )}
        </div>
      </Link>

      <div className="min-w-0 flex-1">
        <Link to={detailPath}>
          <p className={`truncate text-sm font-bold transition hover:text-[#a090ff] ${
            item.watched ? "text-[#6060a0] line-through" : "text-white"
          }`}>
            {title}
          </p>
        </Link>
        <div className="mt-0.5 flex items-center gap-2">
          {displayYear && <span className="text-xs text-[#5050a0]">{displayYear}</span>}
          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            item.media_type === "movie"
              ? "bg-[#1a2050] text-[#6090e0]"
              : "bg-[#1a3020] text-[#60b070]"
          }`}>
            {item.media_type === "movie" ? <FilmIcon /> : <TvIcon />}
            {item.media_type}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => onToggleWatched(item.id, item.watched)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
              item.watched
                ? "border-green-700/50 bg-green-900/30 text-green-400 hover:border-red-600/50 hover:bg-red-900/20 hover:text-red-300"
                : "border-[#2a2d4a] bg-[#141728] text-[#6060a0] hover:border-green-700/50 hover:text-green-300"
            }`}
          >
            {item.watched ? <><CheckIcon /> Watched</> : "Mark watched"}
          </button>

          <AddToWatchlistButton
            mediaType={item.media_type}
            entityId={item.media_type === "movie" ? item.movie_id : item.show_id}
            session={session}
            onMembershipChange={onMembershipChange}
            compact
          />

          {confirmingRemove ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-red-400">Remove?</span>
              <button onClick={() => onRemove(item.id)} className="rounded-lg bg-red-900/40 px-2 py-0.5 text-xs font-bold text-red-400 hover:bg-red-900/60">Yes</button>
              <button onClick={() => setConfirmingRemove(false)} className="text-xs text-[#5050a0] hover:text-white">No</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingRemove(true)}
              className="rounded-full p-1.5 text-[#3a3a6a] opacity-0 transition hover:bg-red-900/30 hover:text-red-400 group-hover:opacity-100"
              aria-label="Remove from watchlist"
            >
              <TrashIcon />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Inline rename ─────────────────────────────────────────────────────────────

function InlineRename({ initialName, onSave, onCancel }) {
  const [value, setValue] = useState(initialName);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (value.trim()) onSave(value.trim()); }}
      className="flex items-center gap-2"
    >
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={60}
        className="rounded-xl border border-[#5050a8] bg-[#141728] px-3 py-1 text-sm font-bold text-white outline-none focus:border-[#7070c8]"
      />
      <button type="submit" className="rounded-lg bg-[#3030a0] px-3 py-1 text-xs font-bold text-white hover:bg-[#4040b8]">Save</button>
      <button type="button" onClick={onCancel} className="text-xs text-[#5050a0] hover:text-white">Cancel</button>
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function WatchlistsPage({ session }) {
  const {
    watchlists,
    isLoading: listsLoading,
    limitError,
    clearLimitError,
    createWatchlist,
    renameWatchlist,
    deleteWatchlist,
  } = useWatchlists(session);

  const { status: overageStatus, isOverWatchlistLimit } = useOverageStatus(session);

  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState("All");
  const [renaming, setRenaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [itemsRefreshKey, setItemsRefreshKey] = useState(0);
  const handleMembershipChange = useCallback(() => setItemsRefreshKey((k) => k + 1), []);

  // Auto-select first list once loaded.
  useEffect(() => {
    if (!listsLoading && watchlists.length > 0 && selectedId === null) {
      setSelectedId(watchlists[0].id);
    }
  }, [listsLoading, watchlists, selectedId]);

  // When the active list is deleted, select the next available one.
  useEffect(() => {
    if (selectedId !== null && !watchlists.find((w) => w.id === selectedId)) {
      setSelectedId(watchlists[0]?.id ?? null);
    }
  }, [watchlists, selectedId]);

  const activeList = watchlists.find((w) => w.id === selectedId) ?? null;
  const { items, isLoading: itemsLoading, removeItem, toggleWatched } = useWatchlistItems(selectedId, session, itemsRefreshKey);

  const filteredItems = items.filter((item) => {
    if (filter === "Watched") return item.watched;
    if (filter === "Unwatched") return !item.watched;
    return true;
  });

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim() || creating) return;
    setCreating(true);
    const { data, error } = await createWatchlist(newName.trim());
    setCreating(false);
    if (!error && data) {
      setNewName("");
      setShowNewForm(false);
      setSelectedId(data.id);
    }
  };

  const handleRename = async (name) => {
    await renameWatchlist(selectedId, name);
    setRenaming(false);
  };

  const handleDelete = async () => {
    await deleteWatchlist(selectedId);
    setConfirmingDelete(false);
    setRenaming(false);
  };

  const handleTabSelect = (id) => {
    setSelectedId(id);
    setFilter("All");
    setRenaming(false);
    setConfirmingDelete(false);
  };

  return (
    <AppLayout session={session}>
      <PageHead
        title="My Watchlists"
        description="Manage your personal watchlists on watchpapa."
        path="/watchlists"
      />

      {limitError && (
        <UpgradePromptToast message={limitError} onDismiss={clearLimitError} session={session} />
      )}

      <div className="mx-auto max-w-4xl">
        <h1 className="mb-5 text-xl font-extrabold text-[#a090ff] sm:text-2xl">My Watchlists</h1>

        {isOverWatchlistLimit && overageStatus && (
          <OverLimitBanner
            type="watchlists"
            current={overageStatus.watchlist_count}
            limit={overageStatus.watchlist_limit}
            tier={overageStatus.tier}
          />
        )}

        {/* Tab bar */}
        <div className="mb-5 flex items-center gap-1 overflow-x-auto rounded-2xl border border-[#1a1f3a] bg-[#0a0c18] p-1.5">
          {listsLoading ? (
            <div className="flex gap-1">
              {[1, 2].map((i) => (
                <div key={i} className="h-8 w-24 animate-pulse rounded-xl bg-[#1a1d35]" />
              ))}
            </div>
          ) : (
            watchlists.map((list) => (
              <button
                key={list.id}
                onClick={() => handleTabSelect(list.id)}
                className={`flex-shrink-0 rounded-xl px-4 py-1.5 text-sm font-semibold transition ${
                  list.id === selectedId
                    ? "bg-[#1a1d35] text-white shadow-sm"
                    : "text-[#5050a0] hover:text-[#8080c0]"
                }`}
              >
                {list.name}
              </button>
            ))
          )}

          {/* New list button */}
          {!showNewForm && (
            <button
              onClick={() => setShowNewForm(true)}
              className="ml-auto flex flex-shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-[#4040a0] transition hover:bg-[#141728] hover:text-[#8080c0]"
            >
              <PlusIcon />
              New
            </button>
          )}
        </div>

        {/* Inline new list form */}
        {showNewForm && (
          <form
            onSubmit={handleCreate}
            className="mb-4 flex gap-2 rounded-2xl border border-[#2a2d4a] bg-[#0d0f1e] p-3"
          >
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Watchlist name…"
              maxLength={60}
              className="min-w-0 flex-1 rounded-xl border border-[#2a2d4a] bg-[#141728] px-3 py-1.5 text-sm text-white placeholder-[#4040a0] outline-none focus:border-[#5050a8]"
            />
            <button
              type="submit"
              disabled={!newName.trim() || creating}
              className="rounded-xl bg-[#3030a0] px-4 py-1.5 text-sm font-bold text-white transition hover:bg-[#4040b8] disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => { setShowNewForm(false); setNewName(""); }}
              className="rounded-xl border border-[#2a2d4a] px-3 py-1.5 text-sm text-[#6060b0] transition hover:border-[#4040a0] hover:text-white"
            >
              Cancel
            </button>
          </form>
        )}

        {/* Empty state — no lists at all */}
        {!listsLoading && watchlists.length === 0 && !showNewForm && (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-[#1a1f3a] bg-[#0d0f1e] py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#2a2d4a] bg-[#141728] text-[#5050a0]">
              <BookmarkIcon />
            </div>
            <p className="text-[#5050a0]">No watchlists yet.</p>
            <button
              onClick={() => setShowNewForm(true)}
              className="flex items-center gap-2 rounded-full border border-[#3a3a7a] bg-[#1a1d35] px-4 py-2 text-sm font-bold text-[#8888c8] transition hover:border-[#6060b0] hover:text-white"
            >
              <PlusIcon />
              Create your first watchlist
            </button>
          </div>
        )}

        {/* Active list panel */}
        {activeList && (
          <>
            {/* List header: name + actions */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              {renaming ? (
                <InlineRename
                  initialName={activeList.name}
                  onSave={handleRename}
                  onCancel={() => setRenaming(false)}
                />
              ) : (
                <>
                  <p className="text-sm text-[#5050a0]">
                    {items.length} item{items.length !== 1 ? "s" : ""} · {items.filter((i) => i.watched).length} watched
                  </p>
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      onClick={() => setRenaming(true)}
                      className="flex items-center gap-1.5 rounded-lg border border-[#2a2d4a] px-3 py-1.5 text-xs text-[#6060a0] transition hover:border-[#4040a0] hover:text-white"
                    >
                      <PencilIcon />
                      Rename
                    </button>

                    {confirmingDelete ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-400">Delete list?</span>
                        <button onClick={handleDelete} className="rounded-lg bg-red-900/40 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-900/60">Yes</button>
                        <button onClick={() => setConfirmingDelete(false)} className="text-xs text-[#5050a0] hover:text-white">No</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmingDelete(true)}
                        className="flex items-center gap-1.5 rounded-lg border border-[#3a1a1a] px-3 py-1.5 text-xs text-red-500/60 transition hover:border-red-700/60 hover:text-red-400"
                      >
                        <TrashIcon />
                        Delete
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Filter tabs */}
            <div className="mb-4 flex gap-1 rounded-2xl border border-[#1a1f3a] bg-[#0a0c18] p-1">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`flex-1 rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
                    filter === f ? "bg-[#1a1d35] text-white" : "text-[#5050a0] hover:text-[#8080c0]"
                  }`}
                >
                  {f}
                  {f !== "All" && items.length > 0 && (
                    <span className="ml-1.5 text-xs text-[#3a3a7a]">
                      ({f === "Watched" ? items.filter((i) => i.watched).length : items.filter((i) => !i.watched).length})
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Items */}
            {itemsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-28 animate-pulse rounded-2xl border border-[#1a1f3a] bg-[#0d0f1e]" />
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#1a1f3a] bg-[#0d0f1e] py-12 text-center">
                <p className="text-sm text-[#4040a0]">
                  {filter === "All"
                    ? "This list is empty. Add movies or shows from their detail pages."
                    : `No ${filter.toLowerCase()} items.`}
                </p>
                {filter === "All" && (
                  <Link to="/movies" className="text-sm font-semibold text-[#6060b0] transition hover:text-[#a0a0e8]">
                    Browse movies →
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredItems.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onRemove={removeItem}
                    onToggleWatched={toggleWatched}
                    session={session}
                    onMembershipChange={handleMembershipChange}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}

export default WatchlistsPage;
