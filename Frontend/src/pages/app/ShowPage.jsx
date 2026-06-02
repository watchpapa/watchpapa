import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import DetailPageLayout from "../../components/detail/DetailPageLayout.jsx";
import SkeletonDetailPage from "../../components/detail/SkeletonDetailPage.jsx";
import PosterCard from "../../components/detail/PosterCard.jsx";
import ContentPanel from "../../components/detail/ContentPanel.jsx";
import FollowButton from "../../components/detail/FollowButton.jsx";
import AddToWatchlistButton from "../../components/watchlist/AddToWatchlistButton.jsx";
import { RatingSidebar } from "../../components/rating/RatingSidebar.jsx";
import { RatingHistogram } from "../../components/rating/RatingHistogram.jsx";
import { ObservedRatingsPanel } from "../../components/observe/ObservedRatingsPanel.jsx";
import CastGrid from "../../components/detail/CastGrid.jsx";
import CrewSection from "../../components/detail/CrewSection.jsx";
import AuthPromptModal from "../../components/AuthPromptModal.jsx";
import { useShowData } from "../../features/show/hooks/useShowData.js";
import InjectingBanner from "../../components/detail/InjectingBanner.jsx";
import AdminResyncButton from "../../components/detail/AdminResyncButton.jsx";
import UpgradePromptToast from "../../components/subscription/UpgradePromptToast.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";

const TMDB_IMG = "https://image.tmdb.org/t/p/w185";
const TMDB_IMG_BASE = "https://image.tmdb.org/t/p/";

function fmt(val, fallback = "—") {
  return val ?? fallback;
}

function fmtDate(val) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}


