import { useEffect, useRef, useState } from "react";
import { FOLLOW_BLOCK_TOOLTIP } from "../../lib/followGate.js";

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M5 12h14" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

// `blockedLabel` ("Released" | "Ended" | "Canceled") disables the button for a NEW
// follow — a movie already out / a show already finished can't be newly followed.
// It never applies while `isFollowing` is true: unfollowing an existing follow of
// a now-released/ended title always stays available.
function FollowButton({ isFollowing, onToggle, disabled = false, blockedLabel = null }) {
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

  if (!isFollowing && blockedLabel) {
    return (
      <span
        aria-disabled="true"
        title={FOLLOW_BLOCK_TOOLTIP[blockedLabel] ?? blockedLabel}
        className="flex cursor-not-allowed items-center gap-2 rounded-full border border-[#2a3570] bg-[#0d0f1e] px-5 py-2 text-sm font-bold text-[#5a5a78]"
      >
        <LockIcon />
        {blockedLabel}
      </span>
    );
  }

  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`group flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-bold transition active:scale-95 disabled:opacity-50 ${
        justFollowed ? "animate-[followPop_0.4s_ease-out]" : ""
      } ${
        isFollowing
          ? "border-green-600 bg-green-900/40 text-green-400 hover:border-red-500 hover:bg-red-900/30 hover:text-red-300"
          : "border-[#3a3a7a] bg-[#1a1d35] text-[#8888c8] hover:border-[#6f6fdc] hover:text-white"
      }`}
    >
      {isFollowing ? (
        <>
          <span className="group-hover:hidden"><CheckIcon /></span>
          <span className="hidden group-hover:inline"><MinusIcon /></span>
          <span className="group-hover:hidden">Following</span>
          <span className="hidden group-hover:inline">Unfollow</span>
        </>
      ) : (
        <>
          <PlusIcon />
          Follow
        </>
      )}
    </button>
  );
}

export default FollowButton;
