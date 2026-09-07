import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import UpgradePromptToast from "../../components/subscription/UpgradePromptToast.jsx";
import AddToWatchlistButton from "../../components/watchlist/AddToWatchlistButton.jsx";
import { OverLimitBanner } from "../../components/ui/OverLimitBanner.jsx";
import PageContainer from "../../components/ui/PageContainer.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import PillTabs from "../../components/ui/PillTabs.jsx";
import Button from "../../components/ui/Button.jsx";
import IconButton from "../../components/ui/IconButton.jsx";
import Input from "../../components/ui/Input.jsx";
import Select from "../../components/ui/Select.jsx";
import Modal from "../../components/ui/Modal.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import PosterGrid from "../../components/home/PosterGrid.jsx";
import { SkeletonPosterGrid } from "../../components/ui/Skeleton.jsx";
import { useWatchlists } from "../../features/watchlist/hooks/useWatchlists.js";
import { useWatchlistItems } from "../../features/watchlist/hooks/useWatchlistItems.js";
import { useOverageStatus } from "../../features/follows/hooks/useOverageStatus.js";
import { tmdbImg } from "../../lib/tmdbImage.js";
import { BookmarkIcon, EditIcon, EyeIcon, FilmIcon, PlusIcon, TrashIcon, TvIcon, XIcon } from "../../components/icons/index.jsx";

const SORT_OPTIONS = [
  { value: "added", label: "Date added" },
  { value: "rating", label: "Rating" },
];

function getTmdbVoteAvg(item) {
  const media = item.media_type === "movie" ? item.movie : item.show;
  return media?.tmdb_vote_avg ?? null;
}

function ItemGridCard({ item, onRemove, onMarkWatched, session, onMembershipChange }) {
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const media = item.media_type === "movie" ? item.movie : item.show;
  const title = media?.title ?? media?.name ?? "Unknown";
  const year = media?.release_date ?? media?.first_air_date;
  const displayYear = year ? new Date(year).getFullYear() : null;
  const posterSrc = media?.poster_path ? tmdbImg(media.poster_path, "w300") : null;
  const tmdbVote = media?.tmdb_vote_avg;
  const detailPath = item.media_type === "movie" ? `/movies/${item.tmdb_id}` : `/shows/${item.tmdb_id}`;

  return (
    <article className="group flex w-full min-w-0 flex-col gap-2">
      <div className="relative">
        <Link to={detailPath} className="relative block aspect-[2/3] overflow-hidden rounded-2xl border border-border bg-surface-4 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.7)] transition duration-300 hover:-translate-y-1 hover:border-brand">
          {posterSrc ? (
            <img src={posterSrc} alt={title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-[#181d40] to-[#0e1128] px-3 text-border-strong">
              {item.media_type === "movie" ? <FilmIcon size={18} /> : <TvIcon size={18} />}
              <span className="line-clamp-3 text-center text-[11px] font-medium leading-tight">{title}</span>
            </div>
          )}
          <span className={`absolute left-2 top-2 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${item.media_type === "movie" ? "bg-[#1a2050]/90 text-[#6090e0]" : "bg-[#1a3020]/90 text-[#60b070]"}`}>{item.media_type}</span>
          {tmdbVote != null && tmdbVote > 0 && (
            <span className="absolute bottom-2 left-2 rounded-full bg-bg/90 px-2 py-0.5 text-[10px] font-bold text-[#e8c04a]">★ {Number(tmdbVote).toFixed(1)}</span>
          )}
        </Link>

        {!confirmingRemove ? (
          <IconButton label="Remove from watchlist" size="sm" onClick={() => setConfirmingRemove(true)} className="absolute right-1.5 top-1.5 h-8 w-8 bg-bg/85 text-text-dim hover:bg-red-950/90 hover:text-red-300 touch:opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100">
            <TrashIcon size={14} />
          </IconButton>
        ) : (
          <div className="absolute inset-x-1.5 top-1.5 flex justify-center gap-1.5">
            <Button variant="danger" size="xs" onClick={() => onRemove(item.id)}>Remove</Button>
            <Button variant="secondary" size="xs" onClick={() => setConfirmingRemove(false)}>Cancel</Button>
          </div>
        )}
      </div>

      <div className="min-w-0 px-0.5">
        <Link to={detailPath} className="block truncate text-center text-xs font-semibold leading-tight text-white transition hover:text-[#a090ff]">{title}</Link>
        {displayYear && <p className="mt-0.5 text-center text-[10px] text-text-faint">{displayYear}</p>}
      </div>

      <div className="flex items-center justify-center gap-1">
        <Button variant="ghost" size="xs" icon={EyeIcon} onClick={() => onMarkWatched(item.id)} className="text-text-dim">Watched</Button>
        <AddToWatchlistButton mediaType={item.media_type} entityId={item.tmdb_id} session={session} onMembershipChange={onMembershipChange} compact />
      </div>
    </article>
  );
}

function InlineRename({ initialName, onSave, onCancel }) {
  const [value, setValue] = useState(initialName);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (value.trim()) onSave(value.trim()); }} className="flex w-full items-center gap-2 sm:max-w-md">
      <Input ref={inputRef} size="md" value={value} onChange={(e) => setValue(e.target.value)} maxLength={60} aria-label="Watchlist name" />
      <Button type="submit" size="md">Save</Button>
      <IconButton label="Cancel rename" size="md" onClick={onCancel}><XIcon size={16} /></IconButton>
    </form>
  );
}

