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
import { useMovieData } from "../../features/movie/hooks/useMovieData.js";
import { movieFollowBlock } from "../../lib/followGate.js";
import { useWatchLog } from "../../features/watchlist/hooks/useWatchLog.js";
import WhereToWatch from "../../components/detail/WhereToWatch.jsx";
import UpgradePromptToast from "../../components/subscription/UpgradePromptToast.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import ErrorNote from "../../components/ui/ErrorNote.jsx";
import { MediaShareModal } from "../../components/detail/MediaShareModal.jsx";
import { tmdbImg } from "../../lib/tmdbImage.js";
import { useCertifications } from "../../features/content/hooks/useContent.js";
import { certificationMeaning } from "../../lib/certifications.js";
import { useRating } from "../../features/rating/hooks/useRating.js";

function fmt(val, fallback = "—") {
  return val ?? fallback;
}

function fmtDate(val) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function fmtMoney(val) {
  if (!val || val === 0) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
}

function fmtRuntime(val) {
  if (!val) return null;
  const h = Math.floor(val / 60);
  const m = val % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function CertBadge({ value, meaning }) {
  return (
    <Link
      to="/certifications"
      title={meaning ? `${meaning} — see all certifications` : "See all certifications"}
      className="rounded-md border border-border-hover bg-surface-4 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white transition hover:border-brand-light hover:text-[#c8c8ff]"
    >
      {value}
    </Link>
  );
}

function MoviePage({ session, showAdult }) {
  const { id } = useParams();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const { movie, genres, cast, crew, isFollowing, followLimitError, clearFollowLimitError, isLoading, error, toggleFollow } = useMovieData(id, session, showAdult);
  const { data: certCatalog } = useCertifications();
  const handleFollow = session ? toggleFollow : () => setShowAuthPrompt(true);
  const { value: ratingValue } = useRating("movie", id ? Number(id) : null, session);
  const watchLog = useWatchLog("movie", id ? Number(id) : null, session);

  const breadcrumbs = movie ? [{ label: "Movies", to: "/movies" }, { label: movie.title }] : undefined;

  if (isLoading) return <AppLayout session={session}><SkeletonDetailPage /></AppLayout>;
  if (error) return <AppLayout session={session}><ErrorNote className="mt-12">{error}</ErrorNote></AppLayout>;
  if (!movie) return null;

  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : null;
  const certMeaning = certificationMeaning(certCatalog, "movie", movie.certification_region, movie.certification);
  const ogImage = tmdbImg(movie.backdrop_path, "w1280") ?? tmdbImg(movie.poster_path, "w500");
  const directorPeople = crew.find((c) => c.department === "Directing")?.jobs.find((j) => j.job === "Director")?.people ?? [];
  const director = directorPeople[0];
  const isUnreleased = !!(movie.release_date && new Date(movie.release_date) > new Date());
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Movie",
    name: movie.title,
    ...(movie.overview && { description: movie.overview }),
    ...(movie.release_date && { datePublished: movie.release_date }),
    ...(movie.poster_path && { image: tmdbImg(movie.poster_path, "w500") }),
    ...(movie.runtime && { duration: `PT${movie.runtime}M` }),
    ...(genres.length > 0 && { genre: genres.map((g) => g.name) }),
    ...(director && { director: { "@type": "Person", name: director.name } }),
    identifier: { "@type": "PropertyValue", name: "TMDB ID", value: String(movie.tmdb_id) },
  };

  const details = [
    ["Release date", fmtDate(movie.release_date)],
    ["Original title", fmt(movie.original_title)],
    ["Original language", fmt(movie.original_language)],
    ["Runtime", fmtRuntime(movie.runtime) ?? "—"],
    ["Tagline", fmt(movie.tagline)],
    ["Status", fmt(movie.status)],
    ["Budget", fmtMoney(movie.budget)],
    ["Revenue", fmtMoney(movie.revenue)],
  ];

  const meta = [
    year && <span key="y">{year}</span>,
    fmtRuntime(movie.runtime) && <span key="r">{fmtRuntime(movie.runtime)}</span>,
    movie.certification && <CertBadge key="c" value={movie.certification} meaning={certMeaning} />,
    isUnreleased && <span key="u" className="font-semibold text-amber-300">Coming {fmtDate(movie.release_date)}</span>,
    director && <span key="d">Directed by <Link to={`/people/${director.id}`} className="font-semibold text-text hover:text-white">{director.name}</Link></span>,
  ];

  return (
    <AppLayout session={session} breadcrumbs={breadcrumbs}>
      <PageHead
        title={year ? `${movie.title} (${year})` : movie.title}
        description={movie.overview?.slice(0, 155) || `Discover ${movie.title} on watchpapa.`}
        image={ogImage}
        path={`/movies/${id}`}
        type="video.movie"
        jsonLd={jsonLd}
      />
      {showAuthPrompt && <AuthPromptModal onClose={() => setShowAuthPrompt(false)} />}
      {followLimitError && <UpgradePromptToast message={followLimitError} onDismiss={clearFollowLimitError} session={session} />}
      <DetailPageLayout
        title={movie.title}
        meta={meta}
        backdropPath={movie.backdrop_path}
        poster={<PosterCard title={movie.title} posterPath={movie.poster_path} />}
        actions={<FollowButton isFollowing={isFollowing} onToggle={handleFollow} blockedLabel={movieFollowBlock(movie)} />}
        panel={
          <MediaActionPanel
            session={session}
            onAuthPrompt={() => setShowAuthPrompt(true)}
            rating={{ mediaType: "movie", entityId: movie.id, isUnreleased }}
            watched={{
              entries: watchLog.entries,
              count: watchLog.count,
              loading: watchLog.loading,
              impliedWatched: ratingValue != null,
              busy: watchLog.busy,
              onLogWatch: watchLog.logWatch,
              onRemoveEntry: watchLog.removeEntry,
            }}
            watchlist={{ mediaType: "movie", entityId: movie.id }}
            onShare={() => setShareOpen(true)}
            tmdbVoteAvg={movie.tmdb_vote_avg}
          />
        }
      >
        {movie.overview && (
          <ContentPanel label="Overview">
            <p className="text-sm leading-relaxed text-text">{movie.overview}</p>
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

        {movie.collection && (
          <div className="px-1">
            <Link to={`/collections/${movie.collection.id}`} className="text-sm font-semibold text-text-link underline decoration-border-strong underline-offset-4 hover:text-white">
              Part of the {movie.collection.name} Collection
            </Link>
          </div>
        )}

        {movie.watch_providers && (
          <ContentPanel label="Where to watch">
            <WhereToWatch data={movie.watch_providers} />
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
          mediaType="movie"
          mediaData={{
            entityId: movie.id,
            title: movie.title,
            posterPath: movie.poster_path,
            releaseYear: year,
            genres: genres.map((g) => g.name),
            overview: movie.overview,
          }}
          session={session}
          onClose={() => setShareOpen(false)}
        />
      )}
    </AppLayout>
  );
}

export default MoviePage;
