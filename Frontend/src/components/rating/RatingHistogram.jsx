import { useCommunityRatings } from "../../features/rating/hooks/useCommunityRatings.js";
import { HeartDisplay } from "./HeartDisplay.jsx";

const MIN_RATINGS = 10;

function BarTip({ children }) {
  return (
    <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-white opacity-0 shadow-xl transition-opacity duration-100 group-hover:opacity-100">
      {children}
      <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-surface" />
    </div>
  );
}

const Label = ({ children }) => <p className="text-[11px] font-semibold uppercase tracking-widest text-text-faint">{children}</p>;

// Community rating distribution. Below MIN_RATINGS it falls back to TMDB's
// average (when available) instead of an empty chart.
export function RatingHistogram({ mediaType, entityId, tmdbVoteAvg }) {
  const { histogram, avg, total, loading } = useCommunityRatings(mediaType, entityId);

  if (loading) return null;
  if (total < MIN_RATINGS) {
    if (tmdbVoteAvg > 0) {
      return (
        <div>
          <Label>Community</Label>
          <div className="mt-1.5 flex items-center gap-2">
            <HeartDisplay value={Math.round(tmdbVoteAvg)} size="sm" />
            <span className="text-xs font-semibold text-[#a090ff]">{tmdbVoteAvg.toFixed(1)}/10</span>
          </div>
          <p className="mt-1 text-[10px] text-text-faint">TMDB average · {total} watchpapa rating{total !== 1 ? "s" : ""} so far</p>
        </div>
      );
    }
    return (
      <div>
        <Label>Community</Label>
        <p className="mt-1 text-xs text-text-faint">Not enough ratings yet</p>
      </div>
    );
  }

  const maxCount = Math.max(...Object.values(histogram), 1);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <Label>Community</Label>
        <span className="text-xs text-text-dim">{total} rating{total !== 1 ? "s" : ""}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <HeartDisplay value={Math.round(avg)} size="sm" />
        <span className="text-xs font-semibold text-[#a090ff]">{avg}/10</span>
      </div>
      <div className="mt-3 flex h-10 items-end gap-[3px]">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => {
          const count = histogram[v] ?? 0;
          const heightPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
          const p = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={v} className="group relative h-full flex-1">
              <div
                className="absolute bottom-0 w-full rounded-t-sm bg-[#3a3070] transition-colors group-hover:bg-[#6050c0]"
                style={{ height: `${Math.max(heightPct, count > 0 ? 8 : 2)}%` }}
              />
              {count > 0 && <BarTip>{v}/10 · {count} rating{count !== 1 ? "s" : ""} ({p}%)</BarTip>}
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between">
        <HeartDisplay value={1} size="sm" />
        <HeartDisplay value={10} size="sm" />
      </div>
    </div>
  );
}
