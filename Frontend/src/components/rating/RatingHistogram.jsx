import { useCommunityRatings } from "../../features/rating/hooks/useCommunityRatings.js";
import { HeartDisplay } from "./HeartDisplay.jsx";

const MIN_RATINGS = 10;

function BarTip({ children }) {
  return (
    <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-[#2a2f5a] bg-[#0d0f1e] px-2.5 py-1.5 text-xs text-white opacity-0 shadow-xl transition-opacity duration-100 group-hover:opacity-100">
      {children}
      <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-[#0d0f1e]" />
    </div>
  );
}

export function RatingHistogram({ mediaType, entityId }) {
  const { histogram, avg, total, loading } = useCommunityRatings(mediaType, entityId);

  if (loading) return null;
  if (total < MIN_RATINGS) {
    return (
      <div className="mt-4 rounded-xl border border-[#1a1f3a] bg-[#0a0c18] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4a4a7a]">Community ratings</p>
        <p className="mt-1 text-xs text-[#4a4a7a]">Not enough ratings yet</p>
      </div>
    );
  }

  const maxCount = Math.max(...Object.values(histogram), 1);

  return (
    <div className="mt-4 rounded-xl border border-[#1a1f3a] bg-[#0a0c18] px-4 py-3">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#5050b0]">Ratings</p>
        <span className="text-xs text-[#6868b8]">{total}</span>
      </div>

      {/* Avg chip */}
      <div className="mb-3 flex items-center gap-2">
        <HeartDisplay value={Math.round(avg)} size="sm" />
        <span className="text-xs font-semibold text-[#a090ff]">{avg}/10</span>
      </div>

      {/* Histogram bars */}
      <div className="flex items-end gap-[2px]" style={{ height: 40 }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => {
          const count = histogram[v] ?? 0;
          const heightPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
          const p = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={v} className="group relative flex-1" style={{ height: "100%" }}>
              <div
                className="absolute bottom-0 w-full rounded-t-sm bg-[#3a3070] transition-colors group-hover:bg-[#6050c0]"
                style={{ height: `${Math.max(heightPct, count > 0 ? 8 : 2)}%` }}
              />
              {count > 0 && (
                <BarTip>{v}/10 · {count} rating{count !== 1 ? "s" : ""} ({p}%)</BarTip>
              )}
            </div>
          );
        })}
      </div>

      {/* Scale labels */}
      <div className="mt-1.5 flex justify-between">
        <HeartDisplay value={1} size="sm" />
        <HeartDisplay value={10} size="sm" />
      </div>
    </div>
  );
}
