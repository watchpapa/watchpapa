import { tmdbImg } from "../../lib/tmdbImage.js";
import { avatarUploadUrl } from "../../lib/avatarUrl.js";

// Sizing matches the three existing "initials circle" variants this replaces:
// ProfileMenu (own nav button), UserResultRow (search/observer rows), and the
// ProfilePage header. `xs` is new, for small inline rows that had no avatar at
// all before (kept available for future use, not wired in yet).
const SIZES = {
  xs: "h-6 w-6 border text-[10px]",
  sm: "h-9 w-9 border-2 text-sm",
  row: "h-10 w-10 border text-sm",
  lg: "h-16 w-16 border-2 text-2xl",
};

// One shared avatar renderer for every "whose identity is this" spot in the
// app. Priority: uploaded photo (Pro+) > chosen TMDB poster > username
// initial (same plain-letter fallback the app always used — no generated
// pattern). Falls through silently if the expected path for a given
// avatarType is missing (e.g. stale/inconsistent data) rather than erroring.
function Avatar({ username, avatarType, avatarPosterPath, avatarUploadPath, size = "row", className = "" }) {
  const sizeClass = SIZES[size] ?? SIZES.row;
  const initial = (username?.[0] ?? "?").toUpperCase();

  let src = null;
  if (avatarType === "upload" && avatarUploadPath) src = avatarUploadUrl(avatarUploadPath);
  else if (avatarType === "poster" && avatarPosterPath) src = tmdbImg(avatarPosterPath, "w185");

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border-[#3a3a7a] bg-[#1a1d35] font-bold text-[#a0a0e8] ${sizeClass} ${className}`}
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" /> : initial}
    </div>
  );
}

export default Avatar;