function WatchlistsPage({ session }) {
  const { watchlists, isLoading: listsLoading, limitError, clearLimitError, createWatchlist, renameWatchlist, deleteWatchlist } = useWatchlists(session);
  const { status: overageStatus, isOverWatchlistLimit } = useOverageStatus(session);

  const [selectedId, setSelectedId] = useState(null);
  const [sortBy, setSortBy] = useState("added");
  const [renaming, setRenaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [itemsRefreshKey, setItemsRefreshKey] = useState(0);
  const handleMembershipChange = useCallback(() => setItemsRefreshKey((k) => k + 1), []);

  useEffect(() => {
    const bump = () => setItemsRefreshKey((k) => k + 1);
    window.addEventListener("watchpapa:watchlist-item-removed", bump);
    return () => window.removeEventListener("watchpapa:watchlist-item-removed", bump);
  }, []);

  // Auto-select the first list once loaded; fall over to the next one if the
  // active list is deleted. (Derived during render, no effects.)
  const [autoPicked, setAutoPicked] = useState(false);
  if (!listsLoading && watchlists.length > 0 && selectedId === null && !autoPicked) {
    setAutoPicked(true);
    setSelectedId(watchlists[0].id);
  }
  if (selectedId !== null && !listsLoading && !watchlists.find((w) => w.id === selectedId)) {
    setSelectedId(watchlists[0]?.id ?? null);
  }

  const activeList = watchlists.find((w) => w.id === selectedId) ?? null;
  const { items, isLoading: itemsLoading, removeItem, markWatched } = useWatchlistItems(selectedId, session, itemsRefreshKey);

  const sortedItems = useMemo(() => {
    const list = [...items];
    if (sortBy === "rating") {
      list.sort((a, b) => {
        const ra = getTmdbVoteAvg(a) ?? -1;
        const rb = getTmdbVoteAvg(b) ?? -1;
        return rb !== ra ? rb - ra : new Date(b.added_at) - new Date(a.added_at);
      });
    } else {
      list.sort((a, b) => new Date(b.added_at) - new Date(a.added_at));
    }
    return list;
  }, [items, sortBy]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim() || creating) return;
    setCreating(true);
    const { data, error } = await createWatchlist(newName.trim());
    setCreating(false);
    if (!error && data) { setNewName(""); setShowNewForm(false); setSelectedId(data.id); }
  };
  const handleRename = async (name) => { await renameWatchlist(selectedId, name); setRenaming(false); };
  const handleDelete = async () => { await deleteWatchlist(selectedId); setConfirmingDelete(false); setRenaming(false); };
  const handleTabSelect = (id) => { setSelectedId(id); setSortBy("added"); setRenaming(false); setConfirmingDelete(false); };

  return (
    <AppLayout session={session}>
      <PageHead title="My Watchlists" description="Manage your personal watchlists on watchpapa." path="/watchlists" noindex />
      {limitError && <UpgradePromptToast message={limitError} onDismiss={clearLimitError} session={session} />}

      <PageContainer width="wide">
        <PageHeader
          title="My Watchlists"
          subtitle="Titles you plan to watch. Rating or logging a watch takes them off the list."
          actions={!showNewForm && <Button variant="secondary" size="sm" icon={PlusIcon} onClick={() => setShowNewForm(true)}>New list</Button>}
        />

        {isOverWatchlistLimit && overageStatus && (
          <OverLimitBanner type="watchlists" current={overageStatus.watchlist_count} limit={overageStatus.watchlist_limit} tier={overageStatus.tier} />
        )}

        {showNewForm && (
          <form onSubmit={handleCreate} className="mb-4 flex gap-2 rounded-2xl border border-border/50 bg-surface p-3">
            <Input size="md" autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Watchlist name…" maxLength={60} className="min-w-0 flex-1" aria-label="New watchlist name" />
            <Button type="submit" size="md" loading={creating} disabled={!newName.trim()}>Create</Button>
            <IconButton label="Cancel" size="md" onClick={() => { setShowNewForm(false); setNewName(""); }}><XIcon size={16} /></IconButton>
          </form>
        )}

        {!listsLoading && watchlists.length > 0 && (
          <PillTabs
            aria-label="Watchlists"
            className="mb-5"
            tabs={watchlists.map((w) => ({ value: w.id, label: w.name }))}
            value={selectedId}
            onChange={handleTabSelect}
          />
        )}

        {!listsLoading && watchlists.length === 0 && !showNewForm && (
          <EmptyState
            icon={BookmarkIcon}
            title="No watchlists yet"
            description="Create one and add titles from any movie or show page."
            action={<Button icon={PlusIcon} onClick={() => setShowNewForm(true)}>Create your first watchlist</Button>}
            className="rounded-2xl border border-border/50 bg-surface"
          />
        )}

        {activeList && (
          <>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {renaming ? (
                <InlineRename initialName={activeList.name} onSave={handleRename} onCancel={() => setRenaming(false)} />
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm text-text-dim">{items.length} item{items.length !== 1 ? "s" : ""}</p>
                    <label className="flex items-center gap-2 text-sm text-text-dim">
                      <span className="whitespace-nowrap">Sort by</span>
                      <Select size="sm" value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} />
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" icon={EditIcon} onClick={() => setRenaming(true)}>Rename</Button>
                    <Button variant="danger" size="sm" icon={TrashIcon} onClick={() => setConfirmingDelete(true)}>Delete</Button>
                  </div>
                </>
              )}
            </div>

            {itemsLoading ? (
              <SkeletonPosterGrid count={8} />
            ) : items.length === 0 ? (
              <EmptyState
                compact
                title="This list is empty"
                description="Add movies or shows from their detail pages."
                action={<Button to="/movies" variant="secondary" size="sm">Browse movies</Button>}
                className="rounded-2xl border border-border/50 bg-surface"
              />
            ) : (
              <PosterGrid>
                {sortedItems.map((item) => (
                  <ItemGridCard key={item.id} item={item} onRemove={removeItem} onMarkWatched={markWatched} session={session} onMembershipChange={handleMembershipChange} />
                ))}
              </PosterGrid>
            )}
          </>
        )}
      </PageContainer>

      <Modal
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title="Delete this watchlist?"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={handleDelete}>Delete</Button>
          </div>
        }
      >
        <p className="text-sm text-text">“{activeList?.name}” and its {items.length} item{items.length !== 1 ? "s" : ""} will be removed. Ratings and watch history are not affected.</p>
      </Modal>
    </AppLayout>
  );
}

export default WatchlistsPage;
