import { describe, it, expect } from "vitest";
import { sampleSeeds, addToProfile, topGenres, genreScore, popularityScore, scoreCandidate } from "../src/tmdb/recommend.js";

describe("sampleSeeds", () => {
  const items = Array.from({ length: 12 }, (_, i) => ({ type: "movie", id: i + 1, weight: i < 6 ? 10 : 1 }));
  it("returns everything when the pool fits", () => {
    expect(sampleSeeds(items.slice(0, 4), 6)).toHaveLength(4);
  });
  it("returns n distinct seeds", () => {
    const out = sampleSeeds(items, 6);
    expect(new Set(out.map((x) => x.id)).size).toBe(6);
  });
  it("varies between calls but favours high ratings", () => {
    const seen = new Set();
    let high = 0;
    for (let i = 0; i < 200; i++) {
      const out = sampleSeeds(items, 6);
      seen.add(out.map((x) => x.id).sort().join());
      high += out.filter((x) => x.weight === 10).length;
    }
    expect(seen.size).toBeGreaterThan(1);
    expect(high / 200).toBeGreaterThan(4);
  });
});

describe("taste profile + scoring", () => {
  it("accumulates weighted genres and ranks them", () => {
    const p = new Map();
    addToProfile(p, [18, 53], 9);
    addToProfile(p, [18, 35], 6);
    expect(topGenres(p, 2)).toEqual([18, 53]);
  });
  it("genreScore is 0 without a profile and higher for matching genres", () => {
    const p = new Map([[18, 15], [53, 9]]);
    expect(genreScore(new Map(), [18])).toBe(0);
    expect(genreScore(p, [18, 53])).toBeGreaterThan(genreScore(p, [99, 35]));
  });
  it("popularityScore is monotonic and capped at 1", () => {
    expect(popularityScore(5)).toBeLessThan(popularityScore(100));
    expect(popularityScore(1e6)).toBe(1);
  });
  it("a matching popular candidate outranks an off-taste obscure one", () => {
    const p = new Map([[18, 10]]);
    const fixed = () => 0.5;
    expect(scoreCandidate({ recScore: 0, genres: [18], popularity: 300 }, p, fixed)).toBeGreaterThan(
      scoreCandidate({ recScore: 0, genres: [35], popularity: 3 }, p, fixed),
    );
  });
});
