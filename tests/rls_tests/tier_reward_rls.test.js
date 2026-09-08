/**
 * RLS + RPC coverage for public.tier_reward (migration 047).
 *
 * Same rolled-back-transaction technique as rls_policy_isolation.test.js:
 * writes happen inside a transaction as the `authenticated` / `anon` role with a
 * synthetic JWT, then ROLLBACK, so nothing persists. Setup rows are written on
 * the privileged pool connection (bypasses RLS) and removed in after().
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
const CREDS_MISSING =
  !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !DATABASE_URL
    ? "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and DATABASE_URL must all be set in the repo-root .env"
    : false;

async function asUser(pool, userId, fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL role = authenticated");
    const claims = client.escapeLiteral(
      JSON.stringify({ sub: userId, role: "authenticated", aud: "authenticated" }),
    );
    await client.query(`SET LOCAL "request.jwt.claims" = ${claims}`);
    return await fn(client);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
}

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

let adminSupabase;
let pool;
let userAId = null;
let userBId = null;
const batchId = randomUUID();

describe("tier_reward RLS + acknowledge_tier_rewards", { skip: CREDS_MISSING }, async () => {
  before(async () => {
    adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    const ts = Date.now();

    for (const tag of ["a", "b"]) {
      const { data, error } = await adminSupabase.auth.admin.createUser({
        email: `tr-rls-${tag}-${ts}@example.com`,
        password: `TrRls_${tag}_${ts}!`,
        email_confirm: true,
      });
      if (error) throw new Error(`create test user ${tag}: ${error.message}`);
      if (tag === "a") userAId = data.user.id;
      else userBId = data.user.id;
    }

    const client = await pool.connect();
    try {
      for (const [id, tag] of [[userAId, "a"], [userBId, "b"]]) {
        const existing = await client.query("SELECT 1 FROM public.profile WHERE id = $1", [id]);
        if (existing.rows.length === 0) {
          await client.query(
            `INSERT INTO public.profile (id, username, date_of_birth, is_adult, role)
             VALUES ($1, $2, '2000-01-01', false, 0)`,
            [id, `trRls${tag}${ts}`],
          );
        }
        await client.query(
          `INSERT INTO public.tier_reward (profile_id, batch_id, tier, duration_days, message)
           VALUES ($1, $2, 'pro', 30, 'test')`,
          [id, batchId],
        );
      }
    } finally {
      client.release();
    }
  });

  after(async () => {
    const client = await pool.connect();
    try {
      await client.query("DELETE FROM public.tier_reward WHERE batch_id = $1", [batchId]);
      for (const id of [userAId, userBId]) {
        if (id) await client.query("DELETE FROM public.profile WHERE id = $1", [id]);
      }
    } finally {
      client.release();
    }
    for (const id of [userAId, userBId]) {
      if (id) await adminSupabase.auth.admin.deleteUser(id);
    }
    await pool.end();
  });

  test("RLS is enabled on tier_reward", async () => {
    const client = await pool.connect();
    try {
      const res = await client.query(
        `SELECT relrowsecurity FROM pg_class
          WHERE relname = 'tier_reward' AND relnamespace = 'public'::regnamespace`,
      );
      assert.equal(res.rows[0]?.relrowsecurity, true);
    } finally {
      client.release();
    }
  });

  test("User A reads only their own reward rows", async () => {
    const rows = await asUser(pool, userAId, (c) =>
      c.query("SELECT profile_id FROM public.tier_reward WHERE batch_id = $1", [batchId]).then((r) => r.rows),
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].profile_id, userAId);
  });

  test("User B cannot read User A's reward rows", async () => {
    const rows = await asUser(pool, userBId, (c) =>
      c.query("SELECT id FROM public.tier_reward WHERE profile_id = $1", [userAId]).then((r) => r.rows),
    );
    assert.equal(rows.length, 0);
  });

  test("Anon cannot read any reward rows", async () => {
    const rows = await asAnon(pool, (c) =>
      c.query("SELECT id FROM public.tier_reward LIMIT 1").then((r) => r.rows),
    );
    assert.equal(rows.length, 0);
  });

  test("User A cannot INSERT a reward row directly (no client INSERT policy)", async () => {
    await assert.rejects(
      asUser(pool, userAId, (c) =>
        c.query(
          `INSERT INTO public.tier_reward (profile_id, batch_id, tier) VALUES ($1, $2, 'pro')`,
          [userAId, randomUUID()],
        ),
      ),
      /row-level security|permission denied/i,
    );
  });

  test("User B cannot UPDATE (e.g. acknowledge) User A's rows", async () => {
    const res = await asUser(pool, userBId, (c) =>
      c.query("UPDATE public.tier_reward SET acknowledged_at = now() WHERE profile_id = $1", [userAId]),
    );
    assert.equal(res.rowCount, 0);
  });

  test("acknowledge_tier_rewards() only clears the caller's rows", async () => {
    await asUser(pool, userAId, async (c) => {
      await c.query("SELECT public.acknowledge_tier_rewards(NULL)");
      await c.query("RESET ROLE");
      const a = await c.query(
        "SELECT acknowledged_at FROM public.tier_reward WHERE profile_id = $1 AND batch_id = $2",
        [userAId, batchId],
      );
      const b = await c.query(
        "SELECT acknowledged_at FROM public.tier_reward WHERE profile_id = $1 AND batch_id = $2",
        [userBId, batchId],
      );
      assert.ok(a.rows[0].acknowledged_at !== null, "A's row is acknowledged");
      assert.equal(b.rows[0].acknowledged_at, null, "B's row is untouched");
    });
  });

  test("anon cannot execute acknowledge_tier_rewards()", async () => {
    await assert.rejects(
      asAnon(pool, (c) => c.query("SELECT public.acknowledge_tier_rewards(NULL)")),
      /permission denied|not authorized|UNAUTHENTICATED/i,
    );
  });
});
