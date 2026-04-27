import { useParams } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import DetailPageLayout from "../../components/detail/DetailPageLayout.jsx";
import PosterCard from "../../components/detail/PosterCard.jsx";
import ContentPanel from "../../components/detail/ContentPanel.jsx";
import FollowButton from "../../components/detail/FollowButton.jsx";
import CastGrid from "../../components/detail/CastGrid.jsx";
import { useMovieData } from "../../features/movie/hooks/useMovieData.js";

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

function SkeletonDetail() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-64 rounded bg-[#1e2240]" />
      <div className="flex gap-6">
        <div className="hidden lg:block w-[220px] flex-shrink-0 aspect-[2/3] rounded-2xl bg-[#1e2240]" />
        <div className="flex-1 space-y-4">
          <div className="h-32 rounded-2xl bg-[#1e2240]" />
          <div className="h-24 rounded-2xl bg-[#1e2240]" />
          <div className="h-48 rounded-2xl bg-[#1e2240]" />
        </div>
      </div>
    </div>
  );
}

function MoviePage({ session }) {
  const { id } = useParams();
  const { movie, genres, cast, isFollowing, isLoading, error, toggleFollow } = useMovieData(id, session);

  if (isLoading) return <AppLayout session={session}><SkeletonDetail /></AppLayout>;
  if (error) return <AppLayout session={session}><p className="text-center text-red-400 mt-12">{error}</p></AppLayout>;
  if (!movie) return null;

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
    <AppLayout session={session}>
      <DetailPageLayout
        title={movie.title}
        followButton={<FollowButton isFollowing={isFollowing} onToggle={toggleFollow} />}
        sidebarTop={<PosterCard title={movie.title} posterPath={movie.poster_path} />}
        sidebarBottom={
          <ul className="space-y-1.5 text-xs">
            {sidebarInfo.map(([k, v]) => (
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
          <ContentPanel label="Main Cast">
            <CastGrid credits={cast} />
          </ContentPanel>
        )}
      </DetailPageLayout>
    </AppLayout>
  );
}

export default MoviePage;
