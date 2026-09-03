import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { tmdbImg } from "../../../lib/tmdbImage.js";


const SORT_OPTIONS = [
  { value: "release_asc", label: "Release / first air (soonest first)" },
  { value: "release_desc", label: "Release / first air (latest first)" },
  { value: "added_desc", label: "Date added (newest first)" },
  { value: "added_asc", label: "Date added (oldest first)" },
  { value: "upcoming_first", label: "Upcoming & current first" },
  { value: "past_first", label: "Already released first" },
];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

/** Single comparable date for sorting (YYYY-MM-DD or null). */
function effectiveReleaseDate(item) {
  if (item.kind === "movie") return item.row.release_date?.slice(0, 10) ?? null;
  const s = item.row;
  return s.first_air_date?.slice(0, 10) ?? null;
}

/** Rough bucket for lifecycle sorts: 0 = upcoming/current, 1 = unknown dates, 2 = past. */
function lifecycleBucket(item) {
  const t = todayKey();
  if (item.kind === "movie") {
    const rd = item.row.release_date?.slice(0, 10);
    if (!rd) return 1;
    return rd < t ? 2 : 0;
  }
  const last = item.row.last_air_date?.slice(0, 10);
  const first = item.row.first_air_date?.slice(0, 10);
  if (last && last < t) return 2;
  if (first && first > t) return 0;
  if (first && first <= t) return 0;
  return 1;
}

function lifecycleLabel(item) {
  const b = lifecycleBucket(item);
  if (b === 2) return "Released";
  if (b === 0) return "Upcoming / airing";
  return "Date TBD";
}

function showStatusInfo(status) {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s.includes("return")) return { text: "Returning Series", color: "text-green-400" };
  if (s.includes("ended")) return { text: "Ended", color: "text-[#8888c8]" };
  if (s.includes("cancel")) return { text: "Cancelled", color: "text-red-400" };
  if (s.includes("production")) return { text: "In Production", color: "text-amber-400" };
  if (s.includes("pilot")) return { text: "Pilot", color: "text-amber-400" };
  if (s.includes("plan")) return { text: "Planned", color: "text-[#8888c8]" };
  return { text: status, color: "text-[#8888c8]" };
}

function compareStr(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
}

function buildRows(shows, movies) {
  const rows = [];
  for (const s of shows) {
    rows.push({ kind: "show", id: s.id, row: s });
  }
  for (const m of movies) {
    rows.push({ kind: "movie", id: m.id, row: m });
  }
  return rows;
}

