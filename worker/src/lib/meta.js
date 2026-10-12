// Builds the <head> tag values the Pages Function (Frontend/functions/_middleware.js)
// injects into the SPA shell for non-JS crawlers (social unfurlers, weaker search
// engines) — and that react-helmet-async reconciles to on hydration for everyone
// else. See worker/src/routes/meta.js for the HTTP layer.

import {
  img,
  movieJsonLd,
  tvSeriesJsonLd,
  tvSeasonJsonLd,
  tvEpisodeJsonLd,
  personJsonLd,
  collectionJsonLd,
  breadcrumbJsonLd,
  organizationJsonLd,
  websiteJsonLd,
} from "./structuredData.js";

const BASE_URL = "https://watchpapa.tv";
const SITE_NAME = "watchpapa";
const DEFAULT_DESC =
  "Discover and track films, shows, and people. Browse popular movies and TV shows, explore cast and crew, check upcoming releases — all in one place.";

function title(t) {
  return t ? `${t} — ${SITE_NAME}` : SITE_NAME;
}
function desc(d) {
  return (d || DEFAULT_DESC).slice(0, 200);
}
function ok(path, patch) {
  return { httpStatus: 200, noindex: false, canonical: `${BASE_URL}${path}`, jsonLd: [], ...patch };
}
export function notFound() {
  return { httpStatus: 404, noindex: true, title: `Page not found — ${SITE_NAME}`, description: DEFAULT_DESC, jsonLd: [] };
}

function backdropOrPoster(entity) {
  return img(entity.backdrop_path, "w1280") ?? img(entity.poster_path, "w500");
}

export function buildMeta(kind, payload) {
  switch (kind) {
    case "movie": {
      const { movie, path } = payload;
      const year = movie.release_date?.slice(0, 4);
      return ok(path, {
        title: title(year ? `${movie.title} (${year})` : movie.title),
        description: desc(movie.overview),
        ogType: "video.movie",
        ogImage: backdropOrPoster(movie),
        jsonLd: [movieJsonLd(movie), breadcrumbJsonLd([{ label: "Movies", path: "/movies" }, { label: movie.title }])],
      });
    }
    case "show": {
      const { show, path } = payload;
      return ok(path, {
        title: title(show.name),
        description: desc(show.overview),
        ogType: "video.tv_show",
        ogImage: backdropOrPoster(show),
        jsonLd: [tvSeriesJsonLd(show), breadcrumbJsonLd([{ label: "Shows", path: "/shows" }, { label: show.name }])],
      });
    }
    case "season": {
      const { season, show, path } = payload;
      return ok(path, {
        title: title(`${season.name} — ${show.name}`),
        description: desc(season.overview || show.overview),
        ogType: "website",
        ogImage: img(season.poster_path, "w500") ?? backdropOrPoster(show),
        jsonLd: [
          tvSeasonJsonLd(season, show),
          breadcrumbJsonLd([
            { label: "Shows", path: "/shows" },
            { label: show.name, path: `/shows/${show.tmdb_id}` },
            { label: season.name },
          ]),
        ],
      });
    }
    case "episode": {
      const { episode, season, show, path } = payload;
      return ok(path, {
        title: title(`${episode.name} — ${show.name} ${season.name}`),
        description: desc(episode.overview || show.overview),
        ogType: "video.episode",
        ogImage: img(episode.poster_path, "w500") ?? backdropOrPoster(show),
        jsonLd: [
          tvEpisodeJsonLd(episode, season, show),
          breadcrumbJsonLd([
            { label: "Shows", path: "/shows" },
            { label: show.name, path: `/shows/${show.tmdb_id}` },
            { label: season.name, path: `/shows/${show.tmdb_id}/seasons/${season.season_number}` },
            { label: episode.name },
          ]),
        ],
      });
    }
    case "person": {
      const { person, path } = payload;
      return ok(path, {
        title: title(person.name),
        description: desc(person.biography),
        ogType: "profile",
        ogImage: img(person.profile_path, "w780"),
        jsonLd: [personJsonLd(person), breadcrumbJsonLd([{ label: "People", path: "/people" }, { label: person.name }])],
      });
    }
    case "collection": {
      const { collection, path } = payload;
      return ok(path, {
        title: title(collection.name),
        description: desc(collection.overview),
        ogType: "website",
        ogImage: backdropOrPoster(collection),
        jsonLd: [collectionJsonLd(collection), breadcrumbJsonLd([{ label: "Collections", path: "/collections" }, { label: collection.name }])],
      });
    }
    case "home": {
      return ok("/", {
        title: title("Discover Films, Shows & People"),
        description: desc(),
        jsonLd: [organizationJsonLd(), websiteJsonLd()],
      });
    }
    case "static": {
      const { path, staticTitle, staticDescription } = payload;
      return ok(path, { title: title(staticTitle), description: desc(staticDescription) });
    }
    default:
      return notFound();
  }
}
