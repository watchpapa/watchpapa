import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api.js";
import { tmdbImg } from "../../lib/tmdbImage.js";
import Modal from "./Modal.jsx";
import Input from "./Input.jsx";
import EmptyState from "./EmptyState.jsx";
import { FilmIcon, SearchIcon } from "../icons/index.jsx";

// Debounced movie/show search picker. Used by FavouritesEditor (movies and
// shows) and AvatarPicker. onSelect receives { id, mediaType, title, year,
// poster_path }; `mediaTypes` restricts which result types are kept.
function MediaSearchModal({ onSelect, onClose, title = "Search movies or shows…", mediaTypes = ["movie", "show"] }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const active = query.trim().length >= 2;
  const visible = active ? results : [];

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    const t = setTimeout(() => {
      setSearching(true);
      apiFetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
        .then((d) => {
          if (cancelled) return;
          setSearching(false);
          setResults((d.results ?? []).filter((r) => mediaTypes.includes(r.type)).slice(0, 10).map((r) => ({ id: r.tmdbId, mediaType: r.type, title: r.title, year: r.year, poster_path: r.posterPath })));
        })
        .catch(() => { if (!cancelled) setSearching(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, active, mediaTypes]);

  return (
    <Modal open onClose={onClose} title="Pick a title" size="md">
      <div className="relative">
        <SearchIcon size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-faint" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={title} className="pl-11" autoFocus data-autofocus aria-label="Search" />
      </div>
      <div className="mt-3 max-h-[55svh] overflow-y-auto">
        {active && searching && <p className="px-3 py-3 text-xs text-text-faint">Searching…</p>}
        {active && !searching && visible.length === 0 && <EmptyState compact title="No results" />}
        {!active && <p className="px-3 py-3 text-xs text-text-faint">Type at least 2 characters.</p>}
        {visible.map((item) => (
          <button key={`${item.mediaType}-${item.id}`} type="button" onClick={() => onSelect(item)} className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-surface-2">
            <div className="h-12 w-8 shrink-0 overflow-hidden rounded border border-border bg-surface">
              {item.poster_path ? <img src={tmdbImg(item.poster_path, "w185")} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-border-strong"><FilmIcon size={12} /></div>}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm text-white">{item.title}</p>
              <p className="text-xs text-text-dim">{item.mediaType === "movie" ? "Movie" : "Show"}{item.year ? ` · ${item.year}` : ""}</p>
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
}

export default MediaSearchModal;
