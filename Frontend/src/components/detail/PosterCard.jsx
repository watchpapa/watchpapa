
import { tmdbImg } from "../../lib/tmdbImage.js";
function PosterCard({ title, posterPath }) {
  const imgSrc = posterPath ? tmdbImg(posterPath, "w342") : null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#2a3570] bg-[#12163a] aspect-[2/3] w-full shadow-[0_18px_40px_-16px_rgba(0,0,0,0.7)]">
      {imgSrc ? (
        <img src={imgSrc} alt={title} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-[#181d40] to-[#0e1128] px-4">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#3a3a7a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="6" width="20" height="14" rx="2" />
            <path d="M8 6V4M16 6V4M2 10h20" />
          </svg>
          <span className="text-center text-sm font-medium leading-tight text-[#3a3a7a] line-clamp-4">{title}</span>
        </div>
      )}
    </div>
  );
}

export default PosterCard;
