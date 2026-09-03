// Used by:
// - Frontend/src/pages/app/SeasonPage.jsx
//
// URL is /shows/:id/seasons/:seasonNumber (both TMDB-keyed). Show header + sibling
// seasons + credits from useShow; the season + its episodes from useSeason.
import { toCast, toCrew } from "../../../lib/credits.js";
import { useShow, useSeason } from "../../content/hooks/useContent.js";

export function useSeasonData(rawShowId, rawSeasonNumber) {
  const showId = rawShowId ? parseInt(rawShowId, 10) : null;
  const seasonNumber = rawSeasonNumber != null ? parseInt(rawSeasonNumber, 10) : null;

  const showQ = useShow(showId);
  const seasonQ = useSeason(showId, seasonNumber);

  const show = showQ.data;
  const season = seasonQ.data;

  const episodes = (season?.episodes ?? []).slice().sort((a, b) => a.episode_number - b.episode_number);
  const seasons = (show?.seasons ?? []).slice().sort((a, b) => a.season_number - b.season_number);

  return {
    season,
    show,
    episodes,
    seasons,
    cast: toCast(show?.cast),
    crew: toCrew(show?.crew),
    isLoading: showQ.loading || seasonQ.loading,
    error: showQ.error?.message ?? seasonQ.error?.message ?? null,
  };
}
