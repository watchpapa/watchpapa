import { useState } from "react";
import { useRating } from "../../features/rating/hooks/useRating.js";

// Always-visible sidebar rating widget.
// 5 hearts shown at all times. Hover to preview, click to set.
// Logged-out users: shows empty hearts; clicking triggers onAuthPrompt.
// isUnreleased: when true, shows "Not yet released" instead of rating controls.
// Inspired by Letterboxd's sidebar star rating.

const HEART_PATH = "M8 14.7C3.8 11.2 1 8.8 1 6.1 1 4 2.7 2.4 4.8 2.4c1.1 0 2.2.5 3.2 1.8C9 2.9 10.1 2.4 11.2 2.4 13.3 2.4 15 4 15 6.1c0 2.7-2.8 5.1-7 8.6z";
const SIZE = 28;

export function RatingSidebar({ mediaType, entityId, session, onAuthPrompt, isUnreleased, tmdbShowId, seasonNumber, episodeNumber }) {
  const { value, setRating, clearRating } = useRating(mediaType, entityId, session, {
    tmdbShowId,
    seasonNumber,
    episodeNumber,
  });
  const [preview, setPreview] = useState(null);

  if (isUnreleased) {
    return (
      <div className="mt-4 rounded-xl border border-[#2a3570]/50 bg-[#0a0c18] px-4 py-3">
        <p className="text-xs text-[#5050a0] italic">Not yet released</p>
      </div>
    );
  }

  const displayValue = preview ?? value ?? 0;

  const getHeartValue = (e, heartIndex) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    return x < rect.width / 2 ? heartIndex * 2 - 1 : heartIndex * 2;
  };

  const handleMouseMove = (e, heartIndex) => {
    if (!session) return;
    setPreview(getHeartValue(e, heartIndex));
  };

  const handleClick = (e, heartIndex) => {
    if (!session) { onAuthPrompt?.(); return; }
    const v = getHeartValue(e, heartIndex);
    if (v === value) {
      clearRating();
    } else {
      setRating(v);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-[#2a3570]/50 bg-[#0a0c18] px-4 py-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#c084fc]">
        {value != null ? `Your rating · ${value}/10` : `Rate this ${mediaType}`}
      </p>

      <div
        className="flex items-center gap-1"
        onMouseLeave={() => setPreview(null)}
        title={session ? undefined : "Sign in to rate"}
      >
        {[1, 2, 3, 4, 5].map((i) => {
          const fill = displayValue >= i * 2 ? "full" : displayValue >= i * 2 - 1 ? "half" : "empty";
          const isPreviewHeart = preview !== null;
          return (
            <svg
              key={i}
              width={SIZE}
              height={SIZE}
              viewBox="0 0 16 16"
              fill="none"
              className={`shrink-0 transition-transform ${session ? "cursor-pointer hover:scale-110" : "cursor-pointer opacity-60"}`}
              onMouseMove={(e) => handleMouseMove(e, i)}
              onClick={(e) => handleClick(e, i)}
            >
              {fill === "half" && (
                <defs>
                  <clipPath id={`rsc-${i}`}><rect x="0" y="0" width="8" height="16" /></clipPath>
                </defs>
              )}
              <path
                d={HEART_PATH}
                stroke={fill === "empty" ? (isPreviewHeart ? "#6a6ab0" : "#3a3a7a") : "#a090ff"}
                strokeWidth="1.2"
                fill="none"
              />
              {fill === "full" && <path d={HEART_PATH} fill="#a090ff" />}
              {fill === "half" && <path d={HEART_PATH} fill="#a090ff" clipPath={`url(#rsc-${i})`} />}
            </svg>
          );
        })}
      </div>

      {value != null && (
        <button
          onClick={() => clearRating()}
          className="mt-2 text-[10px] text-[#5050a0] transition hover:text-[#a090ff]"
        >
          Clear rating
        </button>
      )}
    </div>
  );
}
