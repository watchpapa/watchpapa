/**
 * Live smoke test — run against the REAL Supabase project + deployed Worker,
 * before and after the Pro → Free downgrade, to prove nothing user-visible
 * changed. Creates one throwaway confirmed user and deletes it at the end.
 *
 * Covers what the downgrade could plausibly affect:
 *   Auth (password sign-in) · Postgres through RLS · Storage (upload, public
 *   read, remove) · Worker JWT verification (JWKS) + Hyperdrive → DB.
 * Sign-up / OAuth / email can't be automated safely — see the manual checklist
 * in the plan (Phase D).
 *
 * Env (repo-root .env, same as tests/rls_tests): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * plus the publishable key from Frontend/.env (VITE_SUPABASE_PUBLISHABLE_KEY) or
 * SUPABASE_PUBLISHABLE_KEY. Worker URL: WORKER_URL (default https://api.watchpapa.tv).
 *
 *   npm run test:smoke
 */

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: resolve(ROOT, ".env") });
const frontendEnv = (() => {
  try { return dotenv.parse(readFileSync(resolve(ROOT, "Frontend/.env"))); } catch { return {}; }
})();

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const PUBLISHABLE = process.env.SUPABASE_PUBLISHABLE_KEY ?? frontendEnv.VITE_SUPABASE_PUBLISHABLE_KEY ?? frontendEnv.VITE_SUPABASE_ANON_KEY;
const WORKER_URL = (process.env.WORKER_URL ?? "https://api.watchpapa.tv").replace(/\/$/, "");

const SKIP = !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !PUBLISHABLE
  ? "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (root .env) and VITE_SUPABASE_PUBLISHABLE_KEY (Frontend/.env) are required"
  : false;

const noPersist = { auth: { autoRefreshToken: false, persistSession: false } };

describe("post-downgrade smoke (live)", { skip: SKIP }, () => {
  let admin;
  let userClient;
  let userId;
  let accessToken;
  const email = `smoke-${Date.now()}-${randomBytes(3).toString("hex")}@example.com`;
  const password = `Sm0ke-${randomBytes(12).toString("base64url")}!aA`;
  const avatarPath = () => `${userId}/smoke-${Date.now()}.png`;

  before(async () => {
    admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, noPersist);
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    assert.ifError(error);
    userId = data.user.id;
  });

  after(async () => {
    if (!userId) return;
    // best-effort cleanup of any leftover avatar objects, then the user (cascades)
    try {
      const { data } = await admin.storage.from("avatars").list(userId);
      if (data?.length) await admin.storage.from("avatars").remove(data.map((f) => `${userId}/${f.name}`));
    } catch { /* ignore */ }
    await admin.auth.admin.deleteUser(userId);
  });

  test("Auth: password sign-in works and returns a session", async () => {
    userClient = createClient(SUPABASE_URL, PUBLISHABLE, noPersist);
    const { data, error } = await userClient.auth.signInWithPassword({ email, password });
    assert.ifError(error);
    assert.ok(data.session?.access_token);
    accessToken = data.session.access_token;
    assert.equal(data.user.id, userId);
  });

  test("Auth: a wrong password is rejected", async () => {
    const c = createClient(SUPABASE_URL, PUBLISHABLE, noPersist);
    const { error } = await c.auth.signInWithPassword({ email, password: `${password}x` });
    assert.ok(error);
  });

  test("Postgres + RLS: the signup trigger created my profile and I can read it", async () => {
    const { data, error } = await userClient.from("profile").select("id, role").eq("id", userId);
    assert.ifError(error);
    assert.equal(data.length, 1);
    assert.equal(data[0].role, 0);
  });

  test("Postgres + RLS: I can write and read my own rows via supabase-js, and anon cannot see them", async () => {
    const { error: insErr } = await userClient.from("user_followed_movies").insert({ profile_id: userId, tmdb_id: 603 });
    assert.ifError(insErr);
    const { data } = await userClient.from("user_followed_movies").select("tmdb_id").eq("profile_id", userId);
    assert.deepEqual(data.map((r) => r.tmdb_id), [603]);

    const anon = createClient(SUPABASE_URL, PUBLISHABLE, noPersist);
    const { data: anonRows } = await anon.from("user_followed_movies").select("tmdb_id").eq("profile_id", userId);
    assert.deepEqual(anonRows ?? [], []);
  });

  test("Postgres RPC: get_effective_tier works for the signed-in user", async () => {
    const { data, error } = await userClient.rpc("get_effective_tier", { p_profile_id: userId });
    assert.ifError(error);
    assert.ok(typeof data === "string" && data.length > 0);
  });

  test("Storage: an uploaded avatar is publicly readable, and can be removed", async () => {
    const path = avatarPath();
    // 1x1 PNG. Uploaded with the service role: the user-side upload policy is Pro-tier-gated.
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==", "base64");
    const up = await admin.storage.from("avatars").upload(path, png, { contentType: "image/png" });
    assert.ifError(up.error);

    const { data: pub } = userClient.storage.from("avatars").getPublicUrl(path);
    const res = await fetch(pub.publicUrl);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "image/png");

    // NOTE (pre-existing, unrelated to the plan): storage.objects has no SELECT policy, so a
    // *user-side* remove() (DELETE … RETURNING) matches nothing and silently deletes nothing —
    // replaced avatars are orphaned. Not asserted here; removal is checked via the service role.
    const { error: rmErr } = await admin.storage.from("avatars").remove([path]);
    assert.ifError(rmErr);
    const { data: left } = await admin.storage.from("avatars").list(userId);
    assert.ok(!left?.some((f) => path.endsWith(f.name)), "object should be gone");
  });

  test("Worker: /health is up", async () => {
    const res = await fetch(`${WORKER_URL}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: "ok" });
  });

  test("Worker: unauthenticated call to a protected route is 401", async () => {
    const res = await fetch(`${WORKER_URL}/api/import/export`);
    assert.equal(res.status, 401);
  });

  test("Worker: my Supabase JWT is accepted (JWKS) and the Worker reads my data through Hyperdrive", async () => {
    const res = await fetch(`${WORKER_URL}/api/import/export`, { headers: { Authorization: `Bearer ${accessToken}` } });
    assert.equal(res.status, 200, await res.clone().text());
    const body = await res.json();
    assert.ok(Array.isArray(body.ratings));
    assert.ok(Array.isArray(body.watchlistItems));
  });

  test("Worker: live TMDB content still flows (edge-cached public route)", async () => {
    const res = await fetch(`${WORKER_URL}/api/content/movie/603`);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).id, 603);
  });
});
