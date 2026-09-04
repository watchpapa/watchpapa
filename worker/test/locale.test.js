import { describe, it, expect } from "vitest";
import { readLocale } from "../src/tmdb/locale.js";

function fakeCtx(query) {
  return { req: { query: (k) => query[k] } };
}

describe("readLocale", () => {
  it("defaults to en-US / no region / no native / adult off", () => {
    const loc = readLocale(fakeCtx({}));
    expect(loc).toEqual({ language: "en-US", region: null, native: null, includeAdult: false, providers: [] });
  });

  it("accepts a valid language and rejects a malformed one", () => {
    expect(readLocale(fakeCtx({ lang: "pl-PL" })).language).toBe("pl-PL");
    expect(readLocale(fakeCtx({ lang: "pl" })).language).toBe("en-US");
    expect(readLocale(fakeCtx({ lang: "PL-pl" })).language).toBe("en-US");
  });

  it("accepts a valid region and rejects a malformed one", () => {
    expect(readLocale(fakeCtx({ region: "PL" })).region).toBe("PL");
    expect(readLocale(fakeCtx({ region: "pl" })).region).toBeNull();
    expect(readLocale(fakeCtx({ region: "POL" })).region).toBeNull();
  });

  it("accepts a valid native code", () => {
    expect(readLocale(fakeCtx({ native: "pl" })).native).toBe("pl");
    expect(readLocale(fakeCtx({ native: "PL" })).native).toBeNull();
  });

  it("accepts either include_adult or includeAdult spelling", () => {
    expect(readLocale(fakeCtx({ include_adult: "true" })).includeAdult).toBe(true);
    expect(readLocale(fakeCtx({ includeAdult: "true" })).includeAdult).toBe(true);
    expect(readLocale(fakeCtx({})).includeAdult).toBe(false);
  });

  it("parses a pipe-separated provider id list, capped and filtered", () => {
    expect(readLocale(fakeCtx({ providers: "8|337|0|abc" })).providers).toEqual([8, 337]);
  });
});
