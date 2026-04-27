import { Link, useParams } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import DetailPageLayout from "../../components/detail/DetailPageLayout.jsx";
import PosterCard from "../../components/detail/PosterCard.jsx";
import ContentPanel from "../../components/detail/ContentPanel.jsx";
import CastGrid from "../../components/detail/CastGrid.jsx";
import { useEpisodeData } from "../../features/episode/hooks/useEpisodeData.js";

const TMDB_IMG = "https://image.tmdb.org/t/p/w185";

function fmt(val, fallback = "—") { return val ?? fallback; }

function fmtDate(val) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function SkeletonDetail() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-96 rounded bg-[#1e2240]" />
      <div className="flex gap-6">
        <div className="hidden lg:block w-[220px] flex-shrink-0 aspect-[2/3] rounded-2xl bg-[#1e2240]" />
        <div className="flex-1 space-y-4">
          <div className="h-24 rounded-2xl bg-[#1e2240]" />
          <div className="h-48 rounded-2xl bg-[#1e2240]" />
        </div>
      </div>
    </div>
  );
}

function SiblingRow({ ep, showId, seasonId }) {
  const imgSrc = ep.poster_path ? `${TMDB_IMG}${ep.poster_path}` : null;
  return (
    <Link
      to={`/shows/${showId}/seasons/${seasonId}/episodes/${ep.id}`}
      className="flex items-center gap-3 rounded-xl border border-[#1a1f3a] bg-[#0d0f1e] p-3 transition hover:border-[#3a3a7a] hover:bg-[#141728]"
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
  const { id: showId, seasonId, episodeId } = useParams();
  const { episode, season, show, siblings, cast, isLoading, error } = useEpisodeData(episodeId, seasonId, showId);

  if (isLoading) return <AppLayout session={session}><SkeletonDetail /></AppLayout>;
  if (error) return <AppLayout session={session}><p className="text-center text-red-400 mt-12">{error}</p></AppLayout>;
  if (!episode || !season || !show) return null;

  const totalEps = (season.episode?.length ?? 0);

  const title = (
    <span>
      <Link to={`/shows/${showId}`} className="hover:underline">{show.name}</Link>
      <span className="text-[#5050b0]"> › </span>
      <Link to={`/shows/${showId}/seasons/${seasonId}`} className="hover:underline">{season.name}</Link>
      <span className="text-[#5050b0]"> › </span>
      {episode.name}
    </span>
  );

  const details = [
    ["Episode runtime", episode.runtime ? `${episode.runtime}m` : "—"],
    ["Air date", fmtDate(episode.air_date)],
    ["Episode number", `${episode.episode_number}${totalEps ? ` / ${totalEps}` : ""}`],
  ];

  return (
    <AppLayout session={session}>
      <DetailPageLayout
        title={title}
        sidebarTop={<PosterCard title={episode.name} posterPath={episode.poster_path} />}
        sidebarBottom={
          <ul className="space-y-1.5 text-xs">
            {[
              ["Title", fmt(episode.name)],
              ["Runtime", episode.runtime ? `${episode.runtime}m` : "—"],
              ["Episode", `${episode.episode_number}${totalEps ? ` / ${totalEps}` : ""}`],
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

        {episode.overview && (
          <ContentPanel label="Overview">
            <p className="text-sm leading-relaxed text-[#c0c0e8]">{episode.overview}</p>
          </ContentPanel>
        )}

        {siblings.length > 0 && (
          <ContentPanel label="Other Episodes">
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {siblings.map((ep) => (
                <SiblingRow key={ep.id} ep={ep} showId={showId} seasonId={seasonId} />
              ))}
            </div>
          </ContentPanel>
        )}

        {cast.length > 0 && (
          <ContentPanel label="Cast">
            <CastGrid credits={cast} />
          </ContentPanel>
        )}
      </DetailPageLayout>
    </AppLayout>
  );
}

export default EpisodePage;
