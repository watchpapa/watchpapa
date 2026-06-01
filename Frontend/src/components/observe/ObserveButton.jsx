import { useState } from "react";
import { useObserve } from "../../features/observe/hooks/useObserve.js";

// Primary observe/unobserve control for a target profile.
// Handles public (instant) and private (request -> pending) accounts.
export function ObserveButton({ targetId, targetIsPrivate, session, onChange, onAuthPrompt }) {
  const { status, isBlocked, loading, busy, observe, unobserve } = useObserve(targetId, session);
  const [hover, setHover] = useState(false);

  if (loading || isBlocked || !targetId) return null;

  const handle = async () => {
    if (!session) { onAuthPrompt?.(); return; }
    if (status === "accepted" || status === "pending") {
      await unobserve();
    } else {
      await observe();
    }
    onChange?.();
  };

  let label;
  let primary = false;
  if (status === "accepted") {
    label = hover ? "Unobserve" : "Observing";
  } else if (status === "pending") {
    label = hover ? "Cancel request" : "Requested";
  } else {
    label = targetIsPrivate ? "Request to observe" : "Observe";
    primary = true;
  }

  const base = "rounded-xl px-4 py-1.5 text-xs font-semibold transition disabled:opacity-50";
  const styles = primary
    ? "border border-[#7070d0] bg-[#3a3a8a] text-white hover:bg-[#4a4aaa]"
    : "border border-[#3a3a7a] bg-[#1a1d35] text-[#a0a0e8] hover:border-[#aa5a5a] hover:text-white";

  return (
    <button
      onClick={handle}
      disabled={busy}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`${base} ${styles}`}
    >
      {label}
    </button>
  );
}
