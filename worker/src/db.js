import postgres from "postgres";

// One postgres.js client per request, over the Hyperdrive binding (caching disabled).
// Transaction-mode pooler → prepare:false. Stay under the Workers 6-connection cap.
//
// Usage:
//   import { withSql } from "../db.js";
//   return withSql(c, async (sql) => {
//     const rows = await sql`SELECT ...`;
//     return c.json(rows);
//   });

export function getSql(c) {
  return postgres(c.env.HYPERDRIVE.connectionString, {
    max: 5,
    fetch_types: false,
    prepare: false,
    idle_timeout: 20,
  });
}

export async function withSql(c, fn) {
  const sql = getSql(c);
  try {
    return await fn(sql);
  } finally {
    c.executionCtx.waitUntil(sql.end({ timeout: 5 }));
  }
}

// Postgres raises custom errors (e.g. WATCHLIST_LIMIT_REACHED / FOLLOW_LIMIT_REACHED)
// via RAISE EXCEPTION. postgres.js surfaces the text on err.message.
export function pgErrorMessage(err) {
  return String(err?.message ?? "");
}
