import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import DetailPageLayout from "../../components/detail/DetailPageLayout.jsx";
import ContentPanel from "../../components/detail/ContentPanel.jsx";
import CastGrid from "../../components/detail/CastGrid.jsx";
import CrewSection from "../../components/detail/CrewSection.jsx";
import FollowButton from "../../components/detail/FollowButton.jsx";
import AuthPromptModal from "../../components/AuthPromptModal.jsx";
import { RatingSidebar } from "../../components/rating/RatingSidebar.jsx";
import { RatingHistogram } from "../../components/rating/RatingHistogram.jsx";
import { ObservedRatingsPanel } from "../../components/observe/ObservedRatingsPanel.jsx";
import SkeletonDetailPage from "../../components/detail/SkeletonDetailPage.jsx";
import { useEpisodeData } from "../../features/episode/hooks/useEpisodeData.js";
import { useShowFollow } from "../../features/show/hooks/useShowFollow.js";
import UpgradePromptToast from "../../components/subscription/UpgradePromptToast.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import { tmdbImg } from "../../lib/tmdbImage.js";

function fmt(val, fallback = "—") { return val ?? fallback; }

function fmtDate(val) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function SiblingRow({ ep, showId, seasonNumber }) {
  const imgSrc = tmdbImg(ep.poster_path, "w185");
  return (
    <Link
      to={`/shows/${showId}/seasons/${seasonNumber}/episodes/${ep.episode_number}`}
      className="flex items-center gap-3 rounded-xl border border-[#2a3570]/50 bg-[#0d0f1e] p-3 transition hover:border-[#3a3a7a] hover:bg-[#141728]"
    >
      <div className="h-12 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-[#2a3570] bg-[#12163a]">
        {imgSrc ? (
          <img src={imgSrc} alt={ep.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#3a3a7a]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="6" width="20" height="14" rx="2" /><path d="M8 6V4M16 6V4M2 10h20" /></svg>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[#6868b8]">Ep. {ep.episode_number}</p>
        <p className="font-semibold text-white leading-tight line-clamp-1">{ep.name}</p>
      </div>
      <svg className="flex-shrink-0 text-[#3a3a7a]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
    </Link>
  );
}

function EpisodePage({ session }) {
  const { id: showId, seasonNumber, episodeNumber } = useParams();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const { episode, season, show, siblings, cast, crew, isLoading, error } = useEpisodeData(showId, seasonNumber, episodeNumber);
  const { isFollowing, toggleFollow, followLimitError, clearFollowLimitError } = useShowFollow(showId, session);
  const handleFollow = session ? toggleFollow : () => setShowAuthPrompt(true);

  const breadcrumbs = episode && season && show ? [
    { label: "Shows", to: "/shows" },
    { label: show.name, to: `/shows/${showId}` },
    { label: season.name, to: `/shows/${showId}/seasons/${seasonNumber}` },
    { label: episode.name },
  ] : undefined;

  if (isLoading) return <AppLayout session={session}><SkeletonDetailPage /></AppLayout>;
  if (error) return <AppLayout session={session}><p className="text-center text-red-400 mt-12">{error}</p></AppLayout>;
  if (!episode || !season || !show) return null;

  const episodeJsonLd = {
    "@context": "https://schema.org",
    "@type": "TVEpisode",
    name: episode.name,
    episodeNumber: episode.episode_number,
    partOfSeason: { "@type": "TVSeason", seasonNumber: season.season_number },
    partOfSeries: { "@type": "TVSeries", name: show.name },
    ...(episode.overview && { description: episode.overview }),
    ...(episode.air_date && { datePublished: episode.air_date }),
  };

  const allEps = [...(season.episodes ?? [])].sort((a, b) => a.episode_number - b.episode_number);
  const totalEps = allEps.length;
  const currentEpIdx = allEps.findIndex((e) => e.episode_number === episode.episode_number);
  const prevEp = currentEpIdx > 0 ? allEps[currentEpIdx - 1] : null;
  const nextEp = currentEpIdx >= 0 && currentEpIdx < allEps.length - 1 ? allEps[currentEpIdx + 1] : null;

  const details = [
    ["Episode runtime", episode.runtime ? `${episode.runtime}m` : "—"],
    ["Air date", fmtDate(episode.air_date)],
    ["Episode number", `${episode.episode_number}${totalEps ? ` / ${totalEps}` : ""}`],
  ];

  const epThumb = (path) => tmdbImg(path, "w185");

  return (
    <AppLayout session={session} breadcrumbs={breadcrumbs}>
      <PageHead
        title={`${show.name} S${String(season.season_number).padStart(2, "0")}E${String(episode.episode_number).padStart(2, "0")} — ${episode.name}`}
        description={episode.overview?.slice(0, 155) || `${episode.name} · ${show.name}`}
        path={`/shows/${showId}/seasons/${seasonNumber}/episodes/${episodeNumber}`}
        jsonLd={episodeJsonLd}
      />
      {showAuthPrompt && <AuthPromptModal onClose={() => setShowAuthPrompt(false)} />}
      {followLimitError && <UpgradePromptToast message={followLimitError} onDismiss={clearFollowLimitError} session={session} />}
      <DetailPageLayout
        title={episode.name}
        followButton={<FollowButton isFollowing={isFollowing} onToggle={handleFollow} />}
        sidebarTop={
          <div className="relative overflow-hidden rounded-2xl border border-[#2a3570] bg-[#12163a] aspect-video w-full">
            {episode.poster_path ? (
              <img src={epThumb(episode.poster_path)} alt={episode.name} className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-[#181d40] to-[#0e1128]">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#3a3a7a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="6" width="20" height="14" rx="2" /><path d="M8 6V4M16 6V4M2 10h20" />
                </svg>
                <span className="text-center text-sm font-medium leading-tight text-[#3a3a7a]">{episode.name}</span>
              </div>
            )}
          </div>
        }
        sidebarBottom={
          <>
            <ul className="space-y-1.5 text-xs">
              {[
                ["Title", fmt(episode.name)],
                ["Runtime", episode.runtime ? `${episode.runtime}m` : "—"],
                ["Episode", `${episode.episode_number}${totalEps ? ` / ${totalEps}` : ""}`],
              ].map(([k, v]) => (
                <li key={k}><span className="font-bold text-[#8383e7]">{k}:</span> <span className="text-[#c0c0e8]">{v}</span></li>
              ))}
            </ul>
            <RatingSidebar
              mediaType="episode"
              entityId={episode.id}
              tmdbShowId={show.tmdb_id}
              seasonNumber={season.season_number}
              episodeNumber={episode.episode_number}
              session={session}
              onAuthPrompt={() => setShowAuthPrompt(true)}
              isUnreleased={!!(episode.air_date && new Date(episode.air_date) > new Date())}
            />
            <ObservedRatingsPanel mediaType="episode" entityId={episode.id} session={session} />
            <RatingHistogram mediaType="episode" entityId={episode.id} />
          </>
        }
      >
        <ContentPanel label="Details">
          <ul className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
            {details.map(([k, v]) => (
              <li key={k}><span className="font-semibold text-[#8383e7]">{k}:</span> <span className="text-[#c0c0e8]">{v}</span></li>
            ))}
          </ul>
        </ContentPanel>

        {episode.overview && (
          <ContentPanel label="Overview">
            <p className="text-sm leading-relaxed text-[#c0c0e8]">{episode.overview}</p>
          </ContentPanel>
        )}

        {(prevEp || nextEp) && (
          <div className="flex gap-3">
            {prevEp && (
              <Link
                to={`/shows/${showId}/seasons/${seasonNumber}/episodes/${prevEp.episode_number}`}
                className="flex-1 flex items-center gap-3 rounded-xl border border-[#2a3570]/50 bg-[#0d0f1e] p-3 transition hover:border-[#3a3a7a] hover:bg-[#141728]"
              >
                <div className="h-16 w-28 flex-shrink-0 overflow-hidden rounded-lg border border-[#2a3570] bg-[#12163a]">
                  {prevEp.poster_path ? (
                    <img src={epThumb(prevEp.poster_path)} alt={prevEp.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[#3a3a7a]">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="6" width="20" height="14" rx="2" /><path d="M8 6V4M16 6V4M2 10h20" /></svg>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-[#6868b8]">Prev episode</p>
                  <p className="text-xs font-semibold text-white line-clamp-2">Ep. {prevEp.episode_number}: {prevEp.name}</p>
                </div>
                <svg className="flex-shrink-0 text-[#3a3a7a]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
              </Link>
            )}
            {nextEp && (
              <Link
                to={`/shows/${showId}/seasons/${seasonNumber}/episodes/${nextEp.episode_number}`}
                className="flex-1 flex items-center gap-3 rounded-xl border border-[#2a3570]/50 bg-[#0d0f1e] p-3 transition hover:border-[#3a3a7a] hover:bg-[#141728]"
              >
                <svg className="flex-shrink-0 text-[#3a3a7a]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-[#6868b8]">Next episode</p>
                  <p className="text-xs font-semibold text-white line-clamp-2">Ep. {nextEp.episode_number}: {nextEp.name}</p>
                </div>
                <div className="h-16 w-28 flex-shrink-0 overflow-hidden rounded-lg border border-[#2a3570] bg-[#12163a]">
                  {nextEp.poster_path ? (
                    <img src={epThumb(nextEp.poster_path)} alt={nextEp.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[#3a3a7a]">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="6" width="20" height="14" rx="2" /><path d="M8 6V4M16 6V4M2 10h20" /></svg>
                    </div>
                  )}
                </div>
              </Link>
            )}
          </div>
        )}

        {siblings.length > 0 && (
          <ContentPanel label="Other Episodes">
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {siblings.map((ep) => (
                <SiblingRow key={ep.id} ep={ep} showId={showId} seasonNumber={seasonNumber} />
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

export default EpisodePage;
