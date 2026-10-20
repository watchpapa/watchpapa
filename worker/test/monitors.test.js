import { describe, it, expect } from "vitest";
import {
  quotaLevels,
  estimateQuotaUse,
  highestLevelReached,
  buildQuotaText,
  buildErrorText,
  buildSignupText,
} from "../src/monitors.js";

describe("quotaLevels", () => {
  it("parses a comma list, sorted, falling back to defaults", () => {
    expect(quotaLevels("80000, 50000")).toEqual([50000, 80000]);
    expect(quotaLevels("")).toEqual([50000, 80000]);
    expect(quotaLevels("abc")).toEqual([50000, 80000]);
  });
});

describe("estimateQuotaUse", () => {
  it("adds api + html + one cron run per elapsed minute of the UTC day", () => {
    const now = Date.UTC(2026, 9, 20, 10, 30); // 630 minutes in
    expect(estimateQuotaUse({ api: 1000, html: 500, now })).toBe(1000 + 500 + 630);
    expect(estimateQuotaUse({ now })).toBe(630);
  });
});

describe("highestLevelReached", () => {
  it("returns the highest crossed level or null", () => {
    expect(highestLevelReached(49_999, [50000, 80000])).toBeNull();
    expect(highestLevelReached(50_000, [50000, 80000])).toBe(50000);
    expect(highestLevelReached(91_000, [50000, 80000])).toBe(80000);
  });
});

describe("alert text", () => {
  it("quota text shows used, limit and percentage", () => {
    const t = buildQuotaText(81_234, 80000);
    expect(t).toContain("81,234");
    expect(t).toContain("100,000");
    expect(t).toContain("81%");
  });
  it("error text totals the 5xx and lists each status", () => {
    const t = buildErrorText([{ count: 12, dimensions: { edgeResponseStatus: 502 } }, { count: 5, dimensions: { edgeResponseStatus: 500 } }], 15);
    expect(t).toContain("17 5xx");
    expect(t).toContain("502: 12");
  });
  it("signup text lists username/provider, never an email, and the total", () => {
    const rows = [
      { username: "alice", provider: "email", window_count: 2, total: 321 },
      { username: null, provider: "google", window_count: 2, total: 321 },
    ];
    const t = buildSignupText(rows);
    expect(t).toContain("2 new watchpapa registrations");
    expect(t).toContain("• alice via email");
    expect(t).toContain("(username not chosen yet) via google");
    expect(t).toContain("Total users: 321");
    expect(t).not.toContain("@");
  });
  it("signup text notes overflow beyond the row cap", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ username: `u${i}`, provider: "email", window_count: 14, total: 500 }));
    expect(buildSignupText(rows)).toContain("…and 4 more");
  });
});
