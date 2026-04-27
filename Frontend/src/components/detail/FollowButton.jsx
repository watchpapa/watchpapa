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

function FollowButton({ isFollowing, onToggle, disabled = false }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-bold transition disabled:opacity-50 ${
        isFollowing
          ? "border-[#5050b0] bg-[#2a2d60] text-[#a0a0e8] hover:border-red-400 hover:text-red-300"
          : "border-[#3a3a7a] bg-[#1a1d35] text-[#8888c8] hover:border-[#6060b0] hover:text-white"
      }`}
    >
      {isFollowing ? <MinusIcon /> : <PlusIcon />}
      {isFollowing ? "Following" : "Follow"}
    </button>
  );
}

export default FollowButton;
