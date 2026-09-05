import { tmdbImg } from "../../lib/tmdbImage.js";
import { avatarUploadUrl } from "../../lib/avatarUrl.js";
import { cn } from "../../lib/cn.js";

const SIZES = {
  xs: "h-6 w-6 border text-[10px]",
  sm: "h-9 w-9 border-2 text-sm",
  row: "h-10 w-10 border text-sm",
  lg: "h-16 w-16 border-2 text-2xl",
  xl: "h-24 w-24 border-[3px] text-4xl",
  "2xl": "h-32 w-32 border-4 text-5xl",
};

// One shared avatar renderer for every "whose identity is this" spot in the
// app. Priority: uploaded photo (Pro+) > chosen TMDB poster > username
// initial. Falls through silently if the expected path for a given
// avatarType is missing rather than erroring.
function Avatar({ username, avatarType, avatarPosterPath, avatarUploadPath, size = "row", className = "" }) {
  const initial = (username?.[0] ?? "?").toUpperCase();

  let src = null;
  if (avatarType === "upload" && avatarUploadPath) src = avatarUploadUrl(avatarUploadPath);
  else if (avatarType === "poster" && avatarPosterPath) src = tmdbImg(avatarPosterPath, "w185");

  return (
    <div className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full border-border-strong bg-surface-3 font-bold text-text-link", SIZES[size] ?? SIZES.row, className)}>
      {src ? <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" /> : initial}
    </div>
  );
}

export default Avatar;
