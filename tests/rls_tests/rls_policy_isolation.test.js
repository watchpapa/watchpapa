/**
 * Integration tests for T8 (threat model: docs/threat_model_guide.md).
 *
 * Verifies that Supabase Row Level Security policies prevent cross-user data
 * access on every user-scoped table. A policy drift — a policy going missing
 * or being misconfigured — causes at least one test here to fail.
 *
 * Tests connect to the live Supabase Postgres instance directly via DATABASE_URL
 * and simulate different auth roles by switching to the `authenticated` or `anon`
 * PostgreSQL role and setting SET LOCAL "request.jwt.claims" inside transactions
 * that are always rolled back, so no test data persists.
 *
 * User A is a real Supabase auth user created for the test run (deleted in
 * after()). User B is represented by a random UUID injected into the JWT claims
 * — no real user record is needed because RLS only evaluates auth.uid() against
 * profile_id, and a non-matching UUID is a valid cross-user attacker scenario.
 *
 * Required env vars (repo-root .env):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL
 */

import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import dotenv from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL } = process.env;

const CREDS_MISSING =
  !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !DATABASE_URL
    ? "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and DATABASE_URL must all be set in the repo-root .env"
    : false;

// ---------------------------------------------------------------------------
// Helpers — simulate Supabase auth contexts via SET LOCAL in a rolled-back tx
// ---------------------------------------------------------------------------

/**
 * Run fn(client) as an authenticated Supabase user identified by userId.
 * The transaction is always rolled back so writes have no side effects.
 */
async function asUser(pool, userId, fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL role = authenticated");
    // SET LOCAL does not accept bind parameters — use escapeLiteral so the
    // JSON value is safely quoted even though UUIDs contain no SQL-special chars.
    const claims = client.escapeLiteral(
      JSON.stringify({ sub: userId, role: "authenticated", aud: "authenticated" })
    );
    await client.query(`SET LOCAL "request.jwt.claims" = ${claims}`);
    return await fn(client);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
}

/**
 * Run fn(client) as the anon role (unauthenticated visitor).
 * Transaction is always rolled back.
 */
