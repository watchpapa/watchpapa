import { useState } from "react";
import { Link } from "react-router-dom";

const TMDB_IMG = "https://image.tmdb.org/t/p/w92";
import AppLayout from "../../layouts/AppLayout.jsx";
import { useCalendarData } from "../../features/calendar/hooks/useCalendarData.js";

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

function CalendarEntry({ entry }) {
  if (entry.type === "episode") {
    const code = entry.seasonNumber != null
      ? `S${entry.seasonNumber}E${entry.episodeNumber}`
      : `E${entry.episodeNumber}`;
    return (
      <Link
        to={`/shows/${entry.showId}/seasons/${entry.seasonId}/episodes/${entry.id}`}
        className="block truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight text-[#c0c0e8] transition hover:bg-[#2a2d60] hover:text-white"
        title={`${entry.showName}: ${entry.name}`}
      >
        {entry.showName} <span className="text-[#6868b8]">{code}</span>
      </Link>
    );
  }
  return (
    <Link
      to={`/movies/${entry.movieId}`}
      className="block truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight text-[#e8c0c0] transition hover:bg-[#60202a] hover:text-white"
      title={entry.name}
    >
      {entry.name}
    </Link>
  );
}

function DayCell({ date, entries = [] }) {
  const isToday = date && toDateKey(date) === toDateKey(new Date());

  return (
    <div className={`min-h-[90px] rounded-xl border p-1.5 md:min-h-[100px] md:rounded-2xl md:p-2 ${
      date
        ? isToday
          ? "border-[#5050b0] bg-[#141728]"
          : "border-[#1a1f3a] bg-[#0d0f1e]"
        : "border-transparent"
    }`}>
      {date && (
        <>
          <p className={`mb-1 text-right text-[11px] font-bold ${isToday ? "text-[#a090ff]" : "text-[#3a3a7a]"}`}>
            {date.getDate()}
          </p>
          <div className="space-y-0.5">
            {entries.map((e, i) => <CalendarEntry key={i} entry={e} />)}
          </div>
        </>
      )}
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
        const dateLabel = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        return (
          <div
            key={key}
            className={`rounded-2xl border p-3 ${
              isToday ? "border-[#5050b0] bg-[#141728]" : "border-[#1a1f3a] bg-[#0d0f1e]"
            }`}
          >
            <p className={`mb-2 text-xs font-bold ${isToday ? "text-[#a090ff]" : "text-[#8383e7]"}`}>
              {dateLabel}
            </p>
            <div className="space-y-1">
              {entries.map((e, i) => <CalendarEntry key={i} entry={e} />)}
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
      <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[#5050b0]">{label}</p>
      <ul className="space-y-2">
        {items.map((item) => renderItem(item))}
      </ul>
    </div>
  );
}

function FollowedSidebar({ shows, movies, unfollowShow, unfollowMovie }) {
  const empty = shows.length === 0 && movies.length === 0;
  return (
    <aside className="order-2 w-full md:order-1 md:w-[230px] md:flex-shrink-0 lg:w-[250px]">
      <div className="rounded-2xl border border-[#1a1f3a] bg-[#141728] p-4">
        <h2 className="mb-4 text-sm font-extrabold text-[#8383e7]">Followed</h2>
        {empty ? (
          <p className="text-xs text-[#4a4a7a]">Nothing followed yet.</p>
        ) : (
          <div className="space-y-4">
            <SidebarSection
              label="Shows"
              items={shows}
              renderItem={(show) => (
                <li key={show.id} className="flex items-center gap-2 text-xs">
                  <Link to={`/shows/${show.id}`} className="flex items-center gap-2 min-w-0 flex-1 transition hover:opacity-80">
                    <div className="h-10 w-7 flex-shrink-0 overflow-hidden rounded border border-[#2a3570] bg-[#12163a]">
                      {show.poster_path ? (
                        <img src={`${TMDB_IMG}${show.poster_path}`} alt={show.name} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[#3a3a7a]">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="6" width="20" height="14" rx="2" /></svg>
                        </div>
                      )}
                    </div>
                    <span className="truncate font-semibold text-[#c0c0e8]">{show.name}</span>
                  </Link>
                  <button
                    onClick={() => unfollowShow(show.id)}
                    className="flex-shrink-0 rounded-full border border-[#3a3a7a] bg-[#1a1d35] p-1 text-[#6868b8] transition hover:border-red-400 hover:text-red-300"
                    title="Unfollow"
                  >
                    <MinusIcon />
                  </button>
                </li>
              )}
            />
            <SidebarSection
              label="Movies"
              items={movies}
              renderItem={(movie) => (
                <li key={movie.id} className="flex items-center gap-2 text-xs">
                  <Link to={`/movies/${movie.id}`} className="flex items-center gap-2 min-w-0 flex-1 transition hover:opacity-80">
                    <div className="h-10 w-7 flex-shrink-0 overflow-hidden rounded border border-[#2a3570] bg-[#12163a]">
                      {movie.poster_path ? (
                        <img src={`${TMDB_IMG}${movie.poster_path}`} alt={movie.title} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[#3a3a7a]">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="6" width="20" height="14" rx="2" /></svg>
                        </div>
                      )}
                    </div>
                    <span className="truncate font-semibold text-[#e0c0e8]">{movie.title}</span>
                  </Link>
                  <button
                    onClick={() => unfollowMovie(movie.id)}
                    className="flex-shrink-0 rounded-full border border-[#3a3a7a] bg-[#1a1d35] p-1 text-[#6868b8] transition hover:border-red-400 hover:text-red-300"
                    title="Unfollow"
                  >
                    <MinusIcon />
                  </button>
                </li>
              )}
            />
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

  const { visibleShows, visibleMovies, calendarEntries, isLoading, unfollowShow, unfollowMovie } = useCalendarData(session, year, month);

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

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
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 md:flex-row md:items-start">
        {/* Followed sidebar — left column on md+, below on mobile */}
        <FollowedSidebar
          shows={visibleShows}
          movies={visibleMovies}
          unfollowShow={unfollowShow}
          unfollowMovie={unfollowMovie}
        />

        {/* Calendar main */}
        <div className="order-1 min-w-0 flex-1 rounded-2xl border border-[#1a1f3a] bg-[#141728] p-3 sm:p-4 md:order-2 md:p-5">
          {monthNav}

          {/* Grid view — md+ only */}
          <div className="hidden md:block">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAY_LABELS.map((d, i) => (
                <div key={d} className="rounded-xl border border-[#1a1f3a] py-2 text-center text-xs font-bold text-[#8383e7]">
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
              <div className="grid grid-cols-7 gap-1">
                {days.map((date, i) => {
                  const key = date ? toDateKey(date) : `empty-${i}`;
                  const entries = date ? (calendarEntries[toDateKey(date)] ?? []) : [];
                  return <DayCell key={key} date={date} entries={entries} />;
                })}
              </div>
            )}
          </div>

          {/* Agenda view — mobile only */}
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
        </div>

      </div>
    </AppLayout>
  );
}

export default ReleasesCalendarPage;
