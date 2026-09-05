import { useRef, useState } from "react";
import { Link } from "react-router-dom";

import AppLayout from "../../layouts/AppLayout.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import { useCalendarData } from "../../features/calendar/hooks/useCalendarData.js";
import { useSubscription } from "../../features/subscription/hooks/useSubscription.js";
import { tmdbImg } from "../../lib/tmdbImage.js";

const TIER_LIMITS = {
  free:     { type: "separate", shows: 3, movies: 1 },
  premium:  { type: "combined", total: 10 },
  pro:      { type: "separate", shows: 100, movies: 100 },
  pro_plus: { type: "separate", shows: 100, movies: 100 },
  god:      { type: "unlimited" },
};

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function buildCalendarDays(year, month) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startDow = (firstDay.getDay() + 6) % 7;
  const days = [];

  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month - 1, d));
  }
  const remainder = 7 - (days.length % 7);
  if (remainder < 7) for (let i = 0; i < remainder; i++) days.push(null);

  return days;
}

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function MinusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M5 12h14" />
    </svg>
  );
}

function ChevronLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
  );
}

function ChevronRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
  );
}

// Collapse multiple episodes from the same show+season into a single "Season X" row.
function collapseEntries(entries) {
  const seasonMap = new Map();
  const order = [];

  for (const entry of entries) {
    if (entry.type === "episode" && entry.seasonNumber != null) {
      const key = `${entry.showId}-${entry.seasonNumber}`;
      if (!seasonMap.has(key)) {
        seasonMap.set(key, { representative: entry, count: 0 });
        order.push({ kind: "season", key });
      }
      seasonMap.get(key).count++;
    } else {
      order.push({ kind: "raw", entry });
    }
  }

  return order.map(({ kind, key, entry }) => {
    if (kind === "raw") return entry;
    const { representative, count } = seasonMap.get(key);
    if (count === 1) return representative; // single episode — keep as-is
    return {
      type: "season_group",
      showId: representative.showId,
      showName: representative.showName,
      seasonNumber: representative.seasonNumber,
      count,
    };
  });
}

function CalendarEntry({ entry, isToday }) {
  const episodeCls = isToday
    ? "block truncate rounded px-1 py-0.5 text-[10px] font-semibold leading-tight text-amber-300 transition hover:bg-amber-900/30 hover:text-amber-100"
    : "block truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight text-[#c0c0e8] transition hover:bg-[#2a2d60] hover:text-white";
  const movieCls = isToday
    ? "block truncate rounded px-1 py-0.5 text-[10px] font-semibold leading-tight text-amber-300 transition hover:bg-amber-900/30 hover:text-amber-100"
    : "block truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight text-[#e8c0c0] transition hover:bg-[#60202a] hover:text-white";
  const codeCls = isToday ? "text-amber-400/80" : "text-[#6868b8]";

  if (entry.type === "season_group") {
    const label = entry.seasonNumber != null ? `Season ${entry.seasonNumber}` : "Season";
    return (
      <Link
        to={`/shows/${entry.showId}/seasons/${entry.seasonNumber}`}
        className={episodeCls}
        title={`${entry.showName} — ${label} (${entry.count} episodes)`}
      >
        {entry.showName} <span className={codeCls}>{label}</span>
      </Link>
    );
  }

  if (entry.type === "episode") {
    const code = entry.seasonNumber != null
      ? `S${entry.seasonNumber}E${entry.episodeNumber}`
      : `E${entry.episodeNumber}`;
    return (
      <Link
        to={`/shows/${entry.showId}/seasons/${entry.seasonNumber}/episodes/${entry.episodeNumber}`}
        className={episodeCls}
        title={`${entry.showName}: ${entry.name}`}
      >
        {entry.showName} <span className={codeCls}>{code}</span>
      </Link>
    );
  }

  return (
    <Link
      to={`/movies/${entry.movieId}`}
      className={movieCls}
      title={entry.name}
    >
      {entry.name}
    </Link>
  );
}

