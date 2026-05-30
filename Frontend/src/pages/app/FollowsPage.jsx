import { useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import { useFollows } from "../../features/follows/hooks/useFollows.js";
import { useSubscription } from "../../features/subscription/hooks/useSubscription.js";
import { OverLimitBanner } from "../../components/ui/OverLimitBanner.jsx";

const TIER_LIMITS = {
  free:     { type: "separate", shows: 3, movies: 1 },
  premium:  { type: "combined", total: 10 },
  pro:      { type: "separate", shows: 100, movies: 100 },
  pro_plus: { type: "separate", shows: 100, movies: 100 },
  god:      { type: "unlimited" },
};

const TMDB_IMG = "https://image.tmdb.org/t/p/w185";

function UnfollowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function FollowCard({ title, poster, year, to, onUnfollow, unfollowing }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#1a1f3a] bg-[#0a0c18] p-3 transition hover:border-[#2a2f5a]">
      <Link to={to} className="shrink-0">
        <div className="h-16 w-11 overflow-hidden rounded-lg border border-[#2a3570] bg-[#0d0f1e]">
          {poster ? (
            <img src={`${TMDB_IMG}${poster}`} alt={title} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full items-center justify-center text-[#3a3a7a]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="6" width="20" height="14" rx="2" />
                <path d="M8 6V4M16 6V4M2 10h20" />
              </svg>
            </div>
          )}
        </div>
      </Link>
      <div className="min-w-0 flex-1">
        <Link to={to}>
          <p className="font-semibold text-white transition hover:text-[#a090ff] truncate">{title}</p>
        </Link>
        {year && <p className="text-xs text-[#6868b8]">{year}</p>}
      </div>
      <button
        onClick={onUnfollow}
        disabled={unfollowing}
        className="flex items-center gap-1.5 rounded-xl border border-[#3a3a7a] px-2.5 py-1.5 text-xs font-semibold text-[#a0a0e8] transition hover:border-red-800/60 hover:text-red-400 disabled:opacity-40"
        title="Unfollow"
      >
        <UnfollowIcon />
        <span className="hidden sm:inline">Unfollow</span>
      </button>
    </div>
  );
}

function FollowsPage({ session }) {
  const { shows, movies, loading, unfollowShow, unfollowMovie } = useFollows(session);
  const { tier } = useSubscription(session);
  const [tab, setTab] = useState("shows");
  const [unfollowing, setUnfollowing] = useState(new Set());

  const handleUnfollowShow = async (showId) => {
    setUnfollowing((prev) => new Set(prev).add(showId));
    await unfollowShow(showId);
    setUnfollowing((prev) => { const n = new Set(prev); n.delete(showId); return n; });
  };

  const handleUnfollowMovie = async (movieId) => {
    setUnfollowing((prev) => new Set(prev).add(movieId));
    await unfollowMovie(movieId);
    setUnfollowing((prev) => { const n = new Set(prev); n.delete(movieId); return n; });
  };

  // Derive overage live from reactive arrays — updates immediately on each unfollow.
  const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.free;
  const isCombined = limits.type === "combined";
  const totalFollows = shows.length + movies.length;
  const showsOver  = limits.type === "separate" && shows.length  > limits.shows;
  const moviesOver = limits.type === "separate" && movies.length > limits.movies;
  const combinedOver = isCombined && totalFollows > limits.total;
  const isOverFollowLimit = limits.type !== "unlimited" && (showsOver || moviesOver || combinedOver);

  return (
    <AppLayout session={session} breadcrumbs={[{ label: "Follows" }]}>
      <PageHead title="Follows — watchpapa" path="/follows" />

      <div className="mx-auto max-w-2xl py-6 px-4 sm:px-0">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Follows</h1>
          <span className={`text-sm ${isOverFollowLimit ? "text-amber-400" : "text-[#5050a0]"}`}>
            {isCombined
              ? `${totalFollows} / ${limits.total}`
              : `${shows.length} shows · ${movies.length} movies`}
          </span>
        </div>

        {/* Overage banner — derived from live arrays, updates on each unfollow */}
        {isOverFollowLimit && (
          <>
            {combinedOver && (
              <OverLimitBanner type="follows" current={totalFollows} limit={limits.total} tier={tier} />
            )}
            {showsOver && (
              <OverLimitBanner type="follows" current={shows.length} limit={limits.shows} tier={tier} />
            )}
            {moviesOver && (
              <OverLimitBanner type="follows" current={movies.length} limit={limits.movies} tier={tier} />
            )}
          </>
        )}

        {/* Tabs */}
        <div className="mb-4 flex gap-1 rounded-xl border border-[#1a1f3a] bg-[#0a0c18] p-1">
          {[
            { key: "shows", label: `Shows (${shows.length})` },
            { key: "movies", label: `Movies (${movies.length})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                tab === key
                  ? "bg-[#1a1d35] text-white"
                  : "text-[#6868b8] hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-[#1a1f3a]" />
            ))}
          </div>
        )}

        {!loading && tab === "shows" && (
          <div className="space-y-2">
            {shows.length === 0 && (
              <p className="text-sm text-[#4a4a7a]">
                No followed shows.{" "}
                <Link to="/shows" className="text-[#8383e7] hover:text-white">Browse shows →</Link>
              </p>
            )}
            {shows.map((row) => (
              <FollowCard
                key={row.show_id}
                title={row.show?.name ?? "Unknown"}
                poster={row.show?.poster_path}
                year={row.show?.first_air_date?.slice(0, 4)}
                to={`/shows/${row.show_id}`}
                onUnfollow={() => handleUnfollowShow(row.show_id)}
                unfollowing={unfollowing.has(row.show_id)}
              />
            ))}
          </div>
        )}

        {!loading && tab === "movies" && (
          <div className="space-y-2">
            {movies.length === 0 && (
              <p className="text-sm text-[#4a4a7a]">
                No followed movies.{" "}
                <Link to="/movies" className="text-[#8383e7] hover:text-white">Browse movies →</Link>
              </p>
            )}
            {movies.map((row) => (
              <FollowCard
                key={row.movie_id}
                title={row.movie?.title ?? "Unknown"}
                poster={row.movie?.poster_path}
                year={row.movie?.release_date?.slice(0, 4)}
                to={`/movies/${row.movie_id}`}
                onUnfollow={() => handleUnfollowMovie(row.movie_id)}
                unfollowing={unfollowing.has(row.movie_id)}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default FollowsPage;
