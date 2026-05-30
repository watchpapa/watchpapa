import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase.js";
import { useItemWatchlistStatus } from "../../features/watchlist/hooks/useItemWatchlistStatus.js";

function BookmarkIcon({ filled }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CheckIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={`flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SpinnerIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="animate-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

export default function AddToWatchlistButton({ mediaType, entityId, session, onAuthPrompt, onMembershipChange, compact = false }) {
  const [autoAdding, setAutoAdding] = useState(false);
  const [toastOpen, setToastOpen]   = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const timerRef  = useRef(null);
  const toastRef  = useRef(null);
  const buttonRef = useRef(null);

  const {
    watchlists, membershipMap, isLoading, isInAny, pendingIds,
    toggleInWatchlist, setWatchlists, setMembershipMap,
  } = useItemWatchlistStatus(mediaType, entityId, session);

  // Close toast when item is removed from every list
  const prevIsInAny = useRef(isInAny);
  useEffect(() => {
    if (prevIsInAny.current && !isInAny && toastOpen) {
      clearTimeout(timerRef.current);
      setToastOpen(false);
      setPickerOpen(false);
    }
    prevIsInAny.current = isInAny;
  }, [isInAny, toastOpen]);

  // Click-outside closes picker
  useEffect(() => {
    if (!pickerOpen) return;
    function onDown(e) {
      if (!toastRef.current?.contains(e.target) && !buttonRef.current?.contains(e.target)) {
        setPickerOpen(false);
        restartTimer();
      }
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [pickerOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(timerRef.current), []);

  function restartTimer() {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setToastOpen(false);
      setPickerOpen(false);
    }, 5000);
  }

  function openToast() {
    clearTimeout(timerRef.current);
    setToastOpen(true);
    setPickerOpen(false);
    restartTimer();
  }

  function dismissToast() {
    clearTimeout(timerRef.current);
    setToastOpen(false);
    setPickerOpen(false);
  }

  function togglePicker() {
    if (pickerOpen) {
      setPickerOpen(false);
      restartTimer();
    } else {
      clearTimeout(timerRef.current);
      setPickerOpen(true);
    }
  }

  async function handleButtonClick() {
    if (!session) { onAuthPrompt?.(); return; }
    if (isLoading || autoAdding) return;

    if (isInAny) {
      if (toastOpen) {
        togglePicker();
      } else {
        openToast();
      }
      return;
    }

    // Auto-add to first/main watchlist
    setAutoAdding(true);
    dismissToast();
    try {
      let target = watchlists[0] ?? null;

      if (!target) {
        const { data, error } = await supabase
          .from("watchlist")
          .insert({ profile_id: session.user.id, name: "My Watchlist" })
          .select("id, name")
          .single();
        if (error) throw error;
        target = data;
        setWatchlists((prev) => [...prev, data]);
        setMembershipMap((prev) => ({ ...prev, [data.id]: null }));
      }

      const idCol = mediaType === "movie" ? "movie_id" : "show_id";
      const { data: item, error: itemErr } = await supabase
        .from("watchlist_item")
        .insert({ watchlist_id: target.id, media_type: mediaType, [idCol]: entityId })
        .select("id")
        .single();
      if (itemErr) throw itemErr;

      setMembershipMap((prev) => ({ ...prev, [target.id]: item.id }));
      openToast();
      onMembershipChange?.();
    } catch {
      // ignore
    } finally {
      setAutoAdding(false);
    }
  }

  async function handleToggle(listId) {
    clearTimeout(timerRef.current);
    await toggleInWatchlist(listId);
    onMembershipChange?.();
  }

  const activeLists = watchlists.filter((w) => membershipMap[w.id] != null);
  const toastLabel  = activeLists.length === 1
    ? `"${activeLists[0].name}"`
    : `${activeLists.length} lists`;

  return (
    <div className="relative">
      {/* Main button */}
      {compact ? (
        <button
          ref={buttonRef}
          onClick={handleButtonClick}
          disabled={autoAdding || isLoading}
          className="flex items-center gap-1 text-xs text-[#5050a0] transition hover:text-[#a0a0e8] disabled:opacity-40"
        >
          {autoAdding ? <SpinnerIcon size={10} /> : null}
          <span>{activeLists.length > 1 ? `${activeLists.length} lists` : activeLists[0]?.name ?? "My Watchlist"}</span>
          <ChevronIcon open={toastOpen && pickerOpen} />
        </button>
      ) : (
        <button
          ref={buttonRef}
          onClick={handleButtonClick}
          disabled={autoAdding || isLoading}
          className={`group flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-bold transition active:scale-95 disabled:opacity-60 ${
            isInAny
              ? "border-amber-700/60 bg-amber-950/40 text-amber-400"
              : "border-[#3a3a7a] bg-[#1a1d35] text-[#8888c8] hover:border-[#6060b0] hover:text-white"
          }`}
        >
          {autoAdding ? <SpinnerIcon /> : <BookmarkIcon filled={isInAny} />}
          {isInAny ? "Watchlisted" : "Watchlist"}
        </button>
      )}

      {/* Toast */}
      {toastOpen && (
        <div
          ref={toastRef}
          className="absolute right-0 top-full z-50 mt-2 min-w-max rounded-xl border border-[#2a2d4a] bg-[#0d0f1e] shadow-2xl shadow-black/60"
        >
          {/* Confirmation bar */}
          <div className="flex items-center gap-2 px-3.5 py-2.5">
            <span className="text-emerald-400 flex-shrink-0"><CheckIcon size={13} /></span>

            <button
              onClick={togglePicker}
              className="flex items-center gap-1.5 rounded-lg border border-[#2a3570] bg-[#12163a] px-2.5 py-1 text-xs font-semibold text-white transition hover:border-[#5050a8]"
            >
              <span className="max-w-[150px] truncate">{toastLabel}</span>
              <ChevronIcon open={pickerOpen} />
            </button>

            <span className="text-xs text-[#6060a0] select-none">·</span>
            <span className="text-xs text-[#7070b0]">
              {activeLists.length === 1 ? "watchlist" : "watchlists"}
            </span>

            <button onClick={dismissToast} className="ml-1 text-[#4040a0] transition hover:text-[#a0a0e8]">
              <CloseIcon />
            </button>
          </div>

          {/* Inline checklist picker */}
          {pickerOpen && (
            <div className="border-t border-[#1a1f3a]">
              <div className="max-h-52 overflow-y-auto py-1">
                {watchlists.map((list) => {
                  const isIn      = membershipMap[list.id] != null;
                  const isPending = pendingIds.has(list.id);

                  return (
                    <button
                      key={list.id}
                      onClick={() => handleToggle(list.id)}
                      disabled={isPending}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-[#141728] disabled:opacity-50"
                    >
                      <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                        isIn
                          ? "border-[#6060c0] bg-[#3030a0] text-white"
                          : "border-[#3a3a7a] bg-[#1a1d35]"
                      }`}>
                        {isPending ? <SpinnerIcon size={9} /> : isIn ? <CheckIcon size={9} /> : null}
                      </span>
                      <span className={`min-w-0 truncate text-xs ${isIn ? "font-semibold text-white" : "text-[#8888c8]"}`}>
                        {list.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-[#1a1f3a] px-4 py-2.5">
                <Link
                  to="/watchlists"
                  onClick={dismissToast}
                  className="text-xs text-[#6060b0] transition hover:text-[#a0a0e8]"
                >
                  Manage watchlists →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
