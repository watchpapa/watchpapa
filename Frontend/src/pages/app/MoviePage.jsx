import { useState } from "react";
import { useParams } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import DetailPageLayout from "../../components/detail/DetailPageLayout.jsx";
import SkeletonDetailPage from "../../components/detail/SkeletonDetailPage.jsx";
import PosterCard from "../../components/detail/PosterCard.jsx";
import ContentPanel from "../../components/detail/ContentPanel.jsx";
import FollowButton from "../../components/detail/FollowButton.jsx";
import AddToWatchlistButton from "../../components/watchlist/AddToWatchlistButton.jsx";
import { RatingSidebar } from "../../components/rating/RatingSidebar.jsx";
import { RatingHistogram } from "../../components/rating/RatingHistogram.jsx";
import CastGrid from "../../components/detail/CastGrid.jsx";
import CrewSection from "../../components/detail/CrewSection.jsx";
import AuthPromptModal from "../../components/AuthPromptModal.jsx";
import { useMovieData } from "../../features/movie/hooks/useMovieData.js";
import InjectingBanner from "../../components/detail/InjectingBanner.jsx";
import AdminResyncButton from "../../components/detail/AdminResyncButton.jsx";
import UpgradePromptToast from "../../components/subscription/UpgradePromptToast.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";

const TMDB_IMG_BASE = "https://image.tmdb.org/t/p/";

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
  if (!val) return "—";
  const h = Math.floor(val / 60);
  const m = val % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function MoviePage({ session, showAdult }) {
  const { id } = useParams();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const { movie, genres, cast, crew, isFollowing, followLimitError, clearFollowLimitError, isLoading, error, toggleFollow } = useMovieData(id, session, showAdult);
  const handleFollow = session ? toggleFollow : () => setShowAuthPrompt(true);

  const breadcrumbs = movie ? [{ label: "Movies", to: "/movies" }, { label: movie.title }] : undefined;

  if (isLoading) return <AppLayout session={session}><SkeletonDetailPage /></AppLayout>;
  if (error) return <AppLayout session={session}><p className="text-center text-red-400 mt-12">{error}</p></AppLayout>;
  if (!movie) return null;

  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : null;
  const ogImage = movie.backdrop_path
    ? `${TMDB_IMG_BASE}w1280${movie.backdrop_path}`
    : movie.poster_path
      ? `${TMDB_IMG_BASE}w500${movie.poster_path}`
      : null;
  const directorPeople = crew.find(c => c.department === "Directing")?.jobs.find(j => j.job === "Director")?.people ?? [];
  const director = directorPeople[0];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Movie",
    name: movie.title,
    ...(movie.overview && { description: movie.overview }),
    ...(movie.release_date && { datePublished: movie.release_date }),
    ...(movie.poster_path && { image: `${TMDB_IMG_BASE}w500${movie.poster_path}` }),
    ...(movie.runtime && { duration: `PT${movie.runtime}M` }),
    ...(genres.length > 0 && { genre: genres.map(g => g.name) }),
    ...(director && { director: { "@type": "Person", name: director.name } }),
    identifier: { "@type": "PropertyValue", name: "TMDB ID", value: String(movie.tmdb_id) },
  };

  const details = [
    ["Release date", fmtDate(movie.release_date)],
    ["Original title", fmt(movie.original_title)],
    ["Original language", fmt(movie.original_language)],
    ["Runtime", fmtRuntime(movie.runtime)],
    ["Tagline", fmt(movie.tagline)],
    ["Status", fmt(movie.status)],
    ["Budget", fmtMoney(movie.budget)],
    ["Revenue", fmtMoney(movie.revenue)],
  ];

  const sidebarInfo = [
    ["Title", fmt(movie.title)],
    ["Runtime", fmtRuntime(movie.runtime)],
    ["Popularity", movie.tmdb_popularity?.toFixed(1) ?? "—"],
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
      <div className="mb-6"><InjectingBanner type="movie" id={id} /></div>
      <div className="mb-6"><AdminResyncButton session={session} type="movie" tmdbId={movie.tmdb_id} /></div>
      <DetailPageLayout
        title={movie.title}
        followButton={
          <div className="flex flex-wrap items-center gap-2">
            <FollowButton isFollowing={isFollowing} onToggle={handleFollow} />
            <AddToWatchlistButton
              mediaType="movie"
              entityId={movie.id}
              session={session}
              onAuthPrompt={() => setShowAuthPrompt(true)}
            />
          </div>
        }
        sidebarTop={<PosterCard title={movie.title} posterPath={movie.poster_path} />}
        sidebarBottom={
          <>
            <ul className="space-y-1.5 text-xs">
              {sidebarInfo.map(([k, v]) => (
                <li key={k}><span className="font-bold text-[#8383e7]">{k}:</span> <span className="text-[#c0c0e8]">{v}</span></li>
              ))}
            </ul>
            <RatingSidebar mediaType="movie" entityId={movie.id} session={session} onAuthPrompt={() => setShowAuthPrompt(true)} />
            <RatingHistogram mediaType="movie" entityId={movie.id} />
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

        {movie.overview && (
          <ContentPanel label="Overview">
            <p className="text-sm leading-relaxed text-[#c0c0e8]">{movie.overview}</p>
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

export default MoviePage;
