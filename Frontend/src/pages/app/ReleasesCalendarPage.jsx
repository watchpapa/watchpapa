import { useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import { useCalendarData } from "../../features/calendar/hooks/useCalendarData.js";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

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
    return (
      <Link
        to={`/shows/${entry.showId}/seasons/${entry.seasonId}/episodes/${entry.id}`}
        className="block truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight text-[#c0c0e8] transition hover:bg-[#2a2d60] hover:text-white"
        title={`${entry.showName}: ${entry.name}`}
      >
        {entry.showName}
        {entry.runtime ? ` ${entry.runtime}m` : ""}
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
    <div className={`min-h-[100px] rounded-2xl border p-2 ${
      date
        ? isToday
          ? "border-[#5050b0] bg-[#141728]"
          : "border-[#1a1f3a] bg-[#0d0f1e]"
        : "border-transparent"
    }`}>
      {date && (
        <>
          <p className={`mb-1 text-right text-xs font-bold ${isToday ? "text-[#a090ff]" : "text-[#3a3a7a]"}`}>
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

function FollowedSidebar({ shows, movies, unfollowShow, unfollowMovie }) {
  return (
    <aside className="w-[220px] flex-shrink-0">
      <div className="rounded-2xl border border-[#1a1f3a] bg-[#141728] p-4">
        <h2 className="mb-3 text-sm font-extrabold text-[#8383e7]">Followed</h2>
        {shows.length === 0 && movies.length === 0 ? (
          <p className="text-xs text-[#4a4a7a]">Nothing followed yet.</p>
        ) : (
          <ul className="space-y-2">
            {shows.map((show) => (
              <li key={`show-${show.id}`} className="flex items-center justify-between gap-2 text-xs">
                <Link to={`/shows/${show.id}`} className="truncate font-semibold text-[#c0c0e8] hover:text-white transition">
                  {show.name}
                </Link>
                <button
                  onClick={() => unfollowShow(show.id)}
                  className="flex-shrink-0 rounded-full border border-[#3a3a7a] bg-[#1a1d35] p-1 text-[#6868b8] transition hover:border-red-400 hover:text-red-300"
                  title="Unfollow"
                >
                  <MinusIcon />
                </button>
              </li>
            ))}
            {movies.map((movie) => (
              <li key={`movie-${movie.id}`} className="flex items-center justify-between gap-2 text-xs">
                <Link to={`/movies/${movie.id}`} className="truncate font-semibold text-[#e0c0e8] hover:text-white transition">
                  {movie.title}
                </Link>
                <button
                  onClick={() => unfollowMovie(movie.id)}
                  className="flex-shrink-0 rounded-full border border-[#3a3a7a] bg-[#1a1d35] p-1 text-[#6868b8] transition hover:border-red-400 hover:text-red-300"
                  title="Unfollow"
                >
                  <MinusIcon />
                </button>
              </li>
            ))}
          </ul>
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

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  const days = buildCalendarDays(year, month);

  return (
    <AppLayout session={session}>
      <div className="mx-auto max-w-[1400px] flex gap-5">
        <FollowedSidebar
          shows={visibleShows}
          movies={visibleMovies}
          unfollowShow={unfollowShow}
          unfollowMovie={unfollowMovie}
        />

        <div className="min-w-0 flex-1 rounded-2xl border border-[#1a1f3a] bg-[#141728] p-5">
          <div className="mb-5 flex items-center justify-center gap-4">
            <button
              onClick={prevMonth}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#3a3a7a] bg-[#1a1d35] text-[#8888c8] transition hover:border-[#6060b0] hover:text-white"
            >
              <ChevronLeft />
            </button>
            <div className="flex min-w-[240px] flex-col items-center gap-1">
              <h2 className="text-xl font-extrabold text-white">
                {MONTH_NAMES[month - 1]} {year}
              </h2>
              {(year !== now.getFullYear() || month !== now.getMonth() + 1) && (
                <button
                  onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1); }}
                  className="text-xs font-semibold text-[#8383e7] hover:text-white transition"
                >
                  Back to current month
                </button>
              )}
            </div>
            <button
              onClick={nextMonth}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#3a3a7a] bg-[#1a1d35] text-[#8888c8] transition hover:border-[#6060b0] hover:text-white"
            >
              <ChevronRight />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAY_LABELS.map((d) => (
              <div key={d} className="rounded-xl border border-[#1a1f3a] py-2 text-center text-xs font-bold text-[#8383e7]">
                {d}
              </div>
            ))}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="min-h-[100px] animate-pulse rounded-2xl bg-[#1e2240]" />
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
      </div>
    </AppLayout>
  );
}

export default ReleasesCalendarPage;