function SeasonCard({ season, showId }) {
  const episodeCount = season.episode?.length ?? 0;
  const imgSrc = season.poster_path ? `${TMDB_IMG}${season.poster_path}` : null;

  return (
    <Link
      to={`/shows/${showId}/seasons/${season.id}`}
      className="flex items-center gap-3 rounded-xl border border-[#2a3570]/50 bg-[#0d0f1e] p-3 transition hover:border-[#3a3a7a] hover:bg-[#141728]"
    >
      <div className="h-16 w-11 flex-shrink-0 overflow-hidden rounded-lg border border-[#2a3570] bg-[#12163a]">
        {imgSrc ? (
          <img src={imgSrc} alt={season.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#3a3a7a]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="6" width="20" height="14" rx="2" /><path d="M8 6V4M16 6V4M2 10h20" /></svg>
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-white">{season.name}</p>
        <p className="text-xs text-[#6868b8]">
          {episodeCount} episode{episodeCount !== 1 ? "s" : ""}
          {season.air_date ? ` · ${new Date(season.air_date).getFullYear()}` : ""}
        </p>
      </div>
      <svg className="ml-auto flex-shrink-0 text-[#3a3a7a]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
    </Link>
  );
}

function ShowPage({ session, showAdult }) {
  const { id } = useParams();
  const [showAllSeasons, setShowAllSeasons] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const { show, genres, seasons, cast, crew, isFollowing, followLimitError, clearFollowLimitError, isLoading, error, toggleFollow } = useShowData(id, session, showAdult);
  const handleFollow = session ? toggleFollow : () => setShowAuthPrompt(true);

  const breadcrumbs = show ? [{ label: "Shows", to: "/shows" }, { label: show.name }] : undefined;

  if (isLoading) return <AppLayout session={session}><SkeletonDetailPage /></AppLayout>;
  if (error) return <AppLayout session={session}><p className="text-center text-red-400 mt-12">{error}</p></AppLayout>;
  if (!show) return null;

  const firstYear = show.first_air_date ? new Date(show.first_air_date).getFullYear() : null;
  const lastYear = show.last_air_date ? new Date(show.last_air_date).getFullYear() : null;
  const yearRange = firstYear
    ? (show.status === "Ended" && lastYear && lastYear !== firstYear ? `${firstYear}–${lastYear}` : `${firstYear}–`)
    : null;
  const ogImage = show.backdrop_path
    ? `${TMDB_IMG_BASE}w1280${show.backdrop_path}`
    : show.poster_path
      ? `${TMDB_IMG_BASE}w500${show.poster_path}`
      : null;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TVSeries",
    name: show.name,
    ...(show.overview && { description: show.overview }),
    ...(show.first_air_date && { datePublished: show.first_air_date }),
    ...(show.status === "Ended" && show.last_air_date && { endDate: show.last_air_date }),
    ...(show.poster_path && { image: `${TMDB_IMG_BASE}w500${show.poster_path}` }),
    ...(show.number_of_seasons && { numberOfSeasons: show.number_of_seasons }),
    ...(show.number_of_episodes && { numberOfEpisodes: show.number_of_episodes }),
    ...(genres.length > 0 && { genre: genres.map(g => g.name) }),
    identifier: { "@type": "PropertyValue", name: "TMDB ID", value: String(show.tmdb_id) },
  };

  const details = [
    ["Episode runtime", show.episode_run_time ? `${show.episode_run_time}m` : "—"],
    ["Status", fmt(show.status)],
    ["First air date", fmtDate(show.first_air_date)],
    ["Last air date", fmtDate(show.last_air_date)],
    ["Number of seasons", fmt(show.number_of_seasons)],
    ["Number of episodes", fmt(show.number_of_episodes)],
    ["Original title", fmt(show.original_name)],
    ["Original language", fmt(show.original_language)],
    ["Tagline", fmt(show.tagline)],
    ["Type", fmt(show.type)],
  ];

  const visibleSeasons = showAllSeasons ? seasons : seasons.slice(0, 5);

  return (
    <AppLayout session={session} breadcrumbs={breadcrumbs}>
      <PageHead
        title={yearRange ? `${show.name} (${yearRange})` : show.name}
        description={show.overview?.slice(0, 155) || `Discover ${show.name} on watchpapa.`}
        image={ogImage}
        path={`/shows/${id}`}
        type="video.tv_show"
        jsonLd={jsonLd}
      />
      {showAuthPrompt && <AuthPromptModal onClose={() => setShowAuthPrompt(false)} />}
      {followLimitError && <UpgradePromptToast message={followLimitError} onDismiss={clearFollowLimitError} session={session} />}
      <div className="mb-6"><InjectingBanner type="show" id={id} /></div>
      <DetailPageLayout
        title={show.name}
        followButton={
          <div className="flex flex-wrap items-center gap-2">
            <FollowButton isFollowing={isFollowing} onToggle={handleFollow} />
            <AddToWatchlistButton
              mediaType="show"
              entityId={show.id}
              session={session}
              onAuthPrompt={() => setShowAuthPrompt(true)}
            />
          </div>
        }
        sidebarTop={<PosterCard title={show.name} posterPath={show.poster_path} />}
        sidebarBottom={
          <>
            <ul className="space-y-1.5 text-xs">
              {[
                ["Title", fmt(show.name)],
                ["Seasons", fmt(show.number_of_seasons)],
                ["Episodes", fmt(show.number_of_episodes)],
                ["Runtime", show.episode_run_time ? `${show.episode_run_time}m` : "—"],
                ["Popularity", show.tmdb_popularity?.toFixed(1) ?? "—"],
              ].map(([k, v]) => (
                <li key={k}><span className="font-bold text-[#8383e7]">{k}:</span> <span className="text-[#c0c0e8]">{v}</span></li>
              ))}
            </ul>
            <RatingSidebar mediaType="show" entityId={show.id} session={session} onAuthPrompt={() => setShowAuthPrompt(true)} isUnreleased={!!(show.first_air_date && new Date(show.first_air_date) > new Date())} />
            <ObservedRatingsPanel mediaType="show" entityId={show.id} session={session} />
            <RatingHistogram mediaType="show" entityId={show.id} tmdbVoteAvg={show.tmdb_vote_avg} />
          </>
        }
        sidebarFooter={<AdminResyncButton session={session} type="show" tmdbId={show.tmdb_id} />}
      >
        <ContentPanel label="Details">
          <ul className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
            {details.map(([k, v]) => (
              <li key={k}><span className="font-semibold text-[#8383e7]">{k}:</span> <span className="text-[#c0c0e8]">{v}</span></li>
            ))}
          </ul>
        </ContentPanel>

        {show.overview && (
          <ContentPanel label="Overview">
            <p className="text-sm leading-relaxed text-[#c0c0e8]">{show.overview}</p>
          </ContentPanel>
        )}

        {genres.length > 0 && (
          <div className="flex flex-wrap gap-2 px-1">
            <span className="text-sm font-semibold text-[#8383e7]">Genres:</span>
            {genres.map((g) => (
              <span key={g.id} className="rounded-full border border-[#3a3a7a] bg-[#1a1d35] px-3 py-0.5 text-xs font-semibold text-[#a0a0e8]">{g.name}</span>
            ))}
          </div>
        )}

        {seasons.length > 0 && (
          <ContentPanel label="Seasons and Episodes">
            <div className="space-y-2">
              {visibleSeasons.map((s) => <SeasonCard key={s.id} season={s} showId={id} />)}
            </div>
            {seasons.length > 5 && (
              <button
                onClick={() => setShowAllSeasons((v) => !v)}
                className="mt-3 text-xs font-semibold text-[#8383e7] hover:text-white transition"
              >
                {showAllSeasons ? "Show less" : `Show all ${seasons.length} seasons`}
              </button>
            )}
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

export default ShowPage;
