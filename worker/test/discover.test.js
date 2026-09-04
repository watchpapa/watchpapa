import { describe, it, expect } from "vitest";
import { discoverParams, parseProviderIds, parseMonetization, isValidRegion } from "../src/tmdb/discover.js";

const baseLocale = { language: "en-US", region: null, native: null, includeAdult: false };

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