function ManageFollowsModal({
  open,
  onClose,
  shows,
  movies,
  unfollowShow,
  unfollowMovie,
}) {
  const [sort, setSort] = useState("release_asc");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const sortedRows = useMemo(() => {
    let list = buildRows(shows, movies);
    if (filter === "movie") list = list.filter((x) => x.kind === "movie");
    if (filter === "show") list = list.filter((x) => x.kind === "show");

    const rel = (item) => effectiveReleaseDate(item);
    const added = (item) => item.row.followed_at?.slice(0, 10) ?? item.row.followed_at ?? "";

    const copy = [...list];
    copy.sort((a, b) => {
      if (sort === "release_asc") return compareStr(rel(a), rel(b));
      if (sort === "release_desc") return compareStr(rel(b), rel(a));
      if (sort === "added_desc") return compareStr(added(b), added(a));
      if (sort === "added_asc") return compareStr(added(a), added(b));
      if (sort === "upcoming_first") {
        const d = lifecycleBucket(a) - lifecycleBucket(b);
        if (d !== 0) return d;
        return compareStr(rel(a), rel(b));
      }
      if (sort === "past_first") {
        const d = lifecycleBucket(b) - lifecycleBucket(a);
        if (d !== 0) return d;
        return compareStr(rel(b), rel(a));
      }
      return 0;
    });
    return copy;
  }, [shows, movies, sort, filter]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 px-3 py-6 backdrop-blur-sm sm:px-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex h-[min(92dvh,820px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#2a3570] bg-[#0d0f1e] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-follows-title"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#1a1f3a] px-5 py-4 sm:px-6">
          <div>
            <h2 id="manage-follows-title" className="text-lg font-extrabold text-white">
              Manage follows
            </h2>
            <p className="mt-0.5 text-xs text-[#6868b8]">Sort, open a title, or remove it from your calendar.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#3a3a7a] px-2.5 py-1 text-xs font-semibold text-[#a0a0e8] transition hover:border-[#5a5aaa] hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 border-b border-[#1a1f3a] bg-[#0a0c14] px-5 py-3 sm:px-6">
          {[
            { id: "all", label: "All" },
            { id: "show", label: "Shows" },
            { id: "movie", label: "Movies" },
          ].map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                filter === id
                  ? "bg-[#2a2d60] text-white"
                  : "border border-[#2a2a4a] text-[#8888c8] hover:border-[#5050b0] hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="shrink-0 px-5 py-3 sm:px-6">
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#5050b0]">Sort by</label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="w-full rounded-xl border border-[#1a1f3a] bg-[#141728] px-3 py-2 text-sm font-semibold text-[#c0c0e8] outline-none focus:border-[#6060b0]"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-3 sm:px-4">
          {sortedRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#4a4a7a]">Nothing in this filter.</p>
          ) : (
            <ul className="space-y-2 pb-3">
              {sortedRows.map((item) => {
                const isMovie = item.kind === "movie";
                const r = item.row;
                const title = isMovie ? r.title : r.name;
                const to = isMovie ? `/movies/${r.id}` : `/shows/${r.id}`;
                const rel = isMovie ? r.release_date : r.first_air_date;
                const relLabel = isMovie ? "Release" : "First aired";

                const statusInfo = !isMovie ? showStatusInfo(r.status) : null;

                return (
                  <li
                    key={`${item.kind}-${r.id}`}
                    className="flex items-center gap-4 rounded-xl border border-[#1a1f3a] bg-[#141728] p-3 sm:p-4"
                  >
                    <div className="h-14 w-10 flex-shrink-0 overflow-hidden rounded-lg border border-[#2a3570] bg-[#12163a] sm:h-16 sm:w-11">
                      {r.poster_path ? (
                        <img src={tmdbImg(r.poster_path, "w92")} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[#3a3a7a]">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <rect x="2" y="6" width="20" height="14" rx="2" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                          style={{ background: "rgba(10,12,35,0.9)", color: isMovie ? "#e8c04a" : "#7eb8f7" }}
                        >
                          {isMovie ? "Movie" : "Show"}
                        </span>
                        {isMovie && (
                          <span className="rounded bg-[#1a1d30] px-1.5 py-0.5 text-[9px] font-semibold text-[#6a6a9a]">
                            {lifecycleLabel(item)}
                          </span>
                        )}
                        {statusInfo && (
                          <span className={`text-[10px] font-semibold ${statusInfo.color}`}>
                            {statusInfo.text}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-sm font-bold text-white">{title}</p>
                      <p className="mt-0.5 text-xs text-[#6868b8]">
                        {isMovie ? (
                          <>Release: {fmtDate(rel)}</>
                        ) : (
                          <>Last ep: {fmtDate(r.last_air_date)}</>
                        )}
                        <span className="mx-1 text-[#3a3a6a]">·</span>
                        Added {fmtDate(r.followed_at)}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
                      <Link
                        to={to}
                        onClick={onClose}
                        className="whitespace-nowrap rounded-lg border border-[#3a3a7a] bg-[#1a1d35] px-3 py-1.5 text-center text-xs font-bold text-[#a0a0e8] transition hover:border-[#6060b0] hover:text-white"
                      >
                        View
                      </Link>
                      <button
                        type="button"
                        onClick={() => (isMovie ? unfollowMovie(r.id) : unfollowShow(r.id))}
                        className="whitespace-nowrap rounded-lg border border-[#5a3030] bg-[#2a1518] px-3 py-1.5 text-xs font-bold text-red-300 transition hover:bg-[#3a2028]"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default ManageFollowsModal;
