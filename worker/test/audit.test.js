import { describe, it, expect } from "vitest";
import { buildAuditEntry, pickBodyFields } from "../src/audit.js";
import { ACTION_GROUPS, ACTION_SET, AUDIT_ACTIONS } from "../src/auditActions.js";

describe("pickBodyFields", () => {
  it("records nothing unless fields are allowlisted", () => {
    expect(pickBodyFields({ code: "X", password: "hunter2" })).toEqual({});
    expect(pickBodyFields({ code: "X", password: "hunter2" }, ["code"])).toEqual({ code: "X" });
  });
  it("ignores allowlisted keys that are absent", () => {
    expect(pickBodyFields({ a: 1 }, ["a", "b"])).toEqual({ a: 1 });
    expect(pickBodyFields(null, ["a"])).toEqual({});
  });
});

describe("buildAuditEntry", () => {
  const base = { action: "admin_role_set", method: "PATCH", url: "https://api.watchpapa.tv/api/admin/users/abc/role?x=1", ip: "1.2.3.4", status: 200 };

  it("captures actor, status, path (without query) and merges handler context into the body", () => {
    const e = buildAuditEntry({ ...base, user: { id: "u1", email: "a@b.c" }, picked: { role: 4 }, ctx: { targetUserId: "u2", extra: { previousRole: 0 } } });
    expect(e).toMatchObject({ action: "admin_role_set", userId: "u1", email: "a@b.c", ip: "1.2.3.4", method: "PATCH", path: "/api/admin/users/abc/role", status: 200, targetUserId: "u2" });
    expect(JSON.parse(e.body)).toEqual({ role: 4, previousRole: 0 });
  });

  it("tolerates anonymous requests and missing context", () => {
    const e = buildAuditEntry({ ...base, user: null, ctx: undefined, picked: undefined, status: 401 });
    expect(e.userId).toBeNull();
    expect(e.targetUserId).toBeNull();
    expect(e.status).toBe(401);
    expect(JSON.parse(e.body)).toEqual({});
  });
});

describe("auditActions registry", () => {
  it("has unique action names, each in a known group", () => {
    const groups = new Set(ACTION_GROUPS.map((g) => g.key));
    expect(ACTION_SET.size).toBe(AUDIT_ACTIONS.length);
    for (const a of AUDIT_ACTIONS) expect(groups.has(a.group)).toBe(true);
  });
  it("still knows the actions written by the 002/030 follow triggers and the original worker routes", () => {
    for (const a of ["follow_movie", "unfollow_movie", "follow_show", "unfollow_show", "referral", "rewards"]) expect(ACTION_SET.has(a)).toBe(true);
  });
  it("dropped the dead Express-era actions", () => {
    expect(ACTION_SET.has("inject")).toBe(false);
    expect(ACTION_SET.has("resolve")).toBe(false);
  });
});
