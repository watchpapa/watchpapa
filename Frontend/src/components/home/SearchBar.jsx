import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSearch } from "../../features/search/hooks/useSearch.js";
import { tmdbImg } from "../../lib/tmdbImage.js";

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="animate-spin">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function FilmIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="14" rx="2" />
      <path d="M8 6V4M16 6V4M2 10h20" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function routeFor(item) {
  if (item.type === "movie") return `/movies/${item.tmdbId}`;
  if (item.type === "show") return `/shows/${item.tmdbId}`;
  return `/people/${item.tmdbId}`;
}

function SkeletonRows({ count = 4 }) {
  return (
    <div className="py-1">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2">
          <div className="h-[54px] w-[36px] flex-shrink-0 animate-pulse rounded-md bg-[#1e2240]" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-3/4 animate-pulse rounded bg-[#1e2240]" />
            <div className="h-4 w-10 animate-pulse rounded-full bg-[#1e2240]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function GroupLabel({ label }) {
  return (
    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#4a4a7a]">
      {label}
    </div>
  );
}

function ResultRow({ item, isActive, onSelect }) {
  const imgSrc = tmdbImg(item.posterPath, "w92");

  return (
    <div
      role="option"
      aria-selected={isActive}
      onMouseDown={(e) => {
        e.preventDefault();
        onSelect(item);
      }}
      className={`flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors ${
        isActive ? "bg-[#1e2240]" : "hover:bg-[#181c35]"
      }`}
    >
      <div className="h-[54px] w-[36px] flex-shrink-0 overflow-hidden rounded-md bg-[#12163a]">
        {imgSrc ? (
          <img src={imgSrc} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#3a3a7a]">
            {item.type === "person" ? <PersonIcon /> : <FilmIcon />}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white leading-tight">{item.title}</p>
        {item.year && (
          <span className="mt-1 inline-block rounded-full bg-[#1a1d35] px-2 py-0.5 text-[10px] font-medium text-[#8888c8]">
            {item.year}
          </span>
        )}
      </div>

      <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-widest text-[#4a4a7a]">
        {item.type === "show" ? "TV" : item.type}
      </span>
    </div>
  );
}

function SearchBar({ value, onChange, autoFocus = false, maxWidthClass = "max-w-[560px]", dense = false, showDropdown = true }) {
  const navigate = useNavigate();
  const { results, isLoading, status } = useSearch(value);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  // Gates the dropdown behind an actual user action (typing or focusing the
  // field) rather than just "there happens to be a valid query + results".
  // Without this, a page that mounts SearchBar with a query already in its
  // value (SearchPage, reading ?q= from the URL) would pop the suggestions
  // dropdown open immediately on load/navigation, on top of the full results
  // already shown below it.
  const [hasInteracted, setHasInteracted] = useState(false);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  const trimmed = (value ?? "").trim();
  const searchPath = `/search?q=${encodeURIComponent(trimmed)}`;

  useEffect(() => {
    // On the /search page itself the full results grid is already right below
    // the field, so the typeahead dropdown would just duplicate it — that
    // instance passes showDropdown={false} to suppress it entirely.
    const shouldOpen = showDropdown && hasInteracted && trimmed.length >= 2 && status !== "idle";
    setIsOpen(shouldOpen);
    setActiveIndex(-1);
  }, [trimmed, status, hasInteracted, showDropdown]);

  useEffect(() => {
    function onPointerDown(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isOpen]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Worker already returns TMDB's own relevance order (via /search/multi) —
  // no client-side re-sort here. Cap the preview list; the full, uncapped set
  // lives on /search.
  const flatResults = results.slice(0, 8);

  // total navigable slots: flatResults + 1 for "Explore more"
  const totalSlots = flatResults.length + 1;
  const exploreSlot = flatResults.length; // last slot index

  function goToSearchPage() {
    setIsOpen(false);
    navigate(searchPath);
  }

  function handleSelect(item) {
    setIsOpen(false);
    navigate(routeFor(item));
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!isOpen || trimmed.length < 2) return;
      if (activeIndex >= 0 && activeIndex < flatResults.length) {
        const item = flatResults[activeIndex];
        if (item) handleSelect(item);
      } else {
        // no item selected, or "Explore more" is selected
        goToSearchPage();
      }
      return;
    }

    if (!isOpen) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, totalSlots - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    }
  }

  return (
    <div ref={wrapperRef} className={`relative mx-auto w-full ${maxWidthClass}`}>
      <span className={`pointer-events-none absolute inset-y-0 flex items-center text-[#5a5a9a] ${dense ? "left-3" : "left-4"}`}>
        <SearchIcon />
      </span>

      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => {
          setHasInteracted(true);
          onChange(e);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          setHasInteracted(true);
          if (trimmed.length >= 2 && status !== "idle") setIsOpen(true);
        }}
        autoFocus={autoFocus}
        placeholder="Search movies, shows, people…"
        autoComplete="off"
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
        className={`w-full border border-[#2a3570] bg-[#141728]/90 text-sm text-white placeholder-[#5a5a9a] shadow-[0_8px_24px_-14px_rgba(0,0,0,0.8)] outline-none transition focus:border-[#6f6fdc] focus:bg-[#161a32] focus:ring-2 focus:ring-[#6f6fdc]/50 ${
          dense ? "rounded-xl py-1.5 pl-9 pr-8 text-[13px]" : "rounded-2xl py-3.5 pl-11 pr-10"
        }`}
      />

      {isLoading && (
        <span className={`pointer-events-none absolute inset-y-0 flex items-center text-[#5a5a9a] ${dense ? "right-3" : "right-4"}`}>
          <SpinnerIcon />
        </span>
      )}

      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-[480px] overflow-y-auto rounded-2xl border border-[#2a3570] bg-[#141728] shadow-2xl"
        >
          {status === "loading" && results.length === 0 ? (
            <SkeletonRows count={4} />
          ) : status !== "loading" && results.length === 0 ? (
            <p className="px-4 py-4 text-center text-sm text-[#4a4a7a]">
              No results for &ldquo;{trimmed}&rdquo;
            </p>
          ) : (
            <div>
              {flatResults.map((item, i) => (
                <ResultRow
                  key={`${item.type}-${item.tmdbId}`}
                  item={item}
                  isActive={i === activeIndex}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          )}

          {/* Explore more — always last */}
          <div className="mx-3 border-t border-[#1e2240]" />
          <div
            role="option"
            aria-selected={activeIndex === exploreSlot}
            onMouseDown={(e) => {
              e.preventDefault();
              goToSearchPage();
            }}
            className={`flex cursor-pointer items-center gap-2 px-3 py-3 text-sm font-semibold transition-colors ${
              activeIndex === exploreSlot
                ? "bg-[#1e2240] text-white"
                : "text-[#8888c8] hover:bg-[#181c35] hover:text-white"
            }`}
          >
            <SearchIcon />
            <span>Explore all results for &ldquo;{trimmed}&rdquo;</span>
            <ArrowRightIcon />
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchBar;
