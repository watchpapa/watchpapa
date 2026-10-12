import { describe, it, expect } from "vitest";
import { buildMeta, notFound } from "../src/lib/meta.js";
import {
  movieJsonLd,
  tvSeriesJsonLd,
  tvSeasonJsonLd,
  tvEpisodeJsonLd,
  personJsonLd,
  collectionJsonLd,
  breadcrumbJsonLd,
  organizationJsonLd,
  websiteJsonLd,
} from "../src/lib/structuredData.js";

const movie = {
  tmdb_id: 550,
  title: "Fight Club",
  overview: "A ticking-time-bomb insomniac...",
  release_date: "1999-10-15",
  runtime: 139,
  poster_path: "/poster.jpg",
  backdrop_path: "/backdrop.jpg",
  genres: [{ id: 18, name: "Drama" }],
};

const show = {
  tmdb_id: 1399,
  name: "Game of Thrones",
  overview: "Seven noble families fight...",
  first_air_date: "2011-04-17",
  last_air_date: "2019-05-19",
  status: "Ended",
  poster_path: "/show-poster.jpg",
  backdrop_path: "/show-backdrop.jpg",
  number_of_seasons: 8,
  number_of_episodes: 73,
  genres: [{ id: 18, name: "Drama" }],
};

const season = { season_number: 1, name: "Season 1", overview: "The first season.", air_date: "2011-04-17", poster_path: "/season.jpg" };
const episode = { episode_number: 1, name: "Winter Is Coming", overview: "Ned Stark...", air_date: "2011-04-17", poster_path: "/episode.jpg" };

const person = {
  tmdb_id: 819,
  name: "Edward Norton",
  biography: "An American actor.",
  profile_path: "/norton.jpg",
  birthday: "1969-08-18",
  place_of_birth: "Boston, Massachusetts, USA",
  known_for_department: "Acting",
};

const collection = {
  name: "Alien Collection",
  overview: "The Alien franchise.",
  poster_path: "/collection.jpg",
  backdrop_path: "/collection-backdrop.jpg",
  parts: [{ title: "Alien" }, { title: "Aliens" }],
};

describe("structuredData builders", () => {
  it("movieJsonLd includes TMDB id and image", () => {
    const ld = movieJsonLd(movie);
    expect(ld["@type"]).toBe("Movie");
    expect(ld.identifier.value).toBe("550");
    expect(ld.image).toBe("https://image.tmdb.org/t/p/w500/poster.jpg");
    expect(ld.duration).toBe("PT139M");
  });

  it("tvSeriesJsonLd sets endDate only when ended", () => {
    const ld = tvSeriesJsonLd(show);
    expect(ld["@type"]).toBe("TVSeries");
    expect(ld.endDate).toBe("2019-05-19");
    expect(tvSeriesJsonLd({ ...show, status: "Returning Series" }).endDate).toBeUndefined();
  });

  it("tvSeasonJsonLd + tvEpisodeJsonLd nest under the series", () => {
    expect(tvSeasonJsonLd(season, show).partOfSeries).toEqual({ "@type": "TVSeries", name: "Game of Thrones" });
    const ep = tvEpisodeJsonLd(episode, season, show);
    expect(ep.partOfSeason).toEqual({ "@type": "TVSeason", seasonNumber: 1 });
    expect(ep.partOfSeries.name).toBe("Game of Thrones");
  });

  it("personJsonLd truncates long biographies", () => {
    const ld = personJsonLd({ ...person, biography: "x".repeat(600) });
    expect(ld.description.length).toBe(500);
  });

  it("collectionJsonLd caps hasPart at 20", () => {
    const parts = Array.from({ length: 25 }, (_, i) => ({ title: `Movie ${i}` }));
    const ld = collectionJsonLd({ ...collection, parts });
    expect(ld.hasPart).toHaveLength(20);
  });

  it("breadcrumbJsonLd positions items in order and omits item for the trailing crumb", () => {
    const ld = breadcrumbJsonLd([{ label: "Movies", path: "/movies" }, { label: "Fight Club" }]);
    expect(ld.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Movies", item: "https://watchpapa.tv/movies" },
      { "@type": "ListItem", position: 2, name: "Fight Club" },
    ]);
  });

  it("organizationJsonLd + websiteJsonLd carry the search action", () => {
    expect(organizationJsonLd().url).toBe("https://watchpapa.tv");
    expect(websiteJsonLd().potentialAction.target).toBe("https://watchpapa.tv/search?q={search_term_string}");
  });
});

describe("buildMeta", () => {
  it("movie: title includes the release year and a Movie + BreadcrumbList pair", () => {
    const m = buildMeta("movie", { movie, path: "/movies/550" });
    expect(m.httpStatus).toBe(200);
    expect(m.title).toBe("Fight Club (1999) — watchpapa");
    expect(m.ogType).toBe("video.movie");
    expect(m.canonical).toBe("https://watchpapa.tv/movies/550");
    expect(m.jsonLd.map((o) => o["@type"])).toEqual(["Movie", "BreadcrumbList"]);
  });

  it("show: uses the show name as title", () => {
    const m = buildMeta("show", { show, path: "/shows/1399" });
    expect(m.title).toBe("Game of Thrones — watchpapa");
    expect(m.ogType).toBe("video.tv_show");
  });

  it("season: falls back to the show overview when the season has none", () => {
    const m = buildMeta("season", { season: { ...season, overview: "" }, show, path: "/shows/1399/seasons/1" });
    expect(m.description).toBe(show.overview);
  });

  it("episode: builds a nested breadcrumb trail", () => {
    const m = buildMeta("episode", { episode, season, show, path: "/shows/1399/seasons/1/episodes/1" });
    const crumbs = m.jsonLd.find((o) => o["@type"] === "BreadcrumbList");
    expect(crumbs.itemListElement).toHaveLength(4);
  });

  it("person: ogType is profile", () => {
    const m = buildMeta("person", { person, path: "/people/819" });
    expect(m.ogType).toBe("profile");
    expect(m.title).toBe("Edward Norton — watchpapa");
  });

  it("collection: builds from poster/backdrop fallback", () => {
    const m = buildMeta("collection", { collection, path: "/collections/8091" });
    expect(m.ogImage).toBe("https://image.tmdb.org/t/p/w1280/collection-backdrop.jpg");
  });

  it("home: includes Organization + WebSite", () => {
    const m = buildMeta("home", {});
    expect(m.jsonLd.map((o) => o["@type"])).toEqual(["Organization", "WebSite"]);
  });

  it("static: uses the supplied copy verbatim", () => {
    const m = buildMeta("static", { path: "/about", staticTitle: "About watchpapa", staticDescription: "x" });
    expect(m.title).toBe("About watchpapa — watchpapa");
    expect(m.description).toBe("x");
  });

  it("unknown kind + notFound() both report httpStatus 404 and noindex", () => {
    expect(buildMeta("nonsense", {})).toEqual(notFound());
    expect(notFound().httpStatus).toBe(404);
    expect(notFound().noindex).toBe(true);
  });
});
