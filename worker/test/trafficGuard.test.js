import { describe, it, expect } from "vitest";
import { findNoisyAgents, buildAlertText, shouldRunGuard } from "../src/trafficGuard.js";

describe("shouldRunGuard", () => {
  it("fires only on every 10th minute", () => {
    expect(shouldRunGuard(Date.UTC(2026, 9, 20, 11, 20))).toBe(true);
    expect(shouldRunGuard(Date.UTC(2026, 9, 20, 11, 21))).toBe(false);
  });
});

describe("findNoisyAgents", () => {
  const groups = [
    { count: 4000, dimensions: { userAgent: "Mozilla/5.0 (compatible; ExaSearchBot/1.0)" } },
    { count: 1500, dimensions: { userAgent: "" } },
    { count: 10, dimensions: { userAgent: "Chrome" } },
  ];
  it("keeps agents at or above the threshold, busiest first, naming empty UAs", () => {
    const r = findNoisyAgents(groups, 1500);
    expect(r.map((a) => a.count)).toEqual([4000, 1500]);
    expect(r[1].ua).toBe("(empty user agent)");
  });
  it("returns nothing for quiet traffic or missing data", () => {
    expect(findNoisyAgents(groups, 5000)).toEqual([]);
    expect(findNoisyAgents(undefined, 1)).toEqual([]);
  });
});

describe("buildAlertText", () => {
  it("suggests a WAF expression using the bot's token", () => {
    const t = buildAlertText([{ ua: "Mozilla/5.0 (compatible; ExaSearchBot/1.0; +https://crawler.exa.ai/)", count: 4000 }], { threshold: 1500 });
    expect(t).toContain('(http.user_agent contains "ExaSearchBot")');
    expect(t).toContain("4000 requests");
  });
});
