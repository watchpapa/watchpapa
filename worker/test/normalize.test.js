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
  it("filters adult unless requested and caps per type", () => {
    const data = {
      movie: { results: [{ id: 1, title: "ok", adult: false }, { id: 2, title: "nsfw", adult: true }] },
      tv: { results: [] },
      person: { results: [{ id: 3, name: "P", adult: false }] },
    };
    const safe = normalizeSearchResults(data, false);
    expect(safe.map((r) => r.tmdbId).sort()).toEqual([1, 3]);
    const all = normalizeSearchResults(data, true);
    expect(all).toHaveLength(3);
  });
});