async function asAnon(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL role = anon");
    return await fn(client);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Shared state — populated in before(), released in after()
// ---------------------------------------------------------------------------

let adminSupabase;
let pool;
// userA is a real auth user created in before() and deleted in after().
let userAId = null;
// userBId is a random UUID used only in JWT claims to represent a different
// authenticated user. No row in auth.users or profile is needed.
const userBId = randomUUID();
let testMovieId = null;
let testShowId = null;

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("T8 — RLS policy isolation", { skip: CREDS_MISSING }, async () => {
  before(async () => {
    adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    pool = new pg.Pool({ connectionString: DATABASE_URL });

    const ts = Date.now();

    const { data: dataA, error: errA } = await adminSupabase.auth.admin.createUser({
      email: `rls-test-${ts}@example.com`,
      password: `RlsTest_${ts}!`,
      email_confirm: true,
    });
    if (errA) throw new Error(`Failed to create test user A: ${errA.message}`);
    userAId = dataA.user.id;

    // Superuser connection bypasses RLS — use it for setup writes.
    const client = await pool.connect();
    try {
      // Only insert a profile row if the auth trigger didn't already create one.
      const existing = await client.query(
        "SELECT id FROM public.profile WHERE id = $1",
        [userAId]
      );
      if (existing.rows.length === 0) {
        await client.query(
          `INSERT INTO public.profile (id, username, date_of_birth, is_adult, role)
           VALUES ($1, $2, '2000-01-01', false, 0)`,
          [userAId, `rlsTest${ts}`]
        );
      }

      const movieRow = await client.query(
        "SELECT id FROM public.movie WHERE deleted_at IS NULL LIMIT 1"
      );
      const showRow = await client.query(
        "SELECT id FROM public.show WHERE deleted_at IS NULL LIMIT 1"
      );
      testMovieId = movieRow.rows[0]?.id ?? null;
      testShowId = showRow.rows[0]?.id ?? null;

      if (testMovieId) {
        await client.query(
          "INSERT INTO public.user_followed_movies (profile_id, movie_id) VALUES ($1, $2)",
          [userAId, testMovieId]
        );
      }
      if (testShowId) {
        await client.query(
          "INSERT INTO public.user_followed_shows (profile_id, show_id) VALUES ($1, $2)",
          [userAId, testShowId]
        );
      }
    } finally {
      client.release();
    }
  });

  after(async () => {
    const client = await pool.connect();
    try {
      if (userAId) {
        await client.query(
          "DELETE FROM public.user_followed_movies WHERE profile_id = $1",
          [userAId]
        );
        await client.query(
          "DELETE FROM public.user_followed_shows WHERE profile_id = $1",
          [userAId]
        );
        await client.query("DELETE FROM public.profile WHERE id = $1", [userAId]);
      }
    } finally {
      client.release();
    }
    if (userAId) await adminSupabase.auth.admin.deleteUser(userAId);
    await pool.end();
  });

  // -------------------------------------------------------------------------
  // 1. RLS enabled — structural check against pg_class
  // -------------------------------------------------------------------------

  describe("RLS is enabled on user-scoped tables", async () => {
    for (const tableName of [
      "user_followed_movies",
      "user_followed_shows",
      "profile",
      "audit_events",
    ]) {
      test(`${tableName} has relrowsecurity = true`, async () => {
        const client = await pool.connect();
        try {
          const res = await client.query(
            `SELECT relrowsecurity
               FROM pg_class
              WHERE relname = $1
                AND relnamespace = 'public'::regnamespace`,
            [tableName]
          );
          assert.ok(res.rows.length > 0, `Table ${tableName} not found in pg_class`);
          assert.equal(
            res.rows[0].relrowsecurity,
            true,
            `RLS is not enabled on ${tableName} — policy drift detected`
          );
        } finally {
          client.release();
        }
      });
    }
  });

  // -------------------------------------------------------------------------
  // 2. user_followed_movies cross-user isolation
  // -------------------------------------------------------------------------

  describe("user_followed_movies cross-user isolation", async () => {
    test("User A can SELECT their own follow rows", async (t) => {
      if (!testMovieId) { t.skip("no movie rows in DB"); return; }
      const rows = await asUser(pool, userAId, (c) =>
        c
          .query("SELECT id FROM public.user_followed_movies WHERE profile_id = $1", [userAId])
          .then((r) => r.rows)
      );
      assert.ok(rows.length > 0, "User A should see their own follow rows");
    });

    test("User B cannot SELECT User A follow rows", async (t) => {
      if (!testMovieId) { t.skip("no movie rows in DB"); return; }
      const rows = await asUser(pool, userBId, (c) =>
        c
          .query("SELECT id FROM public.user_followed_movies WHERE profile_id = $1", [userAId])
          .then((r) => r.rows)
      );
      assert.equal(rows.length, 0, "RLS should block cross-user SELECT on user_followed_movies");
    });

    test("User B cannot INSERT a follow row with User A profile_id", async (t) => {
      if (!testMovieId) { t.skip("no movie rows in DB"); return; }
      await assert.rejects(
        asUser(pool, userBId, (c) =>
          c.query(
            "INSERT INTO public.user_followed_movies (profile_id, movie_id) VALUES ($1, $2)",
            [userAId, testMovieId]
          )
        ),
        /row-level security|permission denied/i,
        "RLS should block cross-user INSERT on user_followed_movies"
      );
    });

    test("User B cannot UPDATE User A follow rows", async (t) => {
      if (!testMovieId) { t.skip("no movie rows in DB"); return; }
      const result = await asUser(pool, userBId, (c) =>
        c.query(
          "UPDATE public.user_followed_movies SET created_at = now() WHERE profile_id = $1",
          [userAId]
        )
      );
      assert.equal(
        result.rowCount,
        0,
        "RLS should block cross-user UPDATE on user_followed_movies"
      );
    });

    test("User B cannot DELETE User A follow rows", async (t) => {
      if (!testMovieId) { t.skip("no movie rows in DB"); return; }
      const result = await asUser(pool, userBId, (c) =>
        c.query(
          "DELETE FROM public.user_followed_movies WHERE profile_id = $1",
          [userAId]
        )
      );
      assert.equal(
        result.rowCount,
        0,
        "RLS should block cross-user DELETE on user_followed_movies"
      );
    });

    test("Anon cannot SELECT any follow rows", async () => {
      const rows = await asAnon(pool, (c) =>
        c.query("SELECT id FROM public.user_followed_movies LIMIT 1").then((r) => r.rows)
      );
      assert.equal(rows.length, 0, "RLS should block anon SELECT on user_followed_movies");
    });

    test("Anon cannot INSERT follow rows", async (t) => {
      if (!testMovieId) { t.skip("no movie rows in DB"); return; }
      await assert.rejects(
        asAnon(pool, (c) =>
          c.query(
            "INSERT INTO public.user_followed_movies (profile_id, movie_id) VALUES ($1, $2)",
            [userAId, testMovieId]
          )
        ),
        /row-level security|permission denied/i,
        "RLS should block anon INSERT on user_followed_movies"
      );
    });
  });

  // -------------------------------------------------------------------------
  // 3. user_followed_shows cross-user isolation
  // -------------------------------------------------------------------------

  describe("user_followed_shows cross-user isolation", async () => {
    test("User A can SELECT their own show follow rows", async (t) => {
      if (!testShowId) { t.skip("no show rows in DB"); return; }
      const rows = await asUser(pool, userAId, (c) =>
        c
          .query("SELECT id FROM public.user_followed_shows WHERE profile_id = $1", [userAId])
          .then((r) => r.rows)
      );
      assert.ok(rows.length > 0, "User A should see their own show follow rows");
    });

    test("User B cannot SELECT User A show follow rows", async (t) => {
      if (!testShowId) { t.skip("no show rows in DB"); return; }
      const rows = await asUser(pool, userBId, (c) =>
        c
          .query("SELECT id FROM public.user_followed_shows WHERE profile_id = $1", [userAId])
          .then((r) => r.rows)
      );
      assert.equal(rows.length, 0, "RLS should block cross-user SELECT on user_followed_shows");
    });

    test("User B cannot INSERT a show follow row with User A profile_id", async (t) => {
      if (!testShowId) { t.skip("no show rows in DB"); return; }
      await assert.rejects(
        asUser(pool, userBId, (c) =>
          c.query(
            "INSERT INTO public.user_followed_shows (profile_id, show_id) VALUES ($1, $2)",
            [userAId, testShowId]
          )
        ),
        /row-level security|permission denied/i,
        "RLS should block cross-user INSERT on user_followed_shows"
      );
    });

    test("User B cannot DELETE User A show follow rows", async (t) => {
      if (!testShowId) { t.skip("no show rows in DB"); return; }
      const result = await asUser(pool, userBId, (c) =>
        c.query(
          "DELETE FROM public.user_followed_shows WHERE profile_id = $1",
          [userAId]
        )
      );
      assert.equal(
        result.rowCount,
        0,
        "RLS should block cross-user DELETE on user_followed_shows"
      );
    });

    test("Anon cannot SELECT any show follow rows", async () => {
      const rows = await asAnon(pool, (c) =>
        c.query("SELECT id FROM public.user_followed_shows LIMIT 1").then((r) => r.rows)
      );
      assert.equal(rows.length, 0, "RLS should block anon SELECT on user_followed_shows");
    });
  });

  // -------------------------------------------------------------------------
  // 4. profile isolation
  // -------------------------------------------------------------------------

  describe("profile cross-user isolation", async () => {
    test("User A can SELECT their own profile", async () => {
      const rows = await asUser(pool, userAId, (c) =>
        c
          .query("SELECT id FROM public.profile WHERE id = $1", [userAId])
          .then((r) => r.rows)
      );
      assert.equal(rows.length, 1, "User A should be able to SELECT their own profile");
    });

    test("User B cannot SELECT User A profile", async () => {
      const rows = await asUser(pool, userBId, (c) =>
        c
          .query("SELECT id FROM public.profile WHERE id = $1", [userAId])
          .then((r) => r.rows)
      );
      assert.equal(rows.length, 0, "RLS should block cross-user SELECT on profile");
    });

    test("User B cannot UPDATE User A profile", async () => {
      const result = await asUser(pool, userBId, (c) =>
        c.query("UPDATE public.profile SET username = 'hacked' WHERE id = $1", [userAId])
      );
      assert.equal(result.rowCount, 0, "RLS should block cross-user UPDATE on profile");
    });

    test("Anon cannot SELECT any profile rows", async () => {
      const rows = await asAnon(pool, (c) =>
        c.query("SELECT id FROM public.profile LIMIT 1").then((r) => r.rows)
      );
      assert.equal(rows.length, 0, "RLS should block anon SELECT on profile");
    });

    test("Anon cannot INSERT a profile row", async () => {
      await assert.rejects(
        asAnon(pool, (c) =>
          c.query(
            `INSERT INTO public.profile (id, username, date_of_birth, is_adult, role)
             VALUES (gen_random_uuid(), 'anonhack', '2000-01-01', false, 0)`
          )
        ),
        /row-level security|permission denied/i,
        "RLS should block anon INSERT on profile"
      );
    });
  });

  // -------------------------------------------------------------------------
  // 5. audit_events — no access for client roles
  // -------------------------------------------------------------------------

  describe("audit_events access control", async () => {
    test("Authenticated user cannot SELECT from audit_events", async () => {
      const rows = await asUser(pool, userAId, (c) =>
        c.query("SELECT id FROM public.audit_events LIMIT 1").then((r) => r.rows)
      );
      assert.equal(rows.length, 0, "authenticated role must not read audit_events");
    });

    test("Anon cannot SELECT from audit_events", async () => {
      const rows = await asAnon(pool, (c) =>
        c.query("SELECT id FROM public.audit_events LIMIT 1").then((r) => r.rows)
      );
      assert.equal(rows.length, 0, "anon role must not read audit_events");
    });

    test("Authenticated user cannot INSERT into audit_events", async () => {
      await assert.rejects(
        asUser(pool, userAId, (c) =>
          c.query(
            `INSERT INTO public.audit_events (action, method, path)
             VALUES ('rls_test', 'POST', '/rls-test')`
          )
        ),
        /row-level security|permission denied/i,
        "authenticated role must not INSERT into audit_events"
      );
    });
  });

  // -------------------------------------------------------------------------
  // 6. script_logs — only admins (role = 4) can read; anon is blocked entirely
  // -------------------------------------------------------------------------

  describe("script_logs access control", async () => {
    test("Regular authenticated user (role = 0) cannot SELECT from script_logs", async () => {
      // userAId has profile.role = 0. The policy only allows SELECT for
      // authenticated users whose profile.role = 4 (admin).
      const rows = await asUser(pool, userAId, (c) =>
        c.query("SELECT id FROM public.script_logs LIMIT 1").then((r) => r.rows)
      );
      assert.equal(rows.length, 0, "non-admin authenticated user must not read script_logs");
    });

    test("Anon cannot SELECT from script_logs", async () => {
      const rows = await asAnon(pool, (c) =>
        c.query("SELECT id FROM public.script_logs LIMIT 1").then((r) => r.rows)
      );
      assert.equal(rows.length, 0, "anon role must not read script_logs");
    });
  });

  // -------------------------------------------------------------------------
  // 7. Public media tables — readable but not writable by client roles
  // -------------------------------------------------------------------------

  describe("Public media tables are read-only for client roles", async () => {
    test("Anon can SELECT from movie table", async () => {
      await assert.doesNotReject(
        asAnon(pool, (c) => c.query("SELECT id FROM public.movie LIMIT 1")),
        "anon should be able to SELECT from movie"
      );
    });

    test("Anon cannot INSERT into movie table", async () => {
      await assert.rejects(
        asAnon(pool, (c) =>
          c.query(
            `INSERT INTO public.movie
               (tmdb_id, adult, budget, original_language, original_title, overview,
                tmdb_popularity, status, tagline, title, tmdb_vote_avg, tmdb_vote_count)
             VALUES (9999999901, false, 0, 'en', 'rls_test', 'rls_test', 0,
                     'Released', '', 'rls_test', 0, 0)`
          )
        ),
        /row-level security|permission denied/i,
        "anon must not INSERT into movie"
      );
    });

    test("Authenticated user cannot INSERT into movie table", async () => {
      await assert.rejects(
        asUser(pool, userAId, (c) =>
          c.query(
            `INSERT INTO public.movie
               (tmdb_id, adult, budget, original_language, original_title, overview,
                tmdb_popularity, status, tagline, title, tmdb_vote_avg, tmdb_vote_count)
             VALUES (9999999902, false, 0, 'en', 'rls_test', 'rls_test', 0,
                     'Released', '', 'rls_test', 0, 0)`
          )
        ),
        /row-level security|permission denied/i,
        "authenticated user must not INSERT into movie"
      );
    });

    test("Authenticated user cannot UPDATE movie rows", async () => {
      const result = await asUser(pool, userAId, (c) =>
        c.query("UPDATE public.movie SET title = 'hacked' WHERE tmdb_id = -1")
      );
      assert.equal(result.rowCount, 0, "authenticated user must not UPDATE movie rows");
    });
  });
});
