import { Navigate, useParams } from "react-router-dom";

// Legacy /movies|shows|people/tmdb/:tmdbId → /movies|shows|people/:tmdbId
// (URLs are TMDB-keyed now, so the tmdb/ prefix is just a redirect).
export default function TmdbRedirect({ kind }) {
  const { tmdbId } = useParams();
  return <Navigate to={`/${kind}/${tmdbId}`} replace />;
}
