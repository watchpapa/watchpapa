import { describe, it, expect } from "vitest";
import { isNsfw, filterNsfw, withoutKeywordsParam, withKeywordsParam, parseNsfwKeywordIds, NSFW_CATEGORIES, NSFW_KEYWORD_IDS, NSFW_ALLOW_IDS } from "../src/tmdb/nsfw.js";

describe("isNsfw", () => {
  it("flags adult=true regardless of anything else", () => {
    expect(isNsfw({ id: 1, title: "Anything", adult: true })).toBe(true);
  });

  it("flags a movie-shaped keywords append (keywords.keywords[])", () => {
    expect(isNsfw({ id: 2, title: "X", adult: false, keywords: { keywords: [{ id: 356759, name: "porn" }] } })).toBe(true);
  });

  it("flags a tv-shaped keywords append (keywords.results[])", () => {
    expect(isNsfw({ id: 3, name: "X", adult: false, keywords: { results: [{ id: 198385, name: "hentai" }] } }, "tv")).toBe(true);
  });

  it("does not flag a generic keyword like nudity or erotic thriller", () => {
    expect(isNsfw({ id: 4, title: "X", adult: false, keywords: { keywords: [{ id: 281741, name: "nudity" }, { id: 207767, name: "erotic thriller" }] } })).toBe(false);
  });

  it("flags via the title regex when no keywords are present", () => {
    expect(isNsfw({ id: 5, title: "Softcore Nights", adult: false })).toBe(true);
    expect(isNsfw({ id: 6, original_title: "Hentai Kamen", adult: false })).toBe(true);
  });

  it("leaves an unrelated title alone", () => {
    expect(isNsfw({ id: 8, title: "The Nun", adult: false })).toBe(false);
  });

  it("the title regex can still false-positive on a word like 'erotic' in an unrelated title — use NSFW_ALLOW_IDS for known collisions", () => {
    expect(isNsfw({ id: 7, title: "The Erotic Thriller Genre", adult: false })).toBe(true);
  });

  it("respects the allowlist by id before the title regex", () => {
    NSFW_ALLOW_IDS.movie.add(9999);
    expect(isNsfw({ id: 9999, title: "xXx: Return of Xander Cage", adult: false }, "movie")).toBe(false);
    NSFW_ALLOW_IDS.movie.delete(9999);
  });

  it("keyword hits are never bypassed by the allowlist", () => {
    NSFW_ALLOW_IDS.movie.add(42);
    expect(isNsfw({ id: 42, title: "X", adult: false, keywords: { keywords: [{ id: 356759, name: "porn" }] } }, "movie")).toBe(true);
    NSFW_ALLOW_IDS.movie.delete(42);
  });
});

describe("filterNsfw", () => {
  it("passes everything through when includeAdult is true", () => {
    const rows = [{ id: 1, title: "X", adult: true }];
    expect(filterNsfw(rows, true)).toEqual(rows);
  });
  it("drops nsfw rows when includeAdult is false", () => {
    const rows = [{ id: 1, title: "ok", adult: false }, { id: 2, title: "porn film", adult: false }];
    expect(filterNsfw(rows, false).map((r) => r.id)).toEqual([1]);
  });
});

describe("withoutKeywordsParam", () => {
  it("pipe-joins every blocked keyword id (OR semantics for exclusion)", () => {
    const param = withoutKeywordsParam();
    expect(param.split("|").map(Number).sort((a, b) => a - b)).toEqual([...NSFW_KEYWORD_IDS].sort((a, b) => a - b));
    expect(param).not.toContain(",");
  });
});

describe("withKeywordsParam", () => {
  it("is the same curated id set as withoutKeywordsParam, just used for inclusion (the hidden /adult page)", () => {
    expect(withKeywordsParam()).toBe(withoutKeywordsParam());
  });
});

describe("NSFW_CATEGORIES / parseNsfwKeywordIds", () => {
  it("every category id is in the curated set, and the categories cover the whole set", () => {
    const all = new Set(NSFW_CATEGORIES.flatMap((c) => c.ids.split("|").map(Number)));
    for (const id of all) expect(NSFW_KEYWORD_IDS.has(id)).toBe(true);
    expect([...all].sort((a, b) => a - b)).toEqual([...NSFW_KEYWORD_IDS].sort((a, b) => a - b));
  });

  it("keeps only ids from the curated set; nothing valid -> null", () => {
    expect(parseNsfwKeywordIds("198385|155477")).toBe("198385|155477");
    expect(parseNsfwKeywordIds("198385|28")).toBe("198385"); // 28 = Action genre id, not a keyword we allow
    expect(parseNsfwKeywordIds("28")).toBeNull();
    expect(parseNsfwKeywordIds("")).toBeNull();
    expect(parseNsfwKeywordIds(undefined)).toBeNull();
  });
});
