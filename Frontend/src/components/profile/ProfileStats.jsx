import { Link } from "react-router-dom";
import { HeartDisplay } from "../rating/HeartDisplay.jsx";

const PREMIUM_TIERS = new Set(["premium", "pro", "pro_plus", "god"]);
const PRO_TIERS = new Set(["pro", "pro_plus", "god"]);

// Seeded pseudo-random for inaccurate blur data (consistent per profile).
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function fakeHistogram(profileId) {
  const rand = seededRandom(hashStr(profileId ?? "x"));
  const vals = Array.from({ length: 10 }, () => Math.floor(rand() * 80 + 5));
  const peak = 5 + Math.floor(rand() * 4);
  vals[peak] += 60;
  vals[peak - 1] = (vals[peak - 1] ?? 0) + 30;
  vals[peak + 1] = (vals[peak + 1] ?? 0) + 30;
  return vals;
}

function fakeGenres(profileId) {
  const rand = seededRandom(hashStr(profileId + "g"));
  const names = ["Drama", "Thriller", "Comedy", "Action", "Sci-Fi", "Horror", "Romance", "Animation"];
  return names.slice(0, 5).map((name) => ({
    genre_name: name,
    rating_count: Math.floor(rand() * 60 + 10),
    avg_value: (rand() * 4 + 5).toFixed(1),
  }));
}

function fakeDecades(profileId) {
  const rand = seededRandom(hashStr(profileId + "d"));
  return [1980, 1990, 2000, 2010, 2020].map((decade) => ({
    decade,
    count: Math.floor(rand() * 50 + 5),
  }));
}

function fakeMonthly(profileId) {
  const rand = seededRandom(hashStr(profileId + "m"));
  return Array.from({ length: 12 }, (_, i) => ({
    month: `2024-${String(i + 1).padStart(2, "0")}`,
    count: Math.floor(rand() * 15 + 1),
  }));
}

function LockedOverlay({ requiredTier }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl bg-[#0d0f1e]/80 backdrop-blur-[2px]">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6060a0" strokeWidth="1.8" strokeLinecap="round">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <p className="text-xs font-semibold text-[#7070b0]">
        {requiredTier === "premium" ? "Premium" : "Pro"} feature
      </p>
      <Link
        to="/subscription"
        className="rounded-lg border border-[#3a3a7a] px-3 py-1 text-xs font-semibold text-[#a090ff] transition hover:border-[#6060c0] hover:text-white"
      >
        Upgrade
      </Link>
    </div>
  );
}

