import { tmdbImg } from "../../lib/tmdbImage.js";
import { cn } from "../../lib/cn.js";
import { BANNER_ASPECT, bannerSource, cropStyle } from "../../lib/profileBanner.js";

// Profile header artwork: a 3:1 band of the chosen favourite's backdrop (or
// poster) at the saved crop, centred inside whatever height the banner has,
// under a scrim so the overlapping avatar/name stay readable.
function ProfileBanner({ favourites, position, crop, className, children }) {
  const src = bannerSource(favourites, position);
  const url = src ? tmdbImg(src.path, src.isBackdrop ? "w1280" : "w780") : null;

  return (
    <div className={cn("relative overflow-hidden", className)} aria-hidden>
      {url ? (
        <div className="absolute left-0 top-1/2 w-full -translate-y-1/2 opacity-70" style={{ aspectRatio: `${BANNER_ASPECT} / 1`, ...cropStyle(url, crop) }} />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-brand-deep via-[#1f1a55] to-accent/40" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/35 to-transparent" />
      {children}
    </div>
  );
}

export default ProfileBanner;
