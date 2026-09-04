import { describe, it, expect, vi, afterEach } from "vitest";
import { discoverParams, parseProviderIds, parseMonetization, parseDiscoverSort, isValidRegion, backfillShowStatus } from "../src/tmdb/discover.js";
import { withKeywordsParam, withoutKeywordsParam } from "../src/tmdb/nsfw.js";

const baseLocale = { language: "en-US", region: null, native: null, includeAdult: false };

describe("discoverParams adult-only / sort (the /adult page)", () => {
  const adultLocale = { ...baseLocale, includeAdult: true };

  it("adultOnly selects the full curated set via with_keywords and drops without_keywords when adult is on", () => {
    const p = discoverParams({ type: "movie", locale: adultLocale, adultOnly: true });
    expect(p.with_keywords).toBe(withKeywordsParam());
    expect(p.without_keywords).toBeUndefined();
  });

  it("adultOnly with adult OFF sends both with_ and without_ the same ids (TMDB returns nothing) — no separate gate", () => {
    const p = discoverParams({ type: "movie", locale: baseLocale, adultOnly: true });
    expect(p.with_keywords).toBe(withoutKeywordsParam());
    expect(p.without_keywords).toBe(withoutKeywordsParam());
  });

  it("keywordIds narrows with_keywords to one category", () => {
    const p = discoverParams({ type: "tv", locale: adultLocale, adultOnly: true, keywordIds: "198385" });
    expect(p.with_keywords).toBe("198385");
  });

  it("sort maps per media type; rated adds a vote_count floor; unknown keeps popularity", () => {
    expect(discoverParams({ type: "movie", locale: adultLocale, sort: "newest" }).sort_by).toBe("primary_release_date.desc");
    expect(discoverParams({ type: "tv", locale: adultLocale, sort: "newest" }).sort_by).toBe("first_air_date.desc");
    const rated = discoverParams({ type: "movie", locale: adultLocale, sort: "rated" });
    expect(rated.sort_by).toBe("vote_average.desc");
    expect(rated["vote_count.gte"]).toBe(20);
    expect(discoverParams({ type: "movie", locale: adultLocale, sort: null }).sort_by).toBe("popularity.desc");
    expect(parseDiscoverSort("rated")).toBe("rated");
    expect(parseDiscoverSort("bogus")).toBeNull();
    expect(parseDiscoverSort("")).toBeNull();
  });
});

describe("discoverParams", () => {
  it("adds without_keywords only when adult is off", () => {
    const off = discoverParams({ type: "movie", locale: baseLocale });
    expect(off.without_keywords).toBeTruthy();
    const on = discoverParams({ type: "movie", locale: { ...baseLocale, includeAdult: true } });
    expect(on.without_keywords).toBeUndefined();
  });

  it("upcoming movie without a region uses primary_release_date.gte", () => {
    const p = discoverParams({ type: "movie", locale: baseLocale, upcoming: true, today: "2026-09-04" });
    expect(p["primary_release_date.gte"]).toBe("2026-09-04");
    expect(p["release_date.gte"]).toBeUndefined();
    expect(p.with_release_type).toBe("2|3");
  });

  it("upcoming movie with a region uses release_date.gte and sets region", () => {
    const p = discoverParams({ type: "movie", locale: { ...baseLocale, region: "PL" }, upcoming: true, today: "2026-09-04" });
    expect(p["release_date.gte"]).toBe("2026-09-04");
    expect(p["primary_release_date.gte"]).toBeUndefined();
    expect(p.region).toBe("PL");
  });

  it("upcoming tv uses first_air_date.gte and never sets region", () => {
    const p = discoverParams({ type: "tv", locale: { ...baseLocale, region: "PL" }, upcoming: true, today: "2026-09-04" });
    expect(p["first_air_date.gte"]).toBe("2026-09-04");
    expect(p.region).toBeUndefined();
  });

  it("applies extraParams (e.g. vote_count.gte) from a list-kind spec", () => {
    const p = discoverParams({ type: "movie", locale: baseLocale, extraParams: { sort_by: "vote_average.desc", "vote_count.gte": 300 } });
    expect(p.sort_by).toBe("vote_average.desc");
    expect(p["vote_count.gte"]).toBe(300);
  });

  it("sets provider params only when both providerIds and watchRegion are present", () => {
    const withRegion = discoverParams({ type: "movie", locale: baseLocale, providerIds: [8, 337], watchRegion: "US", monetization: "flatrate" });
    expect(withRegion.with_watch_providers).toBe("8|337");
    expect(withRegion.watch_region).toBe("US");
    expect(withRegion.with_watch_monetization_types).toBe("flatrate");

    const noRegion = discoverParams({ type: "movie", locale: baseLocale, providerIds: [8, 337] });
    expect(noRegion.with_watch_providers).toBeUndefined();
  });
});

describe("parseProviderIds", () => {
  it("parses a valid pipe list and rejects garbage", () => {
    expect(parseProviderIds("8|337")).toEqual([8, 337]);
    expect(parseProviderIds("8,337")).toEqual([]);
    expect(parseProviderIds("")).toEqual([]);
    expect(parseProviderIds("abc")).toEqual([]);
  });
});

describe("parseMonetization", () => {
  it("keeps only known values", () => {
    expect(parseMonetization("flatrate|bogus|ads")).toBe("flatrate|ads");
    expect(parseMonetization("")).toBe("");
  });
});

describe("isValidRegion", () => {
  it("requires two uppercase letters", () => {
    expect(isValidRegion("PL")).toBe(true);
    expect(isValidRegion("pl")).toBe(false);
    expect(isValidRegion("")).toBe(false);
  });
});

describe("backfillShowStatus", () => {
  const fakeEnv = { TMDB_API_KEY_SECRET: "key" };

  function jsonResponse(body, ok = true) {
    return { ok, status: ok ? 200 : 404, headers: { get: () => null }, json: async () => body, text: async () => "" };
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fills status/in_production/last_air_date on show cards missing status; leaves movies and already-known shows alone", async () => {
    const cards = [
      { type: "show", id: 1, status: null },
      { type: "movie", id: 2, status: null },
      { type: "show", id: 3, status: "Returning Series" },
    ];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      expect(new URL(url).pathname).toBe("/3/tv/1"); // the only id that should ever be fetched
      return Promise.resolve(jsonResponse({ status: "Ended", in_production: false, last_air_date: "2022-08-15" }));
    });
    await backfillShowStatus(fakeEnv, cards, "en-US", 20);
    expect(cards[0]).toMatchObject({ status: "Ended", in_production: false, last_air_date: "2022-08-15" });
    expect(cards[1].status).toBeNull();
    expect(cards[2].status).toBe("Returning Series");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("caps how many shows get backfilled per call", async () => {
    const cards = Array.from({ length: 5 }, (_, i) => ({ type: "show", id: i + 1, status: null }));
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.resolve(jsonResponse({ status: "Ended" })));
    await backfillShowStatus(fakeEnv, cards, "en-US", 2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cards.filter((c) => c.status === "Ended")).toHaveLength(2);
  });

  it("leaves status null (does not throw) when the lookup fails", async () => {
    const cards = [{ type: "show", id: 9, status: null }];
    vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.resolve(jsonResponse({}, false)));
    await expect(backfillShowStatus(fakeEnv, cards, "en-US", 20)).resolves.toBeUndefined();
    expect(cards[0].status).toBeNull();
  });
});
