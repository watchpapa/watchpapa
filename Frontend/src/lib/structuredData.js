// schema.org JSON-LD builders used by PageHead across detail pages.
// Mirrors (deliberately duplicated — different runtime/package, no shared
// build step) worker/src/lib/structuredData.js, which the edge
// meta-injection route (/api/meta) uses for non-JS crawlers. Keep the two in
// sync when either changes.
import { tmdbImg } from "./tmdbImage.js";

const BASE_URL = "https://watchpapa.tv";

export function movieJsonLd(movie, genres = [], director) {
  return {
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
}

export function tvSeriesJsonLd(show, genres = []) {
  return {
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
}

export function tvSeasonJsonLd(season, show) {
  return {
    "@context": "https://schema.org",
    "@type": "TVSeason",
    name: season.name,
    seasonNumber: season.season_number,
    ...(season.overview && { description: season.overview }),
    ...(season.air_date && { datePublished: season.air_date }),
    ...(season.poster_path && { image: tmdbImg(season.poster_path, "w500") }),
    ...(show?.name && { partOfSeries: { "@type": "TVSeries", name: show.name } }),
  };
}

export function tvEpisodeJsonLd(episode, season, show) {
  return {
    "@context": "https://schema.org",
    "@type": "TVEpisode",
    name: episode.name,
    episodeNumber: episode.episode_number,
    partOfSeason: { "@type": "TVSeason", seasonNumber: season.season_number },
    partOfSeries: { "@type": "TVSeries", name: show.name },
    ...(episode.overview && { description: episode.overview }),
    ...(episode.air_date && { datePublished: episode.air_date }),
  };
}

export function personJsonLd(person, knownForDepartment) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: person.name,
    ...(person.biography && { description: person.biography.slice(0, 500) }),
    ...(person.profile_path && { image: tmdbImg(person.profile_path, "w342") }),
    ...(person.birthday && { birthDate: person.birthday }),
    ...(person.place_of_birth && { birthPlace: { "@type": "Place", name: person.place_of_birth } }),
    ...(knownForDepartment && { jobTitle: knownForDepartment }),
    identifier: { "@type": "PropertyValue", name: "TMDB ID", value: String(person.tmdb_id) },
  };
}

export function collectionJsonLd(collection) {
  return {
    "@context": "https://schema.org",
    "@type": "Collection",
    name: collection.name,
    ...(collection.overview && { description: collection.overview }),
    ...(collection.poster_path && { image: tmdbImg(collection.poster_path, "w500") }),
    ...(collection.items?.length > 0 && {
      hasPart: collection.items.slice(0, 20).map((p) => ({ "@type": "Movie", name: p.title ?? p.name })),
    }),
  };
}

// items: the same { label, to }[] shape passed to <Breadcrumbs>/<AppLayout breadcrumbs>
// (the trailing item has no `to`).
export function breadcrumbJsonLd(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      ...(item.to && { item: `${BASE_URL}${item.to}` }),
    })),
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "watchpapa",
    url: BASE_URL,
    logo: `${BASE_URL}/logo_v3.1.png`,
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "watchpapa",
    url: BASE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: `${BASE_URL}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}
