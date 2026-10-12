// schema.org JSON-LD builders, shared by the /api/meta edge-injection route.
// Mirrors (deliberately duplicated, not imported — different runtime/package)
// the inline jsonLd objects the frontend pages build in
// Frontend/src/pages/app/{Movie,Show,Person,Episode}Page.jsx. Keep the two in
// sync when either changes.

const BASE_URL = "https://watchpapa.tv";
const TMDB_IMG = "https://image.tmdb.org/t/p";

export function img(path, size = "w500") {
  return path ? `${TMDB_IMG}/${size}${path}` : null;
}

export function movieJsonLd(movie) {
  return {
    "@context": "https://schema.org",
    "@type": "Movie",
    name: movie.title,
    ...(movie.overview && { description: movie.overview }),
    ...(movie.release_date && { datePublished: movie.release_date }),
    ...(movie.poster_path && { image: img(movie.poster_path, "w500") }),
    ...(movie.runtime && { duration: `PT${movie.runtime}M` }),
    ...(movie.genres?.length > 0 && { genre: movie.genres.map((g) => g.name) }),
    identifier: { "@type": "PropertyValue", name: "TMDB ID", value: String(movie.tmdb_id) },
  };
}

export function tvSeriesJsonLd(show) {
  return {
    "@context": "https://schema.org",
    "@type": "TVSeries",
    name: show.name,
    ...(show.overview && { description: show.overview }),
    ...(show.first_air_date && { datePublished: show.first_air_date }),
    ...(show.status === "Ended" && show.last_air_date && { endDate: show.last_air_date }),
    ...(show.poster_path && { image: img(show.poster_path, "w500") }),
    ...(show.number_of_seasons && { numberOfSeasons: show.number_of_seasons }),
    ...(show.number_of_episodes && { numberOfEpisodes: show.number_of_episodes }),
    ...(show.genres?.length > 0 && { genre: show.genres.map((g) => g.name) }),
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
    ...(season.poster_path && { image: img(season.poster_path, "w500") }),
    ...(show?.name && { partOfSeries: { "@type": "TVSeries", name: show.name } }),
  };
}

export function tvEpisodeJsonLd(episode, season, show) {
  return {
    "@context": "https://schema.org",
    "@type": "TVEpisode",
    name: episode.name,
    episodeNumber: episode.episode_number,
    ...(season && { partOfSeason: { "@type": "TVSeason", seasonNumber: season.season_number } }),
    ...(show?.name && { partOfSeries: { "@type": "TVSeries", name: show.name } }),
    ...(episode.overview && { description: episode.overview }),
    ...(episode.air_date && { datePublished: episode.air_date }),
  };
}

export function personJsonLd(person) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: person.name,
    ...(person.biography && { description: person.biography.slice(0, 500) }),
    ...(person.profile_path && { image: img(person.profile_path, "w342") }),
    ...(person.birthday && { birthDate: person.birthday }),
    ...(person.place_of_birth && { birthPlace: { "@type": "Place", name: person.place_of_birth } }),
    ...(person.known_for_department && { jobTitle: person.known_for_department }),
    identifier: { "@type": "PropertyValue", name: "TMDB ID", value: String(person.tmdb_id) },
  };
}

export function collectionJsonLd(collection) {
  return {
    "@context": "https://schema.org",
    "@type": "Collection",
    name: collection.name,
    ...(collection.overview && { description: collection.overview }),
    ...(collection.poster_path && { image: img(collection.poster_path, "w500") }),
    ...(collection.parts?.length > 0 && {
      hasPart: collection.parts.slice(0, 20).map((p) => ({ "@type": "Movie", name: p.title ?? p.name })),
    }),
  };
}

// items: [{ label, path }] in order, root-first. The last item has no `path` —
// matches how Frontend/src/components/layout/Breadcrumbs.jsx receives its trail.
export function breadcrumbJsonLd(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      ...(item.path && { item: `${BASE_URL}${item.path}` }),
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