function DayCell({ date, entries = [], isHovered = false, onMouseEnter, onMouseLeave }) {
  const isToday = date && toDateKey(date) === toDateKey(new Date());
  const collapsed = collapseEntries(entries);

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={isHovered && date ? { transform: "scale(1.06)", zIndex: 10 } : undefined}
      className={`min-h-[90px] rounded-xl border p-1.5 transition-[transform,border-color,background-color] duration-150 md:min-h-[100px] md:rounded-2xl md:p-2 ${
        date
          ? isToday
            ? "border-amber-700/60 bg-[#1a1510]"
            : isHovered
            ? "border-[#6050c0] bg-[#111328] shadow-lg shadow-black/50"
            : "border-[#2a3570]/50 bg-[#0d0f1e]"
          : "border-transparent"
      }`}
    >
      {date && (
        <>
          <p className={`mb-1 text-right text-[11px] font-bold ${
            isToday ? "text-amber-400" : isHovered ? "text-[#9080e0]" : "text-[#3a3a7a]"
          }`}>
            {date.getDate()}
          </p>
          <div className="space-y-0.5">
            {collapsed.map((e, i) => <CalendarEntry key={i} entry={e} isToday={isToday} />)}
          </div>
        </>
      )}
    </div>
  );
}

function DockCalendarGrid({ days, calendarEntries }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((date, i) => {
        const key = date ? toDateKey(date) : `empty-${i}`;
        const entries = date ? (calendarEntries[toDateKey(date)] ?? []) : [];
        return (
          <DayCell
            key={key}
            date={date}
            entries={entries}
            isHovered={i === hoveredIdx}
            onMouseEnter={date ? () => setHoveredIdx(i) : undefined}
            onMouseLeave={date ? () => setHoveredIdx(null) : undefined}
          />
        );
      })}
    </div>
  );
}

