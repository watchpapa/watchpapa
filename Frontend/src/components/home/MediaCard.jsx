import { useState } from "react";
import { Link } from "react-router-dom";
import AuthPromptModal from "../AuthPromptModal.jsx";
import { tmdbImg } from "../../lib/tmdbImage.js";
import { FOLLOW_BLOCK_TOOLTIP } from "../../lib/followGate.js";


function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M5 12h14" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function MediaCard({ id, type, title, posterPath, isFollowing = false, onFollowToggle, isAuthenticated, customTo, releaseLabel, genreIds = [], trackSource = "browse", followBlockedLabel = null }) {
  const imgSrc = posterPath ? tmdbImg(posterPath, "w300") : null;
  const to = customTo ?? (type === "movie" ? `/movies/${id}` : `/shows/${id}`);
  const isMovie = type === "movie";
  const upcoming = releaseLabel && releaseLabel !== "Airing";
  const [hovering, setHovering] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [justFollowed, setJustFollowed] = useState(false);

  function handleFollow(e) {
    e.preventDefault();
    if (!isAuthenticated) {
      setShowAuthPrompt(true);
    } else {
      if (!isFollowing) {
        setJustFollowed(true);
        setTimeout(() => setJustFollowed(false), 400);
      }
      onFollowToggle?.();
    }
  }

  return (
    <article className="group/card flex w-[100px] flex-shrink-0 flex-col gap-1.5 sm:w-[132px] sm:gap-2 lg:w-[150px]">
      {showAuthPrompt && <AuthPromptModal onClose={() => setShowAuthPrompt(false)} />}

      <Link
        to={to}
        className="relative block aspect-[2/3] overflow-hidden rounded-2xl border border-[#2a3570] bg-[#12163a] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.7)] outline-none transition duration-300 group-hover/card:-translate-y-1 group-hover/card:border-[#6f6fdc] group-hover/card:shadow-[0_18px_38px_-12px_rgba(111,111,220,0.55)] focus-visible:ring-2 focus-visible:ring-[#8585ef]"
      >
        {/* Type badge */}
        <span
          className="absolute left-2 top-2 z-20 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest backdrop-blur-sm"
          style={{ background: "rgba(10,12,35,0.82)", color: isMovie ? "#e8c04a" : "#7eb8f7" }}
        >
          {isMovie ? "Movie" : "Show"}
        </span>

        {/* Following status ring */}
        {isFollowing && (
          <span
            className="absolute right-2 top-2 z-20 flex h-5 w-5 items-center justify-center rounded-full text-green-400 ring-1 ring-green-500/60 backdrop-blur-sm"
            style={{ background: "rgba(10,12,35,0.82)" }}
            title="Following"
          >
            <CheckIcon />
          </span>
        )}

        {/* Releasing-soon badge */}
        {upcoming && (
          <span className="absolute bottom-2 left-2 z-20 rounded bg-[#e8c04a] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#1a1405]">
            {releaseLabel}
          </span>
        )}

        {imgSrc ? (
          <img
            src={imgSrc}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover/card:scale-[1.07]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-[#181d40] to-[#0e1128] px-3">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3a3a7a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="20" height="14" rx="2" />
              <path d="M8 6V4M16 6V4M2 10h20" />
            </svg>
            <span className="line-clamp-3 text-center text-[11px] font-medium leading-tight text-[#3a3a7a]">{title}</span>
          </div>
        )}

        {/* Hover scrim */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0a0c18] via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover/card:opacity-90" />
      </Link>

      <p className="line-clamp-2 min-h-[2.5em] text-center text-xs font-semibold leading-tight text-white transition-colors group-hover/card:text-[#d9d3ff]">
        {title}
      </p>

      {/* Only show this line when the gold pill overlay isn't already showing the
          same releaseLabel (i.e. the "Airing" case, which has no pill). */}
      {releaseLabel && !upcoming && (
        <p className="-mt-1 text-center text-[10px] font-medium text-[#7eb8f7]">{releaseLabel}</p>
      )}

      {!isFollowing && followBlockedLabel ? (
        <span
          aria-disabled="true"
          title={FOLLOW_BLOCK_TOOLTIP[followBlockedLabel] ?? followBlockedLabel}
          className="mx-auto flex w-full max-w-[7rem] cursor-not-allowed items-center justify-center gap-1 rounded-full border border-[#2a3570] bg-[#0d0f1e] px-2 py-0.5 text-[11px] font-bold text-[#5a5a78] sm:px-3"
        >
          {followBlockedLabel}
        </span>
      ) : (
        <button
          onClick={handleFollow}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          className={`mx-auto flex w-full max-w-[7rem] items-center justify-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold transition active:scale-95 sm:px-3 ${
            justFollowed ? "animate-[followPop_0.4s_ease-out]" : ""
          } ${
            isFollowing
              ? hovering
                ? "border-red-500 bg-red-900/30 text-red-400"
                : "border-green-600 bg-green-900/40 text-green-400"
              : "border-[#3a3a7a] bg-[#1a1d35] text-[#8888c8] hover:border-[#6f6fdc] hover:text-white"
          }`}
        >
          {isFollowing ? (
            hovering ? <><MinusIcon /> Unfollow</> : <><CheckIcon /> Followed</>
          ) : (
            <><PlusIcon /> Follow</>
          )}
        </button>
      )}
    </article>
  );
}

export default MediaCard;
