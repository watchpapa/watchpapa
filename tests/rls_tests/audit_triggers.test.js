/**
 * Audit-trigger coverage (migration 044).
 *
 * Runs against the live database with the same rolled-back-transaction
 * technique as rls_policy_isolation.test.js: every write happens inside a
 * transaction as the `authenticated` role with a fake JWT, then ROLLBACK, so
 * nothing persists. Inside the transaction we read audit_events back as the
 * privileged connection owner (SET LOCAL role is reset by RESET ROLE).
 *
 * Required env vars (repo-root .env): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL
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
const CREDS_MISSING = !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !DATABASE_URL
  ? "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and DATABASE_URL must all be set in the repo-root .env"
  : false;

let adminSupabase;
let pool;
let userId = null;

// Run `asUser` writes, then `check` as the connection owner, all in one
// rolled-back transaction.
async function inTx(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const asUser = async () => {
      await client.query("SET LOCAL role = authenticated");
      const claims = client.escapeLiteral(JSON.stringify({ sub: userId, role: "authenticated", aud: "authenticated" }));
      await client.query(`SET LOCAL "request.jwt.claims" = ${claims}`);
    };
    const asOwner = async () => { await client.query("RESET ROLE"); };
    return await fn({ client, asUser, asOwner });
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
}

async function auditRows(client, action) {
  await client.query("RESET ROLE");
  const { rows } = await client.query(
    "SELECT action, user_id, target_user_id, source, path, body FROM public.audit_events WHERE user_id = $1 AND action = $2 ORDER BY id DESC",
    [userId, action],
  );
  return rows;
}

describe("Audit triggers (044)", { skip: CREDS_MISSING }, () => {
  before(async () => {
    adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    const ts = Date.now();
    const { data, error } = await adminSupabase.auth.admin.createUser({
      email: `audit-test-${ts}@example.com`,
      password: `AuditTest_${ts}!`,
      email_confirm: true,
      user_metadata: { username: `audit${String(ts).slice(-6)}`, date_of_birth: "1990-01-01" },
    });
    if (error) throw new Error(`Failed to create test user: ${error.message}`);
    userId = data.user.id;
    // Make sure the profile row exists (the auth trigger normally creates it).
    await pool.query(
      "INSERT INTO public.profile (id, username, date_of_birth) VALUES ($1, $2, '1990-01-01') ON CONFLICT (id) DO NOTHING",
      [userId, `audit${String(ts).slice(-6)}`],
    );
  });

  after(async () => {
    if (userId) await adminSupabase.auth.admin.deleteUser(userId).catch(() => {});
    await pool?.end();
  });

  test("rating set / changed / cleared each write one row with the actor = auth.uid()", async () => {
    await inTx(async ({ client, asUser }) => {
      await asUser();
      await client.query("INSERT INTO public.user_rating (profile_id, media_type, tmdb_id, value) VALUES ($1, 'movie', 603, 7)", [userId]);
      await client.query("UPDATE public.user_rating SET value = 9 WHERE profile_id = $1 AND media_type = 'movie' AND tmdb_id = 603", [userId]);
      await client.query("DELETE FROM public.user_rating WHERE profile_id = $1 AND media_type = 'movie' AND tmdb_id = 603", [userId]);
      const set = await auditRows(client, "rating_set");
      const changed = await auditRows(client, "rating_changed");
      const cleared = await auditRows(client, "rating_cleared");
      assert.equal(set.length, 1);
      assert.equal(set[0].source, "db");
      assert.equal(set[0].path, "direct/user_rating");
      assert.equal(set[0].body.value, 7);
      assert.equal(changed.length, 1);
      assert.equal(changed[0].body.old_value, 7);
      assert.equal(changed[0].body.value, 9);
      assert.equal(cleared.length, 1);
    });
  });

  test("watchlist create / rename / item add / item remove / delete", async () => {
    await inTx(async ({ client, asUser }) => {
      await asUser();
      const { rows: [w] } = await client.query("INSERT INTO public.watchlist (profile_id, name) VALUES ($1, 'Audit list') RETURNING id", [userId]);
      await client.query("UPDATE public.watchlist SET name = 'Renamed' WHERE id = $1", [w.id]);
      await client.query("INSERT INTO public.watchlist_item (watchlist_id, media_type, tmdb_id) VALUES ($1, 'movie', 603)", [w.id]);
      await client.query("DELETE FROM public.watchlist_item WHERE watchlist_id = $1", [w.id]);
      await client.query("DELETE FROM public.watchlist WHERE id = $1", [w.id]);
      for (const a of ["watchlist_created", "watchlist_renamed", "watchlist_item_added", "watchlist_item_removed", "watchlist_deleted"]) {
        const rows = await auditRows(client, a);
        assert.equal(rows.length, 1, `expected one ${a} row`);
        await client.query("SET LOCAL role = authenticated");
      }
    });
  });

  test("profile updates emit one row per changed group, not per column", async () => {
    await inTx(async ({ client, asUser }) => {
      await asUser();
      await client.query("UPDATE public.profile SET is_private = NOT is_private, setting_language = 'pl-PL', setting_region = 'PL', bio = 'hello' WHERE id = $1", [userId]);
      assert.equal((await auditRows(client, "privacy_changed")).length, 1);
      const locale = await auditRows(client, "locale_changed");
      assert.equal(locale.length, 1, "language + region are one locale_changed row");
      assert.equal(locale[0].body.language, "pl-PL");
      const bio = await auditRows(client, "bio_changed");
      assert.equal(bio.length, 1);
      assert.equal(bio[0].body.length, 5, "bio content is not stored, only its length");
      assert.equal((await auditRows(client, "username_changed")).length, 0);
    });
  });

  test("soft deletion (deleted_at set) records account_deleted", async () => {
    await inTx(async ({ client, asOwner }) => {
      await asOwner();
      await client.query("UPDATE public.profile SET deleted_at = now() WHERE id = $1", [userId]);
      const rows = await auditRows(client, "account_deleted");
      assert.equal(rows.length, 1);
      assert.equal(rows[0].method, undefined); // not selected — sanity that the row exists
    });
  });

  test("watchpapa.audit_skip suppresses trigger rows for bulk paths", async () => {
    await inTx(async ({ client, asUser }) => {
      await asUser();
      await client.query("SELECT set_config('watchpapa.audit_skip', '1', true)");
      await client.query("INSERT INTO public.user_rating (profile_id, media_type, tmdb_id, value) VALUES ($1, 'movie', 604, 5)", [userId]);
      assert.equal((await auditRows(client, "rating_set")).length, 0);
    });
  });

  test("clients cannot read audit_events", async () => {
    await inTx(async ({ client, asUser }) => {
      await asUser();
      const { rows } = await client.query("SELECT count(*)::int AS n FROM public.audit_events");
      assert.equal(rows[0].n, 0, "RLS with no policies must hide every row");
    });
  });
});