function AgendaView({ year, month, calendarEntries }) {
  const days = buildCalendarDays(year, month);
  const activeDays = days
    .filter(Boolean)
    .filter((d) => (calendarEntries[toDateKey(d)] ?? []).length > 0);

  if (activeDays.length === 0) {
    return <p className="py-10 text-center text-sm text-[#4a4a7a]">No releases this month.</p>;
  }

  return (
    <div className="space-y-2">
      {activeDays.map((d) => {
        const key = toDateKey(d);
        const entries = calendarEntries[key] ?? [];
        const isToday = key === toDateKey(new Date());
        const collapsed = collapseEntries(entries);
        const dateLabel = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        return (
          <div
            key={key}
            className={`rounded-2xl border p-3 ${
              isToday ? "border-amber-700/60 bg-[#1a1510]" : "border-[#2a3570]/50 bg-[#0d0f1e]"
            }`}
          >
            <p className={`mb-2 text-xs font-bold ${isToday ? "text-amber-400" : "text-[#8383e7]"}`}>
              {isToday ? "Today · " : ""}{dateLabel}
            </p>
            <div className="space-y-1">
              {collapsed.map((e, i) => <CalendarEntry key={i} entry={e} isToday={isToday} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SidebarSection({ label, items, renderItem }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[#c084fc]">{label}</p>
      <ul className="space-y-2">
        {items.map((item) => renderItem(item))}
      </ul>
    </div>
  );
}

function FollowCounter({ showCount, movieCount, tier }) {
  const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.free;
  if (limits.type === "unlimited") return null;

  if (limits.type === "combined") {
    const used = showCount + movieCount;
    const total = limits.total;
    const pct = Math.min(100, Math.round((used / total) * 100));
    const nearLimit = used >= total * 0.8;
    return (
      <div className="mb-4 space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#5a5a78]">Combined follows</span>
          <span className={`font-bold tabular-nums ${nearLimit ? "text-amber-400" : "text-[#8383e7]"}`}>
            {used}<span className="font-normal text-[#3a3a6a]">/{total}</span>
          </span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-[#1a1f3a]">
          <div
            className={`h-full rounded-full transition-all ${nearLimit ? "bg-amber-500" : "bg-[#6868b8]"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  const showPct = Math.min(100, Math.round((showCount / limits.shows) * 100));
  const moviePct = Math.min(100, Math.round((movieCount / limits.movies) * 100));
  const showNear = showCount >= limits.shows * 0.8;
  const movieNear = movieCount >= limits.movies * 0.8;

  return (
    <div className="mb-4 space-y-2">
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#5a5a78]">Shows</span>
          <span className={`font-bold tabular-nums ${showNear ? "text-amber-400" : "text-[#8383e7]"}`}>
            {showCount}<span className="font-normal text-[#3a3a6a]">/{limits.shows}</span>
          </span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-[#1a1f3a]">
          <div className={`h-full rounded-full transition-all ${showNear ? "bg-amber-500" : "bg-[#6868b8]"}`} style={{ width: `${showPct}%` }} />
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#5a5a78]">Movies</span>
          <span className={`font-bold tabular-nums ${movieNear ? "text-amber-400" : "text-[#e0c0e8]"}`}>
            {movieCount}<span className="font-normal text-[#3a3a6a]">/{limits.movies}</span>
          </span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-[#1a1f3a]">
          <div className={`h-full rounded-full transition-all ${movieNear ? "bg-amber-500" : "bg-[#9060a0]"}`} style={{ width: `${moviePct}%` }} />
        </div>
      </div>
    </div>
  );
}

function PosterThumb({ src, alt, isMovie }) {
  return (
    <div className="h-10 w-7 flex-shrink-0 overflow-hidden rounded border border-[#2a3570] bg-[#12163a]">
      {src ? (
        <img src={tmdbImg(src, "w92")} alt={alt} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[#3a3a7a]">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            {isMovie ? <><path d="M2 8h20M2 16h20M8 4v16M16 4v16" /><rect x="2" y="4" width="20" height="16" rx="2" /></> : <rect x="2" y="6" width="20" height="14" rx="2" />}
          </svg>
        </div>
      )}
    </div>
  );
}

function FollowedSidebar({ shows, movies, onUnfollowShow, onUnfollowMovie, tier, pendingUnfollows, onUndo }) {
  const empty = shows.length === 0 && movies.length === 0;
  return (
    <aside className="order-2 flex w-full flex-col md:order-1 md:w-[230px] md:flex-shrink-0 md:sticky md:top-[4.5rem] md:self-start lg:w-[250px]">
      <div className="flex flex-col rounded-2xl border border-[#2a3570]/50 bg-[#141728] p-4 overflow-hidden max-h-[55svh] md:max-h-[calc(100svh-5.5rem)]">
        <h2 className="mb-3 shrink-0 text-sm font-extrabold text-[#8383e7]">Followed</h2>
        <div className="shrink-0">
          <FollowCounter showCount={shows.length} movieCount={movies.length} tier={tier} />
        </div>
        <Link
          to="/follows"
          className="shrink-0 mt-1 block w-full rounded-xl border border-[#3a3a7a] bg-[#1a1d35] py-2 text-center text-xs font-bold text-[#a0a0e8] transition hover:border-[#6060b0] hover:text-white"
        >
          Manage follows →
        </Link>
        {empty ? (
          <p className="mt-3 text-xs text-[#4a4a7a]">Nothing followed yet.</p>
        ) : (
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-y-contain pr-1">
            <div className="space-y-4">
              <SidebarSection
                label="Shows"
                items={shows}
                renderItem={(show) => {
                  const key = `show-${show.id}`;
                  const pending = pendingUnfollows.has(key);
                  return (
                    <li key={show.id} className={`flex items-center gap-2 text-xs transition-opacity ${pending ? "opacity-50" : ""}`}>
                      <Link to={`/shows/${show.id}`} className="flex min-w-0 flex-1 items-center gap-2 transition hover:opacity-80">
                        <PosterThumb src={show.poster_path} alt={show.name} isMovie={false} />
                        <span className="truncate font-semibold text-[#c0c0e8]">{show.name}</span>
                      </Link>
                      {pending ? (
                        <button
                          type="button"
                          onClick={() => onUndo("show", show.id)}
                          className="flex-shrink-0 rounded-full border border-[#5a5aaa] bg-[#1a1d35] px-2 py-0.5 text-[10px] font-bold text-[#a0a0e8] transition hover:border-[#8888c8] hover:text-white"
                        >
                          Undo
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onUnfollowShow(show.id)}
                          className="flex-shrink-0 rounded-full border border-[#3a3a7a] bg-[#1a1d35] p-1 text-[#6868b8] transition hover:border-red-400 hover:text-red-300"
                          title="Unfollow"
                        >
                          <MinusIcon />
                        </button>
                      )}
                    </li>
                  );
                }}
              />
              <SidebarSection
                label="Movies"
                items={movies}
                renderItem={(movie) => {
                  const key = `movie-${movie.id}`;
                  const pending = pendingUnfollows.has(key);
                  return (
                    <li key={movie.id} className={`flex items-center gap-2 text-xs transition-opacity ${pending ? "opacity-50" : ""}`}>
                      <Link to={`/movies/${movie.id}`} className="flex min-w-0 flex-1 items-center gap-2 transition hover:opacity-80">
                        <PosterThumb src={movie.poster_path} alt={movie.title} isMovie={true} />
                        <span className="truncate font-semibold text-[#e0c0e8]">{movie.title}</span>
                      </Link>
                      {pending ? (
                        <button
                          type="button"
                          onClick={() => onUndo("movie", movie.id)}
                          className="flex-shrink-0 rounded-full border border-[#5a5aaa] bg-[#1a1d35] px-2 py-0.5 text-[10px] font-bold text-[#a0a0e8] transition hover:border-[#8888c8] hover:text-white"
                        >
                          Undo
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onUnfollowMovie(movie.id)}
                          className="flex-shrink-0 rounded-full border border-[#3a3a7a] bg-[#1a1d35] p-1 text-[#6868b8] transition hover:border-red-400 hover:text-red-300"
                          title="Unfollow"
                        >
                          <MinusIcon />
                        </button>
                      )}
                    </li>
                  );
                }}
              />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}


function ReleasesCalendarPage({ session }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [pendingUnfollows, setPendingUnfollows] = useState(new Map());
  const undoTimers = useRef({});

  const { visibleShows, visibleMovies, calendarEntries, isLoading, unfollowShow, unfollowMovie } = useCalendarData(session, year, month);
  const { tier } = useSubscription(session);
  // Compute overage live from the reactive follow arrays — instant, no extra RPC.
  const tierLimits = TIER_LIMITS[tier] ?? TIER_LIMITS.free;
  const isOverFollowLimit = (() => {
    if (!session || !tierLimits || tierLimits.type === "unlimited") return false;
    if (tierLimits.type === "combined") return visibleShows.length + visibleMovies.length > tierLimits.total;
    return visibleShows.length > tierLimits.shows || visibleMovies.length > tierLimits.movies;
  })();

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  function handleSidebarUnfollow(type, id) {
    const key = `${type}-${id}`;
    clearTimeout(undoTimers.current[key]);
    setPendingUnfollows((m) => new Map(m).set(key, { type, id }));
    undoTimers.current[key] = setTimeout(() => {
      setPendingUnfollows((m) => { const n = new Map(m); n.delete(key); return n; });
      delete undoTimers.current[key];
      if (type === "show") unfollowShow(id);
      else unfollowMovie(id);
    }, 5000);
  }

  function handleUndo(type, id) {
    const key = `${type}-${id}`;
    clearTimeout(undoTimers.current[key]);
    delete undoTimers.current[key];
    setPendingUnfollows((m) => { const n = new Map(m); n.delete(key); return n; });
  }

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  function goToCurrentMonth() {
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
  }

  const days = buildCalendarDays(year, month);

  const monthNav = (
    <div className="mb-5 flex items-center justify-between gap-4">
      <button
        onClick={prevMonth}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-[#3a3a7a] bg-[#1a1d35] text-[#8888c8] transition hover:border-[#6060b0] hover:text-white"
      >
        <ChevronLeft />
      </button>

      <div className="flex flex-col items-center gap-2">
        <h2 className="text-xl font-extrabold text-white">
          {MONTH_NAMES[month - 1]} {year}
        </h2>
        <button
          onClick={goToCurrentMonth}
          disabled={isCurrentMonth}
          className="rounded-lg border border-[#3a3a7a] bg-[#1a1d35] px-3 py-1 text-xs font-semibold text-[#a0a0e8] transition hover:border-[#5a5aaa] hover:text-white disabled:cursor-default disabled:opacity-30"
        >
          Today
        </button>
      </div>

      <button
        onClick={nextMonth}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-[#3a3a7a] bg-[#1a1d35] text-[#8888c8] transition hover:border-[#6060b0] hover:text-white"
      >
        <ChevronRight />
      </button>
    </div>
  );

  return (
    <AppLayout session={session}>
      <PageHead
        title="Releases Calendar"
        description="Track upcoming movie and TV show release dates on the watchpapa releases calendar."
        path="/calendar"
      />
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 md:flex-row md:items-start">
        {/* Followed sidebar — left column on md+, below on mobile; list scrolls inside card */}
        <FollowedSidebar
          shows={visibleShows}
          movies={visibleMovies}
          onUnfollowShow={(id) => handleSidebarUnfollow("show", id)}
          onUnfollowMovie={(id) => handleSidebarUnfollow("movie", id)}
          pendingUnfollows={pendingUnfollows}
          onUndo={handleUndo}
          tier={tier}
        />

        {/* Calendar main — page scroll height follows calendar (columns align to start) */}
        <div className="order-1 min-w-0 flex-1 rounded-2xl border border-[#2a3570]/50 bg-[#141728] p-3 sm:p-4 md:order-2 md:p-5">
          {monthNav}

          {/* Follow overage gate — blocks calendar until user trims follows */}
          {isOverFollowLimit && (
            <div className="mb-4 flex flex-col items-center justify-center gap-4 rounded-2xl border border-amber-700/50 bg-amber-900/10 px-6 py-10 text-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="1.6" strokeLinecap="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <div>
                <p className="text-base font-semibold text-amber-300">You're over your follow limit</p>
                <p className="mt-1 text-sm text-amber-400/70">
                  {tierLimits.type === "combined"
                    ? `${visibleShows.length + visibleMovies.length} follows — your plan allows ${tierLimits.total}. Remove ${visibleShows.length + visibleMovies.length - tierLimits.total} to continue.`
                    : [
                        visibleShows.length > tierLimits.shows && `${visibleShows.length} shows (limit ${tierLimits.shows})`,
                        visibleMovies.length > tierLimits.movies && `${visibleMovies.length} movies (limit ${tierLimits.movies})`,
                      ].filter(Boolean).join(" · ")
                  }
                </p>
              </div>
              <Link
                to="/follows"
                className="rounded-xl border border-amber-700/60 bg-amber-900/20 px-5 py-2 text-sm font-semibold text-amber-300 transition hover:bg-amber-900/40 hover:text-amber-100"
              >
                Manage follows →
              </Link>
            </div>
          )}

          {/* Grid view — md+ only */}
          {!isOverFollowLimit && (
          <div className="hidden md:block">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAY_LABELS.map((d, i) => (
                <div key={d} className="rounded-xl border border-[#2a3570]/50 py-2 text-center text-xs font-bold text-[#8383e7]">
                  <span className="hidden lg:inline">{d}</span>
                  <span className="lg:hidden">{DAY_SHORT[i]}</span>
                </div>
              ))}
            </div>

            {isLoading ? (
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 35 }).map((_, i) => (
                  <div key={i} className="min-h-[90px] animate-pulse rounded-xl bg-[#1e2240] md:min-h-[100px] md:rounded-2xl" />
                ))}
              </div>
            ) : (
              <DockCalendarGrid days={days} calendarEntries={calendarEntries} />
            )}
          </div>
          )}

          {/* Agenda view — mobile only */}
          {!isOverFollowLimit && (
          <div className="md:hidden">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-2xl bg-[#1e2240]" />
                ))}
              </div>
            ) : (
              <AgendaView year={year} month={month} calendarEntries={calendarEntries} />
            )}
          </div>
          )}
        </div>

      </div>
    </AppLayout>
  );
}

export default ReleasesCalendarPage;
