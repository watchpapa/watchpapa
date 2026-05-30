import { useEffect, useRef, useState } from "react";
import { useRating } from "../../features/rating/hooks/useRating.js";
import { HeartDisplay } from "./HeartDisplay.jsx";
import { RatingInput } from "./RatingInput.jsx";

const HEART_PATH = "M8 14.7C3.8 11.2 1 8.8 1 6.1 1 4 2.7 2.4 4.8 2.4c1.1 0 2.2.5 3.2 1.8C9 2.9 10.1 2.4 11.2 2.4 13.3 2.4 15 4 15 6.1c0 2.7-2.8 5.1-7 8.6z";

function EmptyHeartsAnon({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-xl border border-[#3a3a7a] bg-[#1a1d35] px-3 py-1.5 text-xs font-semibold text-[#a0a0e8] transition hover:border-[#5a5aaa] hover:text-white"
      title="Sign in to rate"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d={HEART_PATH} stroke="currentColor" strokeWidth="1.2" fill="none" />
      </svg>
      <span>Rate</span>
    </button>
  );
}

export function RatingButton({ mediaType, entityId, session, onAuthPrompt }) {
  const { value, loading, setRating, clearRating } = useRating(mediaType, entityId, session);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function onPointerdown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("pointerdown", onPointerdown);
    return () => document.removeEventListener("pointerdown", onPointerdown);
  }, [open]);

  if (!session) {
    return <EmptyHeartsAnon onClick={onAuthPrompt} />;
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={loading}
        className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
          value != null
            ? "border-[#6050c0] bg-[#1e1a40] text-[#a090ff] hover:border-[#8070e0]"
            : "border-[#3a3a7a] bg-[#1a1d35] text-[#a0a0e8] hover:border-[#5a5aaa] hover:text-white"
        }`}
      >
        {value != null ? (
          <HeartDisplay value={value} size="sm" />
        ) : (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d={HEART_PATH} stroke="currentColor" strokeWidth="1.2" fill="none" />
          </svg>
        )}
        <span>{value != null ? `${value}/10` : "Rate"}</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-max rounded-2xl border border-[#2a2f5a] bg-[#0d0f1e] p-4 shadow-2xl shadow-black/60 animate-[fadeSlideDown_0.15s_ease-out]">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#5050b0]">Your rating</p>
          <RatingInput
            value={value}
            onChange={async (v) => {
              await setRating(v);
              setOpen(false);
            }}
          />
          {value != null && (
            <button
              onClick={async () => { await clearRating(); setOpen(false); }}
              className="mt-3 text-xs text-[#6060a0] transition hover:text-[#a090ff]"
            >
              Clear rating
            </button>
          )}
        </div>
      )}
    </div>
  );
}
