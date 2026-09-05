import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase.js";
import { useItemWatchlistStatus } from "../../features/watchlist/hooks/useItemWatchlistStatus.js";
import { useIsPhone } from "../../hooks/useMediaQuery.js";
import ActionChip from "../ui/ActionChip.jsx";
import Popover from "../ui/Popover.jsx";
import Sheet from "../ui/Sheet.jsx";
import { BookmarkIcon, CheckIcon, ChevronDownIcon, SpinnerIcon } from "../icons/index.jsx";
import { cn } from "../../lib/cn.js";

// Adds a title to a watchlist (auto-creating "My Watchlist" if there is none)
// and lets you pick which lists it's on. Variants:
//   pill    — rounded "Watchlist / Watchlisted" button (title bar, cards)
//   chip    — stacked icon/label ActionChip (MediaActionPanel)
//   compact — text-only (WatchlistsPage)
// The picker is a viewport-clamped popover on desktop and a bottom sheet on
// phones; the popover auto-dismisses after 5s unless the checklist is open.
export default function AddToWatchlistButton({ mediaType, entityId, session, onAuthPrompt, onMembershipChange, compact = false, variant }) {
  const mode = variant ?? (compact ? "compact" : "pill");
  const isPhone = useIsPhone();
  const [autoAdding, setAutoAdding] = useState(false);
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const timerRef = useRef(null);
  const buttonRef = useRef(null);

  const { watchlists, membershipMap, isLoading, isInAny, pendingIds, toggleInWatchlist, setWatchlists, setMembershipMap } =
    useItemWatchlistStatus(mediaType, entityId, session);

  // Close when the item leaves every list.
  const prevIsInAny = useRef(isInAny);
  useEffect(() => {
    if (prevIsInAny.current && !isInAny && open) {
      clearTimeout(timerRef.current);
      setOpen(false);
      setPickerOpen(false);
    }
    prevIsInAny.current = isInAny;
  }, [isInAny, open]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  function restartTimer() {
    clearTimeout(timerRef.current);
    if (isPhone) return; // sheets stay until dismissed
    timerRef.current = setTimeout(() => { setOpen(false); setPickerOpen(false); }, 5000);
  }
  function openToast() {
    clearTimeout(timerRef.current);
    setOpen(true);
    setPickerOpen(false);
    restartTimer();
  }
  function dismiss() {
    clearTimeout(timerRef.current);
    setOpen(false);
    setPickerOpen(false);
  }
  function togglePicker() {
    if (pickerOpen) { setPickerOpen(false); restartTimer(); }
    else { clearTimeout(timerRef.current); setPickerOpen(true); }
  }

  async function handleButtonClick() {
    if (!session) { onAuthPrompt?.(); return; }
    if (isLoading || autoAdding) return;
    if (isInAny) {
      if (open) togglePicker(); else openToast();
      return;
    }
    setAutoAdding(true);
    dismiss();
    try {
      let target = watchlists[0] ?? null;
      if (!target) {
        const { data, error } = await supabase.from("watchlist").insert({ profile_id: session.user.id, name: "My Watchlist" }).select("id, name").single();
        if (error) throw error;
        target = data;
        setWatchlists((prev) => [...prev, data]);
        setMembershipMap((prev) => ({ ...prev, [data.id]: null }));
      }
      // Upsert, not insert: a pre-migration watched=true row may still occupy
      // this (watchlist_id, media_type, tmdb_id) slot — re-adding clears it.
      const { data: item, error: itemErr } = await supabase
        .from("watchlist_item")
        .upsert({ watchlist_id: target.id, media_type: mediaType, tmdb_id: entityId, watched: false }, { onConflict: "watchlist_id,media_type,tmdb_id" })
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
  const toastLabel = activeLists.length === 1 ? `"${activeLists[0].name}"` : `${activeLists.length} lists`;

  const trigger =
    mode === "chip" ? (
      <ActionChip
        ref={buttonRef}
        icon={BookmarkIcon}
        label={isInAny ? "Watchlisted" : "Watchlist"}
        sublabel={isInAny ? (activeLists.length === 1 ? activeLists[0].name : `${activeLists.length} lists`) : undefined}
        tone={isInAny ? "warning" : "neutral"}
        onClick={handleButtonClick}
        disabled={autoAdding || isLoading}
        loading={autoAdding}
        aria-expanded={open}
      />
    ) : mode === "compact" ? (
      <button
        ref={buttonRef}
        type="button"
        onClick={handleButtonClick}
        disabled={autoAdding || isLoading}
        className="flex min-h-9 items-center gap-1 text-xs text-text-faint transition hover:text-text-link disabled:opacity-40"
      >
        {autoAdding ? <SpinnerIcon size={12} /> : null}
        <span>{activeLists.length > 1 ? `${activeLists.length} lists` : activeLists[0]?.name ?? "My Watchlist"}</span>
        <ChevronDownIcon size={12} className={cn("transition-transform", open && pickerOpen && "rotate-180")} />
      </button>
    ) : (
      <button
        ref={buttonRef}
        type="button"
        onClick={handleButtonClick}
        disabled={autoAdding || isLoading}
        aria-expanded={open}
        className={cn(
          "flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-bold transition active:scale-95 disabled:opacity-60",
          isInAny ? "border-amber-700/60 bg-amber-950/40 text-amber-400" : "border-border-strong bg-surface-3 text-text-muted hover:border-brand hover:text-white",
        )}
      >
        {autoAdding ? <SpinnerIcon size={14} /> : <BookmarkIcon size={15} fill={isInAny ? "currentColor" : "none"} />}
        {isInAny ? "Watchlisted" : "Watchlist"}
      </button>
    );

  const picker = (
    <div>
      <div className="max-h-64 overflow-y-auto py-1">
        {watchlists.map((list) => {
          const isIn = membershipMap[list.id] != null;
          const isPending = pendingIds.has(list.id);
          return (
            <button
              key={list.id}
              type="button"
              onClick={() => handleToggle(list.id)}
              disabled={isPending}
              className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-surface-2 disabled:opacity-50"
            >
              <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded border", isIn ? "border-brand bg-brand-deep text-white" : "border-border-strong bg-surface-3")}>
                {isPending ? <SpinnerIcon size={11} /> : isIn ? <CheckIcon size={12} /> : null}
              </span>
              <span className={cn("min-w-0 truncate text-sm", isIn ? "font-semibold text-white" : "text-text-muted")}>{list.name}</span>
            </button>
          );
        })}
      </div>
      <div className="border-t border-border/50 px-3 py-2.5">
        <Link to="/watchlists" onClick={dismiss} className="text-xs font-semibold text-text-dim transition hover:text-text-link">Manage watchlists →</Link>
      </div>
    </div>
  );

  const content = (
    <>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="shrink-0 text-emerald-400"><CheckIcon size={14} /></span>
        <button
          type="button"
          onClick={togglePicker}
          aria-expanded={pickerOpen}
          className="flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2.5 text-xs font-semibold text-white transition hover:border-border-hover"
        >
          <span className="max-w-[160px] truncate">{toastLabel}</span>
          <ChevronDownIcon size={12} className={cn("transition-transform", pickerOpen && "rotate-180")} />
        </button>
        <span className="text-xs text-text-dim">on your {activeLists.length === 1 ? "watchlist" : "watchlists"}</span>
      </div>
      {(pickerOpen || isPhone) && <div className="border-t border-border/50">{picker}</div>}
    </>
  );

  return (
    <>
      {trigger}
      {isPhone ? (
        <Sheet open={open} onClose={dismiss} title="Watchlists">{content}</Sheet>
      ) : (
        <Popover open={open} anchorRef={buttonRef} onClose={dismiss} align={mode === "chip" ? "start" : "end"} width={300} aria-label="Watchlists">
          {content}
        </Popover>
      )}
    </>
  );
}
