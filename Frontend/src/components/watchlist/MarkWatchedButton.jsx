function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
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

// Quick "I've seen this, no rating yet" toggle for MoviePage/ShowPage,
// alongside Follow and Watchlist. Independent of both — see useWatchedStatus.js
// for how it interacts with watchlist membership and rating.
function MarkWatchedButton({ isWatched, onToggle, disabled = false }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-bold transition active:scale-95 disabled:opacity-50 ${
        isWatched
          ? "border-green-600 bg-green-900/40 text-green-400 hover:border-red-500 hover:bg-red-900/30 hover:text-red-300"
          : "border-[#3a3a7a] bg-[#1a1d35] text-[#8888c8] hover:border-[#6f6fdc] hover:text-white"
      }`}
    >
      {isWatched ? <CheckIcon /> : <EyeIcon />}
      {isWatched ? "Watched" : "Mark watched"}
    </button>
  );
}

export default MarkWatchedButton;
