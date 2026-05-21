import { useState } from "react";
import { Link } from "react-router-dom";
import AuthPromptModal from "../AuthPromptModal.jsx";
import { trackContentClick } from "../../lib/analytics.js";

const TMDB_IMG = "https://image.tmdb.org/t/p/w300";

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

function MediaCard({ id, slug, type, title, posterPath, isFollowing = false, onFollowToggle, isAuthenticated, customTo, releaseLabel, genreIds = [], trackSource = "browse" }) {
  const imgSrc = posterPath ? `${TMDB_IMG}${posterPath}` : null;
  const key = slug ?? id;
  const to = customTo ?? (type === "movie" ? `/movies/${key}` : `/shows/${key}`);
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
    <article className="flex w-[130px] flex-shrink-0 flex-col gap-2 sm:w-[150px]">
      {showAuthPrompt && <AuthPromptModal onClose={() => setShowAuthPrompt(false)} />}

      <Link to={to} onClick={() => trackContentClick(type, id, genreIds, trackSource)} className="relative overflow-hidden rounded-2xl border border-[#2a3570] bg-[#12163a] aspect-[2/3] block group">
        <span className="absolute top-2 left-2 z-10 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest" style={{ background: "rgba(10,12,35,0.82)", color: type === "movie" ? "#e8c04a" : "#7eb8f7" }}>
          {type === "movie" ? "Movie" : "Show"}
        </span>
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-[#181d40] to-[#0e1128] px-3 transition-[filter] duration-300 group-hover:brightness-110">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3a3a7a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="20" height="14" rx="2" />
              <path d="M8 6V4M16 6V4M2 10h20" />
            </svg>
            <span className="text-center text-[11px] font-medium leading-tight text-[#3a3a7a] line-clamp-3">{title}</span>
          </div>
        )}
      </Link>

      <p className="text-center text-xs font-semibold leading-tight text-white line-clamp-2 min-h-[2.5em]">
        {title}
      </p>

      {releaseLabel && (
        <p className="text-center text-[10px] font-medium -mt-1 text-[#7eb8f7]">{releaseLabel}</p>
      )}

      <button
        onClick={handleFollow}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        className={`mx-auto flex min-w-[5.5rem] items-center justify-center gap-1 rounded-full border px-3 py-0.5 text-[11px] font-bold transition active:scale-95 ${
          justFollowed ? "animate-[followPop_0.4s_ease-out]" : ""
        } ${
          isFollowing
            ? hovering
              ? "border-red-500 bg-red-900/30 text-red-400"
              : "border-green-600 bg-green-900/40 text-green-400"
            : "border-[#3a3a7a] bg-[#1a1d35] text-[#8888c8] hover:border-[#6060b0] hover:text-white"
        }`}
      >
        {isFollowing ? (
          hovering ? <><MinusIcon /> Unfollow</> : <><CheckIcon /> Followed</>
        ) : (
          <><PlusIcon /> Follow</>
        )}
      </button>
    </article>
  );
}

export default MediaCard;
