// Used by:
// - Frontend/src/pages/app/EpisodePage.jsx
//
// URL is /shows/:id/seasons/:seasonNumber/episodes/:episodeNumber (all TMDB-keyed).
import { toCast, toCrew } from "../../../lib/credits.js";
import { useShow, useSeason, useEpisode } from "../../content/hooks/useContent.js";

export function useEpisodeData(rawShowId, rawSeasonNumber, rawEpisodeNumber) {
  const showId = rawShowId ? parseInt(rawShowId, 10) : null;
  const seasonNumber = rawSeasonNumber != null ? parseInt(rawSeasonNumber, 10) : null;
  const episodeNumber = rawEpisodeNumber != null ? parseInt(rawEpisodeNumber, 10) : null;

  const showQ = useShow(showId);
  const seasonQ = useSeason(showId, seasonNumber);
  const episodeQ = useEpisode(showId, seasonNumber, episodeNumber);

  const show = showQ.data;
  const season = seasonQ.data;
  const episode = episodeQ.data;

  const siblings = (season?.episodes ?? [])
    .filter((e) => e.episode_number !== episodeNumber)
    .slice()
    .sort((a, b) => a.episode_number - b.episode_number);

  return {
    episode,
    season,
    show,
    siblings,
    cast: toCast(episode?.cast),
    crew: toCrew(episode?.crew),
    isLoading: showQ.loading || seasonQ.loading || episodeQ.loading,
    error: showQ.error?.message ?? seasonQ.error?.message ?? episodeQ.error?.message ?? null,
  };
}
