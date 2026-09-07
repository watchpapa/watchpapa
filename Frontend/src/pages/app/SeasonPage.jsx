import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import DetailPageLayout from "../../components/detail/DetailPageLayout.jsx";
import PosterCard from "../../components/detail/PosterCard.jsx";
import ContentPanel from "../../components/detail/ContentPanel.jsx";
import CastGrid from "../../components/detail/CastGrid.jsx";
import CrewSection from "../../components/detail/CrewSection.jsx";
import FollowButton from "../../components/detail/FollowButton.jsx";
import MediaActionPanel from "../../components/detail/MediaActionPanel.jsx";
import AuthPromptModal from "../../components/AuthPromptModal.jsx";
import SkeletonDetailPage from "../../components/detail/SkeletonDetailPage.jsx";
import { useSeasonData } from "../../features/season/hooks/useSeasonData.js";
import { useShowFollow } from "../../features/show/hooks/useShowFollow.js";
import { showFollowBlock } from "../../lib/followGate.js";
import UpgradePromptToast from "../../components/subscription/UpgradePromptToast.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import ErrorNote from "../../components/ui/ErrorNote.jsx";
import { tmdbImg } from "../../lib/tmdbImage.js";
import { ChevronLeftIcon, ChevronRightIcon, TvIcon } from "../../components/icons/index.jsx";

function fmt(val, fallback = "—") { return val ?? fallback; }

