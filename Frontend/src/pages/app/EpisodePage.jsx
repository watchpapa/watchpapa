import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import DetailPageLayout from "../../components/detail/DetailPageLayout.jsx";
import ContentPanel from "../../components/detail/ContentPanel.jsx";
import CastGrid from "../../components/detail/CastGrid.jsx";
import CrewSection from "../../components/detail/CrewSection.jsx";
import FollowButton from "../../components/detail/FollowButton.jsx";
import MediaActionPanel from "../../components/detail/MediaActionPanel.jsx";
import AuthPromptModal from "../../components/AuthPromptModal.jsx";
import SkeletonDetailPage from "../../components/detail/SkeletonDetailPage.jsx";
import { useEpisodeData } from "../../features/episode/hooks/useEpisodeData.js";
import { useShowFollow } from "../../features/show/hooks/useShowFollow.js";
import { showFollowBlock } from "../../lib/followGate.js";
import UpgradePromptToast from "../../components/subscription/UpgradePromptToast.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import ErrorNote from "../../components/ui/ErrorNote.jsx";
import { tmdbImg } from "../../lib/tmdbImage.js";
import { ChevronLeftIcon, ChevronRightIcon, TvIcon } from "../../components/icons/index.jsx";

function fmtDate(val) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function Still({ path, alt, className = "" }) {
  const src = tmdbImg(path, "w185");
  return (
    <div className={`shrink-0 overflow-hidden rounded-lg border border-border bg-surface-4 ${className}`}>
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-border-strong"><TvIcon size={16} /></div>
      )}
    </div>
  );
}

function SiblingRow({ ep, showId, seasonNumber }) {
  return (
    <Link
      to={`/shows/${showId}/seasons/${seasonNumber}/episodes/${ep.episode_number}`}
      className="flex items-center gap-3 rounded-xl border border-border/50 bg-surface p-3 transition hover:border-border-strong hover:bg-surface-2"
    >
      <Still path={ep.poster_path} alt={ep.name} className="h-12 w-20" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-text-dim">Ep. {ep.episode_number}</p>
        <p className="line-clamp-1 font-semibold leading-tight text-white">{ep.name}</p>
      </div>
      <ChevronRightIcon size={16} className="shrink-0 text-border-strong" />
    </Link>
  );
}

function NavCard({ to, label, ep, dir }) {
  return (
    <Link to={to} className="flex flex-1 items-center gap-3 rounded-xl border border-border/50 bg-surface p-3 transition hover:border-border-strong hover:bg-surface-2">
      {dir === "prev" && <ChevronLeftIcon size={16} className="shrink-0 text-border-strong" />}
      {dir === "prev" && <Still path={ep.poster_path} alt={ep.name} className="hidden h-14 w-24 sm:block" />}
      <div className={`min-w-0 flex-1 ${dir === "next" ? "text-right" : ""}`}>
        <p className="text-[10px] uppercase tracking-wider text-text-dim">{label}</p>
        <p className="line-clamp-2 text-xs font-semibold text-white">Ep. {ep.episode_number}: {ep.name}</p>
      </div>
      {dir === "next" && <Still path={ep.poster_path} alt={ep.name} className="hidden h-14 w-24 sm:block" />}
      {dir === "next" && <ChevronRightIcon size={16} className="shrink-0 text-border-strong" />}
    </Link>
  );
}

