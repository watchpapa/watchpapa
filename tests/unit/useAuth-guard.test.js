/**
 * Every code path that sets a password goes through the breached-password check.
 *
 * `useAuth.js` is a thin wrapper around two plain functions in
 * Frontend/src/features/auth/lib/passwordAuth.js (kept free of React and of the
 * Vite-only supabase client so they can be unit-tested). This file tests:
 *   1. those wrappers (pwned → Supabase never called; clean → called once, with
 *      the exact same payload as before; HIBP down → still called),
 *   2. a repo-wide guard so nobody adds a new unguarded password write later.
 *
 *   npm run test:unit
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PWNED_MESSAGE, sha1Hex } from "../../Frontend/src/lib/pwned.js";
import {
  signUpWithPwnedCheck,
  updatePasswordWithPwnedCheck,
} from "../../Frontend/src/features/auth/lib/passwordAuth.js";

const FRONTEND_SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../../Frontend/src");

const BREACHED = "Password123!";
const CLEAN = "correct-Horse-battery-staple-9!";

// A fake fetch for HIBP that flags exactly BREACHED and nothing else.
async function hibpFetchFlagging(...breached) {
  const hashes = await Promise.all(breached.map(sha1Hex));
  return async (url) => {
    const prefix = String(url).split("/").pop();
    const rows = hashes.filter((h) => h.startsWith(prefix)).map((h) => `${h.slice(5)}:4242`);
    rows.push("0018A45C4D1DEF81644B54AB7F969B88D65:0"); // padding row
    return new Response(rows.join("\r\n"), { status: 200 });
  };
}

// A fake supabase client that records auth calls.
function fakeSupabase() {
  const calls = { signUp: [], updateUser: [] };
  return {
    calls,
    auth: {
      signUp: async (payload) => { calls.signUp.push(payload); return { data: { user: { id: "u1" }, session: null }, error: null }; },
      updateUser: async (payload) => { calls.updateUser.push(payload); return { data: { user: { id: "u1" } }, error: null }; },
    },
  };
}

describe("signUpWithPwnedCheck", () => {
  test("breached password → error result, Supabase.signUp is NEVER called", async () => {
    const supabase = fakeSupabase();
    const fetch = await hibpFetchFlagging(BREACHED);
    const result = await signUpWithPwnedCheck(
      supabase,
      { email: "a@b.co", password: BREACHED, metadata: { username: "x" }, emailRedirectTo: "https://x/verify-email" },
      { fetch },
    );
    assert.equal(result.data, null);
    assert.equal(result.error.message, PWNED_MESSAGE);
    assert.equal(supabase.calls.signUp.length, 0);
  });

  test("clean password → Supabase.signUp called once with the unchanged payload shape", async () => {
    const supabase = fakeSupabase();
    const fetch = await hibpFetchFlagging(BREACHED);
    const result = await signUpWithPwnedCheck(
      supabase,
      { email: "a@b.co", password: CLEAN, metadata: { username: "x", date_of_birth: "2000-01-01" }, emailRedirectTo: "https://x/verify-email" },
      { fetch },
    );
    assert.equal(result.error, null);
    assert.deepEqual(supabase.calls.signUp, [
      {
        email: "a@b.co",
        password: CLEAN,
        options: { data: { username: "x", date_of_birth: "2000-01-01" }, emailRedirectTo: "https://x/verify-email" },
      },
    ]);
  });

  test("HIBP unreachable → fail-open, signUp still called", async () => {
    const supabase = fakeSupabase();
    const fetch = async () => { throw new TypeError("Failed to fetch"); };
    const result = await signUpWithPwnedCheck(supabase, { email: "a@b.co", password: BREACHED, metadata: {}, emailRedirectTo: "x" }, { fetch });
    assert.equal(result.error, null);
    assert.equal(supabase.calls.signUp.length, 1);
  });

  test("passes Supabase's own error through untouched", async () => {
    const supabase = fakeSupabase();
    supabase.auth.signUp = async () => ({ data: null, error: { message: "User already registered" } });
    const fetch = await hibpFetchFlagging(BREACHED);
    const result = await signUpWithPwnedCheck(supabase, { email: "a@b.co", password: CLEAN, metadata: {}, emailRedirectTo: "x" }, { fetch });
    assert.equal(result.error.message, "User already registered");
  });
});

describe("updatePasswordWithPwnedCheck", () => {
  test("breached password → error result, Supabase.updateUser is NEVER called", async () => {
    const supabase = fakeSupabase();
    const fetch = await hibpFetchFlagging(BREACHED);
    const result = await updatePasswordWithPwnedCheck(supabase, { password: BREACHED }, { fetch });
    assert.equal(result.data, null);
    assert.equal(result.error.message, PWNED_MESSAGE);
    assert.equal(supabase.calls.updateUser.length, 0);
  });

  test("clean password → updateUser({ password }) called once", async () => {
    const supabase = fakeSupabase();
    const fetch = await hibpFetchFlagging(BREACHED);
    const result = await updatePasswordWithPwnedCheck(supabase, { password: CLEAN }, { fetch });
    assert.equal(result.error, null);
    assert.deepEqual(supabase.calls.updateUser, [{ password: CLEAN }]);
  });

  test("HIBP returns 500 → fail-open, updateUser still called", async () => {
    const supabase = fakeSupabase();
    const fetch = async () => new Response("boom", { status: 500 });
    await updatePasswordWithPwnedCheck(supabase, { password: BREACHED }, { fetch });
    assert.equal(supabase.calls.updateUser.length, 1);
  });
});

// ── repo-wide guard ──────────────────────────────────────────────────────────
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(jsx?|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

describe("no unguarded password writes anywhere in the frontend", () => {
  const files = walk(FRONTEND_SRC);
  const allowed = new Set(["features/auth/lib/passwordAuth.js"]);

  test("auth.signUp( is only called from passwordAuth.js", () => {
    const offenders = files
      .map((f) => ({ rel: relative(FRONTEND_SRC, f), src: readFileSync(f, "utf8") }))
      .filter(({ rel, src }) => !allowed.has(rel) && /\bauth\s*\.\s*signUp\s*\(/.test(src))
      .map(({ rel }) => rel);
    assert.deepEqual(offenders, [], "call signUpWithPwnedCheck instead");
  });

  test("auth.updateUser({ …password… }) is only called from passwordAuth.js", () => {
    const offenders = files
      .map((f) => ({ rel: relative(FRONTEND_SRC, f), src: readFileSync(f, "utf8") }))
      .filter(({ rel, src }) => !allowed.has(rel) && /\bauth\s*\.\s*updateUser\s*\(\s*\{[^}]*\bpassword\b/.test(src))
      .map(({ rel }) => rel);
    assert.deepEqual(offenders, [], "call updatePasswordWithPwnedCheck instead");
  });

  test("useAuth.js wires signUp/updatePassword through the guarded helpers", () => {
    const src = readFileSync(join(FRONTEND_SRC, "features/auth/hooks/useAuth.js"), "utf8");
    assert.match(src, /from\s+["']\.\.\/lib\/passwordAuth\.js["']/);
    assert.match(src, /signUpWithPwnedCheck\s*\(/);
    assert.match(src, /updatePasswordWithPwnedCheck\s*\(/);
  });

  test("RegisterForm checks the password at step 1, before the user fills in step 2", () => {
    const src = readFileSync(join(FRONTEND_SRC, "features/auth/components/RegisterForm.jsx"), "utf8");
    assert.match(src, /pwnedPasswordError\s*\(/);
  });
});
