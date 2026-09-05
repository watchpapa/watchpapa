import { useState } from "react";
import { useRating } from "../../features/rating/hooks/useRating.js";
import Button from "../ui/Button.jsx";

// The rating control inside MediaActionPanel.
// Unrated: 5 hearts shown live — hover/drag to preview half steps, tap to set.
// Rated: the hearts go static so a stray tap can't overwrite a rating that now
// has history behind it; "Change" re-enables them, "Clear" removes the rating.
// Logged-out users see empty hearts; tapping triggers onAuthPrompt.
// isUnreleased: shows "Not yet released" instead of the controls.

const HEART_PATH = "M8 14.7C3.8 11.2 1 8.8 1 6.1 1 4 2.7 2.4 4.8 2.4c1.1 0 2.2.5 3.2 1.8C9 2.9 10.1 2.4 11.2 2.4 13.3 2.4 15 4 15 6.1c0 2.7-2.8 5.1-7 8.6z";

export function RatingSidebar({ mediaType, entityId, session, onAuthPrompt, isUnreleased, tmdbShowId, seasonNumber, episodeNumber }) {
  const { value, setRating, clearRating } = useRating(mediaType, entityId, session, { tmdbShowId, seasonNumber, episodeNumber });
  const [preview, setPreview] = useState(null);
  const [changing, setChanging] = useState(false);

  if (isUnreleased) {
    return (
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-accent">Your rating</p>
        <p className="mt-1 text-sm italic text-text-faint">Not yet released</p>
      </div>
    );
  }

  const isEditable = value == null || changing;
  const displayValue = preview ?? value ?? 0;

  const heartValue = (e, heartIndex) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX ?? e.touches?.[0]?.clientX ?? rect.left) - rect.left;
    return x < rect.width / 2 ? heartIndex * 2 - 1 : heartIndex * 2;
  };

  const onMove = (e, i) => {
    if (!session || !isEditable) return;
    setPreview(heartValue(e, i));
  };

  const onPick = (e, i) => {
    if (!session) { onAuthPrompt?.(); return; }
    if (!isEditable) return;
    setRating(heartValue(e, i));
    setPreview(null);
    setChanging(false);
  };

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-accent">
          {value != null ? "Your rating" : `Rate this ${mediaType}`}
        </p>
        {(preview ?? value) != null && (
          <span className="text-sm font-bold text-[#a090ff]" aria-live="polite">{preview ?? value}/10</span>
        )}
      </div>

      <div
        role="group"
        aria-label={`Rating, ${value ?? 0} out of 10`}
        className="mt-2 flex items-center gap-1.5"
        onMouseLeave={() => setPreview(null)}
        title={session ? undefined : "Sign in to rate"}
      >
        {[1, 2, 3, 4, 5].map((i) => {
          const fill = displayValue >= i * 2 ? "full" : displayValue >= i * 2 - 1 ? "half" : "empty";
          const previewing = preview !== null;
          return (
            <button
              key={i}
              type="button"
              aria-label={`${i * 2} out of 10`}
              disabled={!!session && !isEditable}
              onMouseMove={(e) => onMove(e, i)}
              onClick={(e) => onPick(e, i)}
              className={`-m-0.5 flex h-10 w-10 items-center justify-center rounded-lg p-0 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light ${
                !isEditable && session ? "cursor-default" : session ? "cursor-pointer hover:scale-110" : "cursor-pointer opacity-60"
              }`}
            >
              <svg width={30} height={30} viewBox="0 0 16 16" fill="none" className="shrink-0" aria-hidden>
                {fill === "half" && (
                  <defs>
                    <clipPath id={`rsc-${mediaType}-${i}`}><rect x="0" y="0" width="8" height="16" /></clipPath>
                  </defs>
                )}
                <path d={HEART_PATH} stroke={fill === "empty" ? (previewing ? "#6a6ab0" : "#3a3a7a") : "#a090ff"} strokeWidth="1.2" fill="none" />
                {fill === "full" && <path d={HEART_PATH} fill="#a090ff" />}
                {fill === "half" && <path d={HEART_PATH} fill="#a090ff" clipPath={`url(#rsc-${mediaType}-${i})`} />}
              </svg>
            </button>
          );
        })}
      </div>

      {value != null && !changing && (
        <div className="mt-2 flex items-center gap-1">
          <Button variant="ghost" size="xs" onClick={() => (session ? setChanging(true) : onAuthPrompt?.())}>Change</Button>
          <Button variant="ghost" size="xs" onClick={() => clearRating()} className="text-text-faint hover:text-red-300">Clear</Button>
        </div>
      )}
      {changing && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-text-faint">Pick a new rating</span>
          <Button variant="ghost" size="xs" onClick={() => { setChanging(false); setPreview(null); }}>Cancel</Button>
        </div>
      )}
    </div>
  );
}
