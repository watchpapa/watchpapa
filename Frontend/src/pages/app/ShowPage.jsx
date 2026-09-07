import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import DetailPageLayout from "../../components/detail/DetailPageLayout.jsx";
import SkeletonDetailPage from "../../components/detail/SkeletonDetailPage.jsx";
import PosterCard from "../../components/detail/PosterCard.jsx";
import ContentPanel from "../../components/detail/ContentPanel.jsx";
import FollowButton from "../../components/detail/FollowButton.jsx";
import MediaActionPanel from "../../components/detail/MediaActionPanel.jsx";
import CastGrid from "../../components/detail/CastGrid.jsx";
import CrewSection from "../../components/detail/CrewSection.jsx";
import AuthPromptModal from "../../components/AuthPromptModal.jsx";
import { useShowData } from "../../features/show/hooks/useShowData.js";
import { showFollowBlock } from "../../lib/followGate.js";
import { useWatchLog } from "../../features/watchlist/hooks/useWatchLog.js";
import WhereToWatch from "../../components/detail/WhereToWatch.jsx";
import UpgradePromptToast from "../../components/subscription/UpgradePromptToast.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import ErrorNote from "../../components/ui/ErrorNote.jsx";
import Button from "../../components/ui/Button.jsx";
import { MediaShareModal } from "../../components/detail/MediaShareModal.jsx";
import { tmdbImg } from "../../lib/tmdbImage.js";
import { useCertifications } from "../../features/content/hooks/useContent.js";
import { certificationMeaning } from "../../lib/certifications.js";
import { useRating } from "../../features/rating/hooks/useRating.js";
import { useShowCompletion } from "../../features/rating/hooks/useShowCompletion.js";
import { ChevronRightIcon, TvIcon } from "../../components/icons/index.jsx";

function fmt(val, fallback = "—") {
  return val ?? fallback;
}

