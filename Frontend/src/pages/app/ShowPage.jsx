import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import DetailPageLayout from "../../components/detail/DetailPageLayout.jsx";
import SkeletonDetailPage from "../../components/detail/SkeletonDetailPage.jsx";
import PosterCard from "../../components/detail/PosterCard.jsx";
import ContentPanel from "../../components/detail/ContentPanel.jsx";
import FollowButton from "../../components/detail/FollowButton.jsx";
import CastGrid from "../../components/detail/CastGrid.jsx";
import CrewSection from "../../components/detail/CrewSection.jsx";
import AuthPromptModal from "../../components/AuthPromptModal.jsx";
import { useShowData } from "../../features/show/hooks/useShowData.js";

const TMDB_IMG = "https://image.tmdb.org/t/p/w185";

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
      className="flex items-center gap-3 rounded-xl border border-[#1a1f3a] bg-[#0d0f1e] p-3 transition hover:border-[#3a3a7a] hover:bg-[#141728]"
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

function ShowPage({ session }) {
  const { id } = useParams();
  const [showAllSeasons, setShowAllSeasons] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const { show, genres, seasons, cast, crew, isFollowing, isLoading, error, toggleFollow } = useShowData(id, session);
  const handleFollow = session ? toggleFollow : () => setShowAuthPrompt(true);

  const breadcrumbs = show ? [{ label: "Shows", to: "/shows" }, { label: show.name }] : undefined;

  if (isLoading) return <AppLayout session={session}><SkeletonDetailPage /></AppLayout>;
  if (error) return <AppLayout session={session}><p className="text-center text-red-400 mt-12">{error}</p></AppLayout>;
  if (!show) return null;

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
      {showAuthPrompt && <AuthPromptModal onClose={() => setShowAuthPrompt(false)} />}
      <DetailPageLayout
        title={show.name}
        followButton={<FollowButton isFollowing={isFollowing} onToggle={handleFollow} />}
        sidebarTop={<PosterCard title={show.name} posterPath={show.poster_path} />}
        sidebarBottom={
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
        }
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
