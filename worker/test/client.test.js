import { describe, it, expect } from "vitest";
import { buildUrl } from "../src/tmdb/client.js";

describe("buildUrl", () => {
  it("orders api_key, then language, then params — stable for the edge cache key", () => {
    const url = new URL(buildUrl("/movie/550", { page: 2 }, "KEY", "pl-PL"));
    expect([...url.searchParams.keys()]).toEqual(["api_key", "language", "page"]);
    expect(url.searchParams.get("language")).toBe("pl-PL");
  });

  it("defaults language to en-US when not passed", () => {
    const url = new URL(buildUrl("/movie/550", {}, "KEY"));
    expect(url.searchParams.get("language")).toBe("en-US");
  });

  it("a params key overrides nothing about language position and keeps false values", () => {
    const url = new URL(buildUrl("/discover/movie", { include_adult: false }, "KEY", "en-US"));
    expect(url.searchParams.get("include_adult")).toBe("false");
  });

  it("drops undefined/null/empty-string params but keeps everything else", () => {
    const url = new URL(buildUrl("/discover/movie", { with_genres: undefined, page: 1, q: "" }, "KEY"));
    expect(url.searchParams.has("with_genres")).toBe(false);
    expect(url.searchParams.has("q")).toBe(false);
    expect(url.searchParams.get("page")).toBe("1");
  });
});
