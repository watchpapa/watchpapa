import { describe, it, expect } from "vitest";
import { validateIssueBody } from "../src/routes/admin/tierRewards.js";
import { ACTION_SET } from "../src/auditActions.js";

describe("validateIssueBody", () => {
  const ok = { tier: "pro", durationDays: 30, message: "thanks!", target: "all" };

  it("accepts a well-formed 'all' request", () => {
    expect(validateIssueBody(ok)).toEqual({
      tier: "pro", days: 30, message: "thanks!", target: "all", userIds: null,
    });
  });

  it("rejects an unknown / missing tier", () => {
    expect(validateIssueBody({ ...ok, tier: "god" }).error).toMatch(/tier/);
    expect(validateIssueBody({ ...ok, tier: undefined }).error).toMatch(/tier/);
  });

  it("treats blank / null / absent durationDays as lifetime", () => {
    expect(validateIssueBody({ ...ok, durationDays: "" }).days).toBeNull();
    expect(validateIssueBody({ ...ok, durationDays: null }).days).toBeNull();
    const { durationDays, ...noDays } = ok;
    expect(validateIssueBody(noDays).days).toBeNull();
  });

  it("rejects a non-positive or non-integer durationDays", () => {
    expect(validateIssueBody({ ...ok, durationDays: 0 }).error).toMatch(/durationDays/);
    expect(validateIssueBody({ ...ok, durationDays: -5 }).error).toMatch(/durationDays/);
    expect(validateIssueBody({ ...ok, durationDays: "abc" }).error).toMatch(/durationDays/);
  });

  it("trims the message and rejects one over 280 chars", () => {
    expect(validateIssueBody({ ...ok, message: "  hi  " }).message).toBe("hi");
    expect(validateIssueBody({ ...ok, message: "   " }).message).toBeNull();
    expect(validateIssueBody({ ...ok, message: "x".repeat(281) }).error).toMatch(/280/);
    expect(validateIssueBody({ ...ok, message: "x".repeat(280) }).message).toHaveLength(280);
  });

  it("rejects a bad target", () => {
    expect(validateIssueBody({ ...ok, target: "everyone" }).error).toMatch(/target/);
    expect(validateIssueBody({ ...ok, target: undefined }).error).toMatch(/target/);
  });

  describe("target = 'selected'", () => {
    const u1 = "11111111-1111-1111-1111-111111111111";
    const u2 = "22222222-2222-2222-2222-222222222222";

    it("requires a non-empty userIds array", () => {
      expect(validateIssueBody({ ...ok, target: "selected" }).error).toMatch(/userIds/);
      expect(validateIssueBody({ ...ok, target: "selected", userIds: [] }).error).toMatch(/userIds/);
    });

    it("dedupes and lowercases the ids", () => {
      const r = validateIssueBody({ ...ok, target: "selected", userIds: [u1, u1.toUpperCase(), u2] });
      expect(r.userIds).toEqual([u1, u2]);
    });

    it("rejects non-UUID ids", () => {
      expect(validateIssueBody({ ...ok, target: "selected", userIds: [u1, "nope"] }).error).toMatch(/UUID/);
    });

    it("rejects more than 5000 ids", () => {
      const many = Array.from({ length: 5001 }, () => crypto.randomUUID());
      expect(validateIssueBody({ ...ok, target: "selected", userIds: many }).error).toMatch(/5000/);
    });
  });
});

describe("auditActions registry", () => {
  it("registers admin_tier_reward", () => {
    expect(ACTION_SET.has("admin_tier_reward")).toBe(true);
  });
});