function fmtDate(val) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function SeasonCard({ season, showId }) {
  const episodeCount = season.episode_count ?? 0;
  const imgSrc = tmdbImg(season.poster_path, "w185");
  return (
    <Link
      to={`/shows/${showId}/seasons/${season.season_number}`}
      className="flex min-h-[4.5rem] items-center gap-3 rounded-xl border border-border/50 bg-surface p-3 transition hover:border-border-strong hover:bg-surface-2"
    >
      <div className="h-16 w-11 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-4">
        {imgSrc ? (
          <img src={imgSrc} alt={season.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-border-strong"><TvIcon size={16} /></div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-white">{season.name}</p>
        <p className="text-xs text-text-dim">
          {episodeCount} episode{episodeCount !== 1 ? "s" : ""}
          {season.air_date ? ` · ${new Date(season.air_date).getFullYear()}` : ""}
        </p>
      </div>
      <ChevronRightIcon size={16} className="shrink-0 text-border-strong" />
    </Link>
  );
}

function ShowPage({ session, showAdult }) {
  const { id } = useParams();
  const [showAllSeasons, setShowAllSeasons] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const { show, genres, seasons, cast, crew, isFollowing, followLimitError, clearFollowLimitError, isLoading, error, toggleFollow } = useShowData(id, session, showAdult);
  const { data: certCatalog } = useCertifications();
  const handleFollow = session ? toggleFollow : () => setShowAuthPrompt(true);
  const { value: ratingValue } = useRating("show", id ? Number(id) : null, session);
  const seasonsComplete = useShowCompletion(id ? Number(id) : null, seasons, session);
  const watchLog = useWatchLog("show", id ? Number(id) : null, session);

  const breadcrumbs = [{ label: "Shows", to: "/shows" }, ...(show ? [{ label: show.name }] : [])];

  if (isLoading) return <AppLayout session={session} breadcrumbs={breadcrumbs}><SkeletonDetailPage /></AppLayout>;
  if (error) return <AppLayout session={session} breadcrumbs={breadcrumbs}><ErrorNote className="mt-12">{error}</ErrorNote></AppLayout>;
  if (!show) return null;

  const firstYear = show.first_air_date ? new Date(show.first_air_date).getFullYear() : null;
  const lastYear = show.last_air_date ? new Date(show.last_air_date).getFullYear() : null;
  const yearRange = firstYear
    ? (show.status === "Ended" && lastYear && lastYear !== firstYear ? `${firstYear}–${lastYear}` : `${firstYear}–`)
    : null;
  const certMeaning = certificationMeaning(certCatalog, "tv", show.certification_region, show.certification);
  const ogImage = tmdbImg(show.backdrop_path, "w1280") ?? tmdbImg(show.poster_path, "w500");
  const isUnreleased = !!(show.first_air_date && new Date(show.first_air_date) > new Date());
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TVSeries",
    name: show.name,
    ...(show.overview && { description: show.overview }),
    ...(show.first_air_date && { datePublished: show.first_air_date }),
    ...(show.status === "Ended" && show.last_air_date && { endDate: show.last_air_date }),
    ...(show.poster_path && { image: tmdbImg(show.poster_path, "w500") }),
    ...(show.number_of_seasons && { numberOfSeasons: show.number_of_seasons }),
    ...(show.number_of_episodes && { numberOfEpisodes: show.number_of_episodes }),
    ...(genres.length > 0 && { genre: genres.map((g) => g.name) }),
    identifier: { "@type": "PropertyValue", name: "TMDB ID", value: String(show.tmdb_id) },
  };

  const details = [
    ["Episode runtime", show.episode_run_time ? `${show.episode_run_time}m` : "—"],
    ["Status", fmt(show.status)],
    ["First air date", fmtDate(show.first_air_date)],
    ["Last air date", fmtDate(show.last_air_date)],
    ["Seasons", fmt(show.number_of_seasons)],
    ["Episodes", fmt(show.number_of_episodes)],
    ["Original title", fmt(show.original_name)],
    ["Original language", fmt(show.original_language)],
    ["Tagline", fmt(show.tagline)],
    ["Type", fmt(show.type_label)],
  ];

  const meta = [
    yearRange && <span key="y">{yearRange}</span>,
    show.number_of_seasons && <span key="s">{show.number_of_seasons} season{show.number_of_seasons !== 1 ? "s" : ""}</span>,
    show.status && <span key="st" className={show.status === "Ended" || show.status === "Canceled" ? "text-text-faint" : "text-emerald-300"}>{show.status}</span>,
    show.certification && (
      <Link
        key="c"
        to="/certifications"
        title={certMeaning ? `${certMeaning} — see all certifications` : "See all certifications"}
        className="rounded-md border border-border-hover bg-surface-4 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white transition hover:border-brand-light hover:text-[#c8c8ff]"
      >
        {show.certification}
      </Link>
    ),
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
      <DetailPageLayout
        title={show.name}
        meta={meta}
        backdropPath={show.backdrop_path}
        poster={<PosterCard title={show.name} posterPath={show.poster_path} />}
        actions={<FollowButton isFollowing={isFollowing} onToggle={handleFollow} blockedLabel={showFollowBlock(show)} />}
        panel={
          <MediaActionPanel
            session={session}
            onAuthPrompt={() => setShowAuthPrompt(true)}
            rating={{ mediaType: "show", entityId: show.id, isUnreleased }}
            watched={{
              entries: watchLog.entries,
              count: watchLog.count,
              loading: watchLog.loading,
              impliedWatched: ratingValue != null || seasonsComplete,
              busy: watchLog.busy,
              onLogWatch: watchLog.logWatch,
              onRemoveEntry: watchLog.removeEntry,
            }}
            watchlist={{ mediaType: "show", entityId: show.id }}
            onShare={() => setShareOpen(true)}
            tmdbVoteAvg={show.tmdb_vote_avg}
          />
        }
      >
        {show.overview && (
          <ContentPanel label="Overview">
            <p className="text-sm leading-relaxed text-text">{show.overview}</p>
          </ContentPanel>
        )}

        {genres.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-1">
            <span className="text-sm font-semibold text-heading">Genres:</span>
            {genres.map((g) => (
              <span key={g.id} className="rounded-full border border-border-strong bg-surface-3 px-3 py-1 text-xs font-semibold text-text-link">{g.name}</span>
            ))}
          </div>
        )}

        {seasons.length > 0 && (
          <ContentPanel label="Seasons and Episodes">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {visibleSeasons.map((s) => <SeasonCard key={s.id} season={s} showId={id} />)}
            </div>
            {seasons.length > 5 && (
              <Button variant="ghost" size="sm" className="mt-3" onClick={() => setShowAllSeasons((v) => !v)}>
                {showAllSeasons ? "Show less" : `Show all ${seasons.length} seasons`}
              </Button>
            )}
          </ContentPanel>
        )}

        {show.watch_providers && (
          <ContentPanel label="Where to watch">
            <WhereToWatch data={show.watch_providers} />
          </ContentPanel>
        )}

        <ContentPanel label="Details">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {details.map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="shrink-0 font-semibold text-heading">{k}:</dt>
                <dd className="min-w-0 break-words text-text">{v}</dd>
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
      {shareOpen && (
        <MediaShareModal
          mediaType="show"
          mediaData={{
            entityId: show.id,
            title: show.name,
            posterPath: show.poster_path,
            releaseYear: firstYear,
            genres: genres.map((g) => g.name),
            overview: show.overview,
          }}
          session={session}
          onClose={() => setShareOpen(false)}
        />
      )}
    </AppLayout>
  );
}

export default ShowPage;
