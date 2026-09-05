import { useEffect, useRef, useState } from "react";
import { FOLLOW_BLOCK_TOOLTIP } from "../../lib/followGate.js";
import { cn } from "../../lib/cn.js";
import { CheckIcon, LockIcon, PlusIcon, XIcon } from "../icons/index.jsx";

// `blockedLabel` ("Released" | "Ended" | "Canceled") disables a NEW follow; it
// never applies while `isFollowing` (unfollowing always stays available).
// The following state is explicit on every device: "✓ Following" with a
// visible ✕, turning red on hover — no hover-only label swap.
function FollowButton({ isFollowing, onToggle, disabled = false, blockedLabel = null, size = "md" }) {
  const [justFollowed, setJustFollowed] = useState(false);
  const prevFollowingRef = useRef(isFollowing);

  useEffect(() => {
    if (!prevFollowingRef.current && isFollowing) {
      setJustFollowed(true);
      const t = setTimeout(() => setJustFollowed(false), 400);
      return () => clearTimeout(t);
    }
    prevFollowingRef.current = isFollowing;
  }, [isFollowing]);

  const base = cn(
    "flex items-center gap-2 rounded-full border font-bold transition active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light",
    size === "sm" ? "h-9 px-3.5 text-xs" : "h-10 px-4 text-sm",
  );

  if (!isFollowing && blockedLabel) {
    return (
      <span aria-disabled="true" title={FOLLOW_BLOCK_TOOLTIP[blockedLabel] ?? blockedLabel} className={cn(base, "cursor-not-allowed border-border bg-surface text-[#5a5a78]")}>
        <LockIcon size={14} />
        {blockedLabel}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={isFollowing}
      title={isFollowing ? "Unfollow" : "Follow"}
      className={cn(
        base,
        "group",
        justFollowed && "animate-follow-pop",
        isFollowing
          ? "border-emerald-600 bg-emerald-900/40 text-emerald-300 hover:border-red-500 hover:bg-red-900/30 hover:text-red-300"
          : "border-border-strong bg-surface-3 text-text-muted hover:border-brand hover:text-white",
      )}
    >
      {isFollowing ? (
        <>
          <CheckIcon size={14} strokeWidth={2.5} />
          <span>Following</span>
          <XIcon size={13} className="ml-0.5 opacity-60 transition group-hover:opacity-100" aria-hidden />
        </>
      ) : (
        <>
          <PlusIcon size={14} strokeWidth={2.5} />
          Follow
        </>
      )}
    </button>
  );
}

export default FollowButton;