function BarTip({ children }) {
  return (
    <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-[#2a2f5a] bg-[#0d0f1e] px-2.5 py-1.5 text-xs text-white opacity-0 shadow-xl transition-opacity duration-100 group-hover:opacity-100">
      {children}
      <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-[#0d0f1e]" />
    </div>
  );
}

function pct(count, total) {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

function fmtMonth(ym) {
  const [y, m] = ym.split("-");
  return `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m,10)-1]} ${y}`;
}

function OwnHistogram({ histogram, total, avg }) {
  if (!total) return <p className="text-xs text-[#4a4a7a]">No ratings yet</p>;
  const maxCount = Math.max(...Object.values(histogram), 1);
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <HeartDisplay value={Math.round(avg)} size="sm" />
        <span className="text-sm font-semibold text-[#a090ff]">{avg}/10 avg</span>
        <span className="text-xs text-[#5050a0]">· {total} ratings</span>
      </div>
      <div className="flex items-end gap-[3px]" style={{ height: 32 }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => {
          const count = histogram[v] ?? 0;
          const h = maxCount > 0 ? (count / maxCount) * 100 : 0;
          return (
            <div key={v} className="group relative flex-1" style={{ height: "100%" }}>
              <div
                className="absolute bottom-0 w-full rounded-t-sm bg-[#3a3070] transition-colors group-hover:bg-[#6050c0]"
                style={{ height: `${Math.max(h, count > 0 ? 10 : 2)}%` }}
              />
              {count > 0 && (
                <BarTip>{v}/10 · {count} rating{count !== 1 ? "s" : ""} ({pct(count, total)}%)</BarTip>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ownerTier drives which stats are unlocked.
// profileId is the profile being viewed (not the viewer).
// Stats are fetched by the parent (ProfilePage) and passed as props.
export function ProfileStats({ profileId, basic, genreStats, decadeStats, monthlyStats, ownerTier }) {
  const canSeeGenre = PREMIUM_TIERS.has(ownerTier);
  const canSeePro = PRO_TIERS.has(ownerTier);

  if (!basic) return null;

  const fakeHist = canSeeGenre ? null : fakeHistogram(profileId);
  const fakeGen = canSeeGenre ? null : fakeGenres(profileId);
  const fakeDec = canSeePro ? null : fakeDecades(profileId);
  const fakeMon = canSeePro ? null : fakeMonthly(profileId);

  return (
    <div className="space-y-4">
      {/* Always visible: basic + histogram */}
      <div className="rounded-xl border border-[#1a1f3a] bg-[#0a0c18] p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#5050b0]">Your stats</p>
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Total ratings", basic.total],
            ["Movies", basic.movieCount],
            ["Shows", basic.showCount],
            ["Episodes", basic.episodeCount + basic.seasonCount],
          ].map(([label, val]) => (
            <div key={label} className="rounded-lg bg-[#0d0f1e] px-3 py-2 text-center">
              <p className="text-lg font-bold text-white">{val}</p>
              <p className="text-[10px] text-[#5050a0]">{label}</p>
            </div>
          ))}
        </div>
        {basic.total > 0 && (
          <OwnHistogram histogram={basic.histogram} total={basic.total} avg={basic.avg} />
        )}
      </div>

      {/* Genre breakdown — Premium+ */}
      <div className={`relative rounded-xl border border-[#1a1f3a] bg-[#0a0c18] p-4 ${!canSeeGenre ? "overflow-hidden" : ""}`}>
        {!canSeeGenre && <LockedOverlay requiredTier="premium" />}
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#5050b0]">Your top genres</p>
        <div className={`space-y-2 ${!canSeeGenre ? "select-none" : ""}`}>
          {(canSeeGenre ? genreStats ?? [] : fakeGen).slice(0, 5).map((g, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-20 shrink-0 truncate text-xs text-[#a0a0e8]">{g.genre_name}</span>
              <div className="relative flex-1 h-2 rounded-full bg-[#1a1f3a]">
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-[#5040a0]"
                  style={{ width: `${Math.min(100, (g.rating_count / ((canSeeGenre ? genreStats?.[0] : fakeGen[0])?.rating_count ?? 1)) * 100)}%` }}
                />
              </div>
              <span className="w-12 text-right text-xs text-[#6868b8]">{g.rating_count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Decade breakdown — Pro+ */}
      <div className={`relative rounded-xl border border-[#1a1f3a] bg-[#0a0c18] p-4 ${!canSeePro ? "overflow-hidden" : ""}`}>
        {!canSeePro && <LockedOverlay requiredTier="pro" />}
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#5050b0]">Your Top Decades</p>
        <div className={!canSeePro ? "select-none" : ""}>
          <div className="flex items-end gap-2" style={{ height: 40 }}>
            {(canSeePro ? decadeStats ?? [] : fakeDec).map((d) => {
              const all = canSeePro ? decadeStats ?? [] : fakeDec;
              const maxC = Math.max(...all.map((x) => x.count), 1);
              const h = (d.count / maxC) * 100;
              return (
                <div key={d.decade} className="group relative flex-1" style={{ height: "100%" }}>
                  <div
                    className="absolute bottom-0 w-full rounded-t-sm bg-[#3a3070] transition-colors group-hover:bg-[#6050c0]"
                    style={{ height: `${Math.max(h, 8)}%` }}
                  />
                  <BarTip>{d.decade}s · {d.count} rating{d.count !== 1 ? "s" : ""}</BarTip>
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 flex gap-2">
            {(canSeePro ? decadeStats ?? [] : fakeDec).map((d) => (
              <span key={d.decade} className="flex-1 text-center text-[9px] text-[#5050a0]">{d.decade}s</span>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly heatmap — Pro+ */}
      <div className={`relative rounded-xl border border-[#1a1f3a] bg-[#0a0c18] p-4 ${!canSeePro ? "overflow-hidden" : ""}`}>
        {!canSeePro && <LockedOverlay requiredTier="pro" />}
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#5050b0]">Your Activity</p>
        <div className={`flex items-end gap-[3px] ${!canSeePro ? "select-none" : ""}`} style={{ height: 40 }}>
          {(canSeePro ? monthlyStats ?? [] : fakeMon).map((m) => {
            const all = canSeePro ? monthlyStats ?? [] : fakeMon;
            const maxC = Math.max(...all.map((x) => x.count), 1);
            const h = (m.count / maxC) * 100;
            return (
              <div key={m.month} className="group relative flex-1" style={{ height: "100%" }}>
                <div
                  className="absolute bottom-0 w-full rounded-t-sm bg-[#3a3070] transition-colors group-hover:bg-[#6050c0]"
                  style={{ height: `${Math.max(h, 5)}%` }}
                />
                <BarTip>{fmtMonth(m.month)} · {m.count} rating{m.count !== 1 ? "s" : ""}</BarTip>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