function fmtDate(val) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function EpisodeRow({ episode, showId, seasonNumber }) {
  const imgSrc = tmdbImg(episode.poster_path, "w185");
  return (
    <Link
      to={`/shows/${showId}/seasons/${seasonNumber}/episodes/${episode.episode_number}`}
      className="flex items-center gap-3 rounded-xl border border-border/50 bg-surface p-3 transition hover:border-border-strong hover:bg-surface-2"
    >
      <div className="h-14 w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-4">
        {imgSrc ? (
          <img src={imgSrc} alt={episode.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-border-strong"><TvIcon size={16} /></div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-text-dim">Ep. {episode.episode_number}{episode.runtime ? ` · ${episode.runtime}m` : ""}</p>
        <p className="font-semibold leading-tight text-white">{episode.name}</p>
        {episode.air_date && <p className="text-xs text-text-dim">{fmtDate(episode.air_date)}</p>}
      </div>
      <ChevronRightIcon size={16} className="shrink-0 text-border-strong" />
    </Link>
  );
}

function NavCard({ to, label, title, dir }) {
  return (
    <Link to={to} className="flex flex-1 items-center gap-3 rounded-xl border border-border/50 bg-surface p-3 transition hover:border-border-strong hover:bg-surface-2">
      {dir === "prev" && <ChevronLeftIcon size={16} className="shrink-0 text-border-strong" />}
      <div className={`min-w-0 flex-1 ${dir === "next" ? "text-right" : ""}`}>
        <p className="text-[10px] uppercase tracking-wider text-text-dim">{label}</p>
        <p className="line-clamp-1 text-xs font-semibold text-white">{title}</p>
      </div>
      {dir === "next" && <ChevronRightIcon size={16} className="shrink-0 text-border-strong" />}
    </Link>
  );
}

function SeasonPage({ session }) {
  const { id: showId, seasonNumber } = useParams();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const { season, show, episodes, seasons, cast, crew, isLoading, error } = useSeasonData(showId, seasonNumber);
  const followBlockedLabel = showFollowBlock(show);
  const { isFollowing, toggleFollow, followLimitError, clearFollowLimitError } = useShowFollow(showId, session, { blocked: !!followBlockedLabel });
  const handleFollow = session ? toggleFollow : () => setShowAuthPrompt(true);

  const currentIdx = seasons.findIndex((s) => s.season_number === season?.season_number);
  const prevSeason = currentIdx > 0 ? seasons[currentIdx - 1] : null;
  const nextSeason = currentIdx >= 0 && currentIdx < seasons.length - 1 ? seasons[currentIdx + 1] : null;

  const breadcrumbs = [
    { label: "Shows", to: "/shows" },
    { label: show?.name ?? "Show", to: `/shows/${showId}` },
    ...(season ? [{ label: season.name }] : []),
  ];

  if (isLoading) return <AppLayout session={session} breadcrumbs={breadcrumbs}><SkeletonDetailPage /></AppLayout>;
  if (error) return <AppLayout session={session} breadcrumbs={breadcrumbs}><ErrorNote className="mt-12">{error}</ErrorNote></AppLayout>;
  if (!season || !show) return null;

  const episodeCount = episodes.length || season.episodes?.length || 0;
  const details = [
    ["Air date", fmtDate(season.air_date)],
    ["Episodes", fmt(episodeCount)],
    ["Season number", fmt(season.season_number)],
  ];
  const meta = [
    season.air_date && <span key="y">{new Date(season.air_date).getFullYear()}</span>,
    episodeCount > 0 && <span key="e">{episodeCount} episode{episodeCount !== 1 ? "s" : ""}</span>,
  ];

  return (
    <AppLayout session={session} breadcrumbs={breadcrumbs}>
      <PageHead
        title={`${show.name} — ${season.name}`}
        description={season.overview?.slice(0, 155) || `Season ${season.season_number} of ${show.name} on watchpapa.`}
        path={`/shows/${showId}/seasons/${seasonNumber}`}
      />
      {showAuthPrompt && <AuthPromptModal onClose={() => setShowAuthPrompt(false)} />}
      {followLimitError && <UpgradePromptToast message={followLimitError} onDismiss={clearFollowLimitError} session={session} />}
      <DetailPageLayout
        title={season.name}
        subtitle={<Link to={`/shows/${showId}`} className="hover:text-white">{show.name}</Link>}
        meta={meta}
        backdropPath={show.backdrop_path}
        poster={<PosterCard title={season.name} posterPath={season.poster_path} />}
        actions={<FollowButton isFollowing={isFollowing} onToggle={handleFollow} blockedLabel={followBlockedLabel} />}
        panel={
          <MediaActionPanel
            session={session}
            onAuthPrompt={() => setShowAuthPrompt(true)}
            rating={{
              mediaType: "season",
              entityId: season.id,
              tmdbShowId: show.tmdb_id,
              seasonNumber: season.season_number,
              isUnreleased: !!(season.air_date && new Date(season.air_date) > new Date()),
            }}
          />
        }
      >
        {season.overview && (
          <ContentPanel label="Overview">
            <p className="text-sm leading-relaxed text-text">{season.overview}</p>
          </ContentPanel>
        )}

        {(prevSeason || nextSeason) && (
          <div className="flex gap-3">
            {prevSeason && <NavCard dir="prev" label="Previous season" title={prevSeason.name} to={`/shows/${showId}/seasons/${prevSeason.season_number}`} />}
            {nextSeason && <NavCard dir="next" label="Next season" title={nextSeason.name} to={`/shows/${showId}/seasons/${nextSeason.season_number}`} />}
          </div>
        )}

        {episodes.length > 0 && (
          <ContentPanel label="Episodes">
            <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
              {episodes.map((ep) => <EpisodeRow key={ep.id} episode={ep} showId={showId} seasonNumber={seasonNumber} />)}
            </div>
          </ContentPanel>
        )}

        <ContentPanel label="Details">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {details.map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="shrink-0 font-semibold text-heading">{k}:</dt>
                <dd className="min-w-0 text-text">{v}</dd>
              </div>
            ))}
          </dl>
        </ContentPanel>

        {cast.length > 0 && (
          <ContentPanel label="Cast">
            <CastGrid credits={cast} />
          </ContentPanel>
        )}

        {crew.length > 0 && (
          <ContentPanel label="Crew">
            <CrewSection crew={crew} />
          </ContentPanel>
        )}
      </DetailPageLayout>
    </AppLayout>
  );
}

export default SeasonPage;
