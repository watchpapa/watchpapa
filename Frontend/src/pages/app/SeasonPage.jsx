import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import DetailPageLayout from "../../components/detail/DetailPageLayout.jsx";
import PosterCard from "../../components/detail/PosterCard.jsx";
import ContentPanel from "../../components/detail/ContentPanel.jsx";
import CastGrid from "../../components/detail/CastGrid.jsx";
import CrewSection from "../../components/detail/CrewSection.jsx";
import FollowButton from "../../components/detail/FollowButton.jsx";
import AuthPromptModal from "../../components/AuthPromptModal.jsx";
import SkeletonDetailPage from "../../components/detail/SkeletonDetailPage.jsx";
import { useSeasonData } from "../../features/season/hooks/useSeasonData.js";
import { useShowFollow } from "../../features/show/hooks/useShowFollow.js";
import UpgradePromptToast from "../../components/subscription/UpgradePromptToast.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";

const TMDB_IMG = "https://image.tmdb.org/t/p/w185";

function fmt(val, fallback = "—") { return val ?? fallback; }

function fmtDate(val) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}


function EpisodeRow({ episode, showId, seasonId }) {
  const imgSrc = episode.poster_path ? `${TMDB_IMG}${episode.poster_path}` : null;

  return (
    <Link
      to={`/shows/${showId}/seasons/${seasonId}/episodes/${episode.id}`}
      className="flex items-center gap-3 rounded-xl border border-[#1a1f3a] bg-[#0d0f1e] p-3 transition hover:border-[#3a3a7a] hover:bg-[#141728]"
    >
      <div className="h-14 w-24 flex-shrink-0 overflow-hidden rounded-lg border border-[#2a3570] bg-[#12163a]">
        {imgSrc ? (
          <img src={imgSrc} alt={episode.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#3a3a7a]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="6" width="20" height="14" rx="2" /><path d="M8 6V4M16 6V4M2 10h20" /></svg>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[#6868b8]">Ep. {episode.episode_number}</p>
        <p className="font-semibold text-white leading-tight">{episode.name}</p>
        {episode.air_date && <p className="text-xs text-[#6868b8]">{fmtDate(episode.air_date)}</p>}
      </div>
      {episode.runtime && <p className="flex-shrink-0 text-xs text-[#6868b8]">{episode.runtime}m</p>}
      <svg className="flex-shrink-0 text-[#3a3a7a]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
    </Link>
  );
}

function SeasonPage({ session }) {
  const { id: showId, seasonId } = useParams();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const { season, show, episodes, cast, crew, isLoading, error } = useSeasonData(seasonId, showId);
  const { isFollowing, toggleFollow, followLimitError, clearFollowLimitError } = useShowFollow(showId, session);
  const handleFollow = session ? toggleFollow : () => setShowAuthPrompt(true);

  const breadcrumbs = season && show ? [
    { label: "Shows", to: "/shows" },
    { label: show.name, to: `/shows/${showId}` },
    { label: season.name },
  ] : undefined;

  if (isLoading) return <AppLayout session={session}><SkeletonDetailPage /></AppLayout>;
  if (error) return <AppLayout session={session}><p className="text-center text-red-400 mt-12">{error}</p></AppLayout>;
  if (!season || !show) return null;

  const details = [
    ["Air date", fmtDate(season.air_date)],
    ["Number of episodes", fmt(episodes.length || season.episode?.length)],
    ["Season number", fmt(season.season_number)],
  ];

  return (
    <AppLayout session={session} breadcrumbs={breadcrumbs}>
      <PageHead
        title={`${show.name} — ${season.name}`}
        description={season.overview?.slice(0, 155) || `Season ${season.season_number} of ${show.name} on watchpapa.`}
        path={`/shows/${showId}/seasons/${seasonId}`}
      />
      {showAuthPrompt && <AuthPromptModal onClose={() => setShowAuthPrompt(false)} />}
      {followLimitError && <UpgradePromptToast message={followLimitError} onDismiss={clearFollowLimitError} session={session} />}
      <DetailPageLayout
        title={season.name}
        followButton={<FollowButton isFollowing={isFollowing} onToggle={handleFollow} />}
        sidebarTop={<PosterCard title={season.name} posterPath={season.poster_path} />}
        sidebarBottom={
          <ul className="space-y-1.5 text-xs">
            {[
              ["Title", fmt(season.name)],
              ["Episodes", fmt(episodes.length)],
              ["Air date", fmtDate(season.air_date)],
            ].map(([k, v]) => (
              <li key={k}><span className="font-bold text-[#8383e7]">{k}:</span> <span className="text-[#c0c0e8]">{v}</span></li>
            ))}
          </ul>
        }
      >
        <ContentPanel label="Details">
          <ul className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
            {details.map(([k, v]) => (
              <li key={k}><span className="font-semibold text-[#8383e7]">{k}:</span> <span className="text-[#c0c0e8]">{v}</span></li>
            ))}
          </ul>
        </ContentPanel>

        {season.overview && (
          <ContentPanel label="Overview">
            <p className="text-sm leading-relaxed text-[#c0c0e8]">{season.overview}</p>
          </ContentPanel>
        )}

        {episodes.length > 0 && (
          <ContentPanel label="Episodes">
            <div className="space-y-2">
              {episodes.map((ep) => (
                <EpisodeRow key={ep.id} episode={ep} showId={showId} seasonId={seasonId} />
              ))}
            </div>
          </ContentPanel>
        )}

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
