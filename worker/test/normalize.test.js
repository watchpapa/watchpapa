import { describe, it, expect } from "vitest";
import {
  normalizeMovie,
  normalizeShow,
  normalizeSeason,
  normalizeEpisode,
  normalizePerson,
  toCard,
  normalizeSearchResults,
} from "../src/tmdb/normalize.js";

describe("normalizeMovie", () => {
  const raw = {
    id: 550,
    title: "Fight Club",
    original_title: "Fight Club",
    release_date: "1999-10-15",
    runtime: 139,
    vote_average: 8.4,
    popularity: 42,
    adult: false,
    genres: [{ id: 18, name: "Drama" }],
    credits: {
      cast: [{ id: 819, name: "Edward Norton", profile_path: "/x.jpg", character: "Narrator", order: 0 }],
      crew: [{ id: 7467, name: "David Fincher", profile_path: "/y.jpg", job: "Director", department: "Directing" }],
    },
  };
  it("maps id to tmdb_id and flattens credits", () => {
    const m = normalizeMovie(raw);
    expect(m.id).toBe(550);
    expect(m.tmdb_id).toBe(550);
    expect(m.tmdb_vote_avg).toBe(8.4);
    expect(m.genre_ids).toEqual([18]);
    expect(m.cast[0]).toMatchObject({ personId: 819, character: "Narrator" });
    expect(m.crew.find((x) => x.job === "Director").department).toBe("Directing");
  });
});

describe("normalizeShow", () => {
  it("flattens aggregate_credits roles[] / jobs[]", () => {
    const s = normalizeShow({
      id: 1399,
      name: "Game of Thrones",
      status: "Ended",
      episode_run_time: [60],
      seasons: [{ id: 1, name: "Season 1", season_number: 1, air_date: "2011-04-17", episode_count: 10 }],
      aggregate_credits: {
        cast: [{ id: 1, name: "Peter", roles: [{ character: "Tyrion" }], order: 0 }],
        crew: [{ id: 2, name: "David", department: "Directing", jobs: [{ job: "Director" }] }],
      },
    });
    expect(s.episode_run_time).toBe(60);
    expect(s.seasons[0].episode_count).toBe(10);
    expect(s.cast[0].character).toBe("Tyrion");
    expect(s.crew[0]).toMatchObject({ job: "Director", department: "Directing" });
  });
});

describe("normalizeSeason / normalizeEpisode", () => {
  it("aliases still_path to poster_path", () => {
    const se = normalizeSeason(
      { id: 3624, name: "Season 1", season_number: 1, episodes: [{ id: 63056, name: "Winter Is Coming", episode_number: 1, still_path: "/e.jpg", runtime: 62 }] },
      1399,
    );
    expect(se.show_id).toBe(1399);
    expect(se.episodes[0].poster_path).toBe("/e.jpg");

    const ep = normalizeEpisode({ id: 63056, name: "Winter Is Coming", episode_number: 1, season_number: 1, still_path: "/e.jpg", credits: { cast: [], crew: [], guest_stars: [{ id: 9, name: "Guest" }] } }, 1399);
    expect(ep.poster_path).toBe("/e.jpg");
    expect(ep.cast.find((x) => x.name === "Guest")).toBeTruthy();
  });
});

describe("normalizePerson", () => {
  it("inverts combined_credits and dedupes", () => {
    const p = normalizePerson({
      id: 287,
      name: "Brad Pitt",
      known_for_department: "Acting",
      also_known_as: ["William Bradley Pitt"],
      combined_credits: {
        cast: [
          { id: 63, media_type: "movie", title: "Twelve Monkeys", character: "Jeffrey", release_date: "1995-12-29" },
          { id: 63, media_type: "movie", title: "Twelve Monkeys", character: "Jeffrey", release_date: "1995-12-29" },
        ],
        crew: [{ id: 100, media_type: "tv", name: "Show", job: "Producer", department: "Production", first_air_date: "2010-01-01" }],
      },
    });
    expect(p.credits.filter((x) => x.mediaId === 63)).toHaveLength(1);
    expect(p.credits.find((x) => x.job === "Producer").type).toBe("show");
  });
});

describe("toCard", () => {
  it("movie list item", () => {
    const card = toCard("movie", { id: 1, title: "X", release_date: "2020-01-02", genre_ids: [28], vote_average: 7 });
    expect(card).toMatchObject({ type: "movie", id: 1, year: "2020", genre_ids: [28], tmdb_vote_avg: 7 });
  });
  it("show list item uses name", () => {
    const card = toCard("show", { id: 2, name: "Y", first_air_date: "2019-05-06" });
    expect(card.title).toBe("Y");
    expect(card.year).toBe("2019");
  });
});

describe("normalizeSearchResults", () => {
  // /search/multi returns one relevance-ordered list; each row carries its own
  // media_type. Order must be preserved (that ranking IS the "most relevant
  // first" behaviour) — no re-sort inside normalizeSearchResults.
  const raw = {
    page: 1,
    total_pages: 3,
    results: [
      { id: 1, media_type: "tv", name: "Breaking Bad", first_air_date: "2008-01-20", popularity: 200, vote_average: 8.9, adult: false },
      { id: 2, media_type: "movie", title: "ok", adult: false, popularity: 10, release_date: "2020-01-01" },
      { id: 3, media_type: "movie", title: "nsfw", adult: true, popularity: 5 },
      { id: 4, media_type: "person", name: "P", adult: false, popularity: 7 },
      { id: 5, media_type: "collection", name: "ignored" }, // unsupported media_type, must be dropped
    ],
  };

  it("filters adult unless requested, drops unsupported media_types, preserves TMDB's relevance order", () => {
    const safe = normalizeSearchResults(raw, false);
    expect(safe.map((r) => r.tmdbId)).toEqual([1, 2, 4]); // order preserved, id 3 (adult) and 5 (collection) dropped
    const all = normalizeSearchResults(raw, true);
    expect(all.map((r) => r.tmdbId)).toEqual([1, 2, 3, 4]); // still no id 5
  });

  it("maps tv -> show and carries year/date/voteAverage for movie/show, not person", () => {
    const [show, movie, person] = normalizeSearchResults(raw, false);
    expect(show).toMatchObject({ type: "show", tmdbId: 1, title: "Breaking Bad", year: "2008", date: "2008-01-20", voteAverage: 8.9 });
    expect(movie).toMatchObject({ type: "movie", tmdbId: 2, year: "2020", date: "2020-01-01" });
    expect(person).toMatchObject({ type: "person", tmdbId: 4, title: "P", year: null, date: null, voteAverage: 0 });
  });
});