function EpisodePage({ session }) {
  const { id: showId, seasonNumber, episodeNumber } = useParams();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const { episode, season, show, siblings, cast, crew, isLoading, error } = useEpisodeData(showId, seasonNumber, episodeNumber);
  const followBlockedLabel = showFollowBlock(show);
  const { isFollowing, toggleFollow, followLimitError, clearFollowLimitError } = useShowFollow(showId, session, { blocked: !!followBlockedLabel });
  const handleFollow = session ? toggleFollow : () => setShowAuthPrompt(true);

  const breadcrumbs = episode && season && show ? [
    { label: "Shows", to: "/shows" },
    { label: show.name, to: `/shows/${showId}` },
    { label: season.name, to: `/shows/${showId}/seasons/${seasonNumber}` },
    { label: episode.name },
  ] : undefined;

  if (isLoading) return <AppLayout session={session}><SkeletonDetailPage /></AppLayout>;
  if (error) return <AppLayout session={session}><ErrorNote className="mt-12">{error}</ErrorNote></AppLayout>;
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
  const code = `S${String(season.season_number).padStart(2, "0")}E${String(episode.episode_number).padStart(2, "0")}`;

  const details = [
    ["Runtime", episode.runtime ? `${episode.runtime}m` : "—"],
    ["Air date", fmtDate(episode.air_date)],
    ["Episode", `${episode.episode_number}${totalEps ? ` of ${totalEps}` : ""}`],
  ];
  const meta = [
    <span key="code" className="font-mono font-semibold text-text">{code}</span>,
    episode.air_date && <span key="d">{fmtDate(episode.air_date)}</span>,
    episode.runtime && <span key="r">{episode.runtime}m</span>,
  ];

  const still = (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-surface-4 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.7)]">
      {episode.poster_path ? (
        <img src={tmdbImg(episode.poster_path, "w300")} alt={episode.name} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-[#181d40] to-[#0e1128] text-border-strong">
          <TvIcon size={32} />
        </div>
      )}
    </div>
  );

  return (
    <AppLayout session={session} breadcrumbs={breadcrumbs}>
      <PageHead
        title={`${show.name} ${code} — ${episode.name}`}
        description={episode.overview?.slice(0, 155) || `${episode.name} · ${show.name}`}
        path={`/shows/${showId}/seasons/${seasonNumber}/episodes/${episodeNumber}`}
        jsonLd={episodeJsonLd}
      />
      {showAuthPrompt && <AuthPromptModal onClose={() => setShowAuthPrompt(false)} />}
      {followLimitError && <UpgradePromptToast message={followLimitError} onDismiss={clearFollowLimitError} session={session} />}
      <DetailPageLayout
        title={episode.name}
        subtitle={
          <>
            <Link to={`/shows/${showId}`} className="hover:text-white">{show.name}</Link>
            <span className="mx-1.5 text-text-faint">·</span>
            <Link to={`/shows/${showId}/seasons/${seasonNumber}`} className="hover:text-white">{season.name}</Link>
          </>
        }
        meta={meta}
        backdropPath={episode.poster_path ?? show.backdrop_path}
        poster={<div className="w-full lg:w-auto">{still}</div>}
        actions={<FollowButton isFollowing={isFollowing} onToggle={handleFollow} blockedLabel={followBlockedLabel} />}
        panel={
          <MediaActionPanel
            session={session}
            onAuthPrompt={() => setShowAuthPrompt(true)}
            rating={{
              mediaType: "episode",
              entityId: episode.id,
              tmdbShowId: show.tmdb_id,
              seasonNumber: season.season_number,
              episodeNumber: episode.episode_number,
              isUnreleased: !!(episode.air_date && new Date(episode.air_date) > new Date()),
            }}
          />
        }
      >
        {episode.overview && (
          <ContentPanel label="Overview">
            <p className="text-sm leading-relaxed text-text">{episode.overview}</p>
          </ContentPanel>
        )}

        {(prevEp || nextEp) && (
          <div className="flex gap-3">
            {prevEp && <NavCard dir="prev" label="Previous episode" ep={prevEp} to={`/shows/${showId}/seasons/${seasonNumber}/episodes/${prevEp.episode_number}`} />}
            {nextEp && <NavCard dir="next" label="Next episode" ep={nextEp} to={`/shows/${showId}/seasons/${seasonNumber}/episodes/${nextEp.episode_number}`} />}
          </div>
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

        {siblings.length > 0 && (
          <ContentPanel label="Other Episodes">
            <div className="grid max-h-96 grid-cols-1 gap-2 overflow-y-auto pr-1 xl:grid-cols-2">
              {siblings.map((ep) => <SiblingRow key={ep.id} ep={ep} showId={showId} seasonNumber={seasonNumber} />)}
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
