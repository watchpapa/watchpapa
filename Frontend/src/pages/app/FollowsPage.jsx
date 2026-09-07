import { useState } from "react";
import { Link } from "react-router-dom";
import { useSearchParamState } from "../../hooks/index.js";
import AppLayout from "../../layouts/AppLayout.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import PageContainer from "../../components/ui/PageContainer.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import PillTabs from "../../components/ui/PillTabs.jsx";
import Button from "../../components/ui/Button.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import { Skeleton } from "../../components/ui/Skeleton.jsx";
import { OverLimitBanner } from "../../components/ui/OverLimitBanner.jsx";
import { useFollows } from "../../features/follows/hooks/useFollows.js";
import { useCurrentUser } from "../../features/profile/CurrentUserContext.jsx";
import { tmdbImg } from "../../lib/tmdbImage.js";
import { movieLifecycleLabel, showStatusInfo } from "../../lib/followGate.js";
import { FilmIcon, HeartIcon, XIcon } from "../../components/icons/index.jsx";

const TIER_LIMITS = {
  free: { type: "separate", shows: 3, movies: 1 },
  premium: { type: "combined", total: 10 },
  pro: { type: "separate", shows: 100, movies: 100 },
  pro_plus: { type: "separate", shows: 100, movies: 100 },
  god: { type: "unlimited" },
};

function FollowCard({ title, poster, year, to, onUnfollow, unfollowing, chip }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-surface p-3 transition hover:border-border-strong">
      <Link to={to} className="shrink-0">
        <div className="h-16 w-11 overflow-hidden rounded-lg border border-border bg-surface-4">
          {poster ? <img src={tmdbImg(poster, "w185")} alt={title} className="h-full w-full object-cover" loading="lazy" /> : <div className="flex h-full items-center justify-center text-border-strong"><FilmIcon size={14} /></div>}
        </div>
      </Link>
      <div className="min-w-0 flex-1">
        <Link to={to} className="block truncate font-semibold text-white transition hover:text-[#a090ff]">{title}</Link>
        <div className="flex items-center gap-2">
          {year && <p className="text-xs text-text-dim">{year}</p>}
          {chip && <span className={`text-[10px] font-bold uppercase tracking-wide ${chip.color}`}>{chip.text}</span>}
        </div>
      </div>
      <Button variant="outline" size="sm" icon={XIcon} onClick={onUnfollow} loading={unfollowing} className="hover:border-red-800/60 hover:text-red-300" aria-label={`Unfollow ${title}`}>
        <span className="hidden sm:inline">Unfollow</span>
      </Button>
    </div>
  );
}

function FollowsPage({ session }) {
  const { shows, movies, loading, unfollowShow, unfollowMovie } = useFollows(session);
  const { tier } = useCurrentUser();
  const [tab, setTab] = useSearchParamState("tab", "shows");
  const [unfollowing, setUnfollowing] = useState(new Set());

  const wrap = (fn) => async (id) => {
    setUnfollowing((prev) => new Set(prev).add(id));
    await fn(id);
    setUnfollowing((prev) => { const n = new Set(prev); n.delete(id); return n; });
  };
  const handleUnfollowShow = wrap(unfollowShow);
  const handleUnfollowMovie = wrap(unfollowMovie);

  const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.free;
  const isCombined = limits.type === "combined";
  const totalFollows = shows.length + movies.length;
  const showsOver = limits.type === "separate" && shows.length > limits.shows;
  const moviesOver = limits.type === "separate" && movies.length > limits.movies;
  const combinedOver = isCombined && totalFollows > limits.total;
  const isOverFollowLimit = limits.type !== "unlimited" && (showsOver || moviesOver || combinedOver);

  const list = tab === "shows" ? shows : movies;

  return (
    <AppLayout session={session} breadcrumbs={[{ label: "Follows" }]}>
      <PageHead title="Follows — watchpapa" path="/follows" noindex />
      <PageContainer width="reading">
        <PageHeader
          title="Follows"
          subtitle={isCombined ? `${totalFollows} of ${limits.total} follows used` : `${shows.length} shows · ${movies.length} movies`}
          badge={isOverFollowLimit ? <span className="ml-2 text-sm font-semibold text-amber-400">over limit</span> : null}
        >
          <PillTabs
            aria-label="Follow type"
            fill
            tabs={[
              { value: "shows", label: "Shows", count: shows.length },
              { value: "movies", label: "Movies", count: movies.length },
            ]}
            value={tab}
            onChange={setTab}
          />
        </PageHeader>

        {isOverFollowLimit && (
          <>
            {combinedOver && <OverLimitBanner type="follows" current={totalFollows} limit={limits.total} tier={tier} />}
            {showsOver && <OverLimitBanner type="follows" current={shows.length} limit={limits.shows} tier={tier} />}
            {moviesOver && <OverLimitBanner type="follows" current={movies.length} limit={limits.movies} tier={tier} />}
          </>
        )}

        {loading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-[5.5rem] rounded-xl" />)}</div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={HeartIcon}
            title={tab === "shows" ? "No followed shows" : "No followed movies"}
            description="Follow upcoming titles to see their release dates on the Releases Radar."
            action={<Button to={tab === "shows" ? "/shows" : "/movies"} variant="secondary" size="sm">Browse {tab}</Button>}
            className="rounded-2xl border border-border/50 bg-surface"
          />
        ) : (
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {tab === "shows"
              ? shows.map((row) => (
                  <FollowCard key={row.show_id} title={row.show?.name ?? "Unknown"} poster={row.show?.poster_path} year={row.show?.first_air_date?.slice(0, 4)} to={`/shows/${row.show_id}`} onUnfollow={() => handleUnfollowShow(row.show_id)} unfollowing={unfollowing.has(row.show_id)} chip={showStatusInfo(row.show?.status)} />
                ))
              : movies.map((row) => (
                  <FollowCard key={row.movie_id} title={row.movie?.title ?? "Unknown"} poster={row.movie?.poster_path} year={row.movie?.release_date?.slice(0, 4)} to={`/movies/${row.movie_id}`} onUnfollow={() => handleUnfollowMovie(row.movie_id)} unfollowing={unfollowing.has(row.movie_id)} chip={row.movie ? movieLifecycleLabel(row.movie) : null} />
                ))}
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}

export default FollowsPage;