describe("native title mode (opts.native)", () => {
  it("swaps in the original title/name only when original_language matches native", () => {
    const pl = normalizeMovie(
      { id: 1, title: "Peasants", original_title: "Chłopi", original_language: "pl" },
      { native: "pl" },
    );
    expect(pl.title).toBe("Chłopi");

    const en = normalizeMovie(
      { id: 2, title: "Dune", original_title: "Dune", original_language: "en" },
      { native: "pl" },
    );
    expect(en.title).toBe("Dune");

    const show = normalizeShow(
      { id: 3, name: "1899 EN", original_name: "1899", original_language: "de" },
      { native: "de" },
    );
    expect(show.name).toBe("1899");
  });

  it("toCard and search results apply the same swap", () => {
    const card = toCard("movie", { id: 4, title: "Translated", original_title: "Original", original_language: "pl" }, { native: "pl" });
    expect(card.title).toBe("Original");

    const results = normalizeSearchResults(
      { results: [{ id: 5, media_type: "movie", title: "Translated", original_title: "Original", original_language: "pl", adult: false }] },
      false,
      { native: "pl" },
    );
    expect(results[0].title).toBe("Original");
  });
});

describe("regional release date", () => {
  const raw = {
    id: 10,
    title: "X",
    release_date: "2024-01-01",
    release_dates: {
      results: [
        {
          iso_3166_1: "PL",
          release_dates: [
            { type: 4, release_date: "2024-02-10T00:00:00.000Z" },
            { type: 3, release_date: "2024-01-20T00:00:00.000Z" },
            { type: 2, release_date: "2024-01-15T00:00:00.000Z" },
          ],
        },
      ],
    },
  };
  it("prefers theatrical (3) over limited (2) over digital (4), earliest date of that type", () => {
    const m = normalizeMovie(raw, { region: "PL" });
    expect(m.release_date_regional).toBe("2024-01-20");
    expect(m.release_date_effective).toBe("2024-01-20");
    expect(m.release_date).toBe("2024-01-01"); // primary unchanged
  });
  it("falls back to the primary date when the region has no release_dates entry", () => {
    const m = normalizeMovie(raw, { region: "DE" });
    expect(m.release_date_regional).toBeNull();
    expect(m.release_date_effective).toBe("2024-01-01");
  });
  it("toCard exposes date (effective) and date_primary", () => {
    const card = toCard("movie", raw, { region: "PL" });
    expect(card.date).toBe("2024-01-20");
    expect(card.date_primary).toBe("2024-01-01");
  });
});

describe("nsfw flag", () => {
  it("flags movies via keyword id even when adult=false", () => {
    const m = normalizeMovie({ id: 20, title: "Some Movie", adult: false, keywords: { keywords: [{ id: 356759, name: "porn" }] } });
    expect(m.nsfw).toBe(true);
  });
  it("does not flag mainstream titles", () => {
    const m = normalizeMovie({ id: 21, title: "Fight Club", adult: false, keywords: { keywords: [{ id: 818, name: "based on novel" }] } });
    expect(m.nsfw).toBe(false);
  });
});

describe("watch providers compaction", () => {
  it("dedupes provider metadata and drops empty regions", () => {
    const wp = normalizeMovie({
      id: 30,
      title: "X",
      "watch/providers": {
        results: {
          US: { link: "https://x", flatrate: [{ provider_id: 8, provider_name: "Netflix", logo_path: "/n.jpg", display_priority: 0 }] },
          FR: {},
        },
      },
    }).watch_providers;
    expect(wp.providers["8"]).toEqual({ name: "Netflix", logo_path: "/n.jpg" });
    expect(wp.regions.US.flatrate).toEqual([8]);
    expect(wp.regions.FR).toBeUndefined();
  });
});

describe("normalizePerson credit enrichment", () => {
  it("carries popularity/voteAverage/voteCount/episodeCount/date/year per credit", () => {
    const p = normalizePerson({
      id: 287,
      name: "Brad Pitt",
      combined_credits: {
        cast: [
          {
            id: 63,
            media_type: "movie",
            title: "Twelve Monkeys",
            original_title: "Twelve Monkeys",
            original_language: "en",
            character: "Jeffrey",
            release_date: "1995-12-29",
            popularity: 12.3,
            vote_average: 7.8,
            vote_count: 4000,
          },
        ],
        crew: [
          {
            id: 100,
            media_type: "tv",
            name: "Show",
            job: "Producer",
            department: "Production",
            first_air_date: "2010-01-01",
            episode_count: 12,
          },
        ],
      },
    });
    const cast = p.credits.find((c) => c.mediaId === 63);
    expect(cast).toMatchObject({ date: "1995-12-29", year: "1995", popularity: 12.3, voteAverage: 7.8, voteCount: 4000 });
    const crew = p.credits.find((c) => c.mediaId === 100);
    expect(crew.episodeCount).toBe(12);
  });
});
