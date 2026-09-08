import postgres from "postgres";

// One postgres.js client per request, over the Hyperdrive binding (caching disabled).
// Transaction-mode pooler → prepare:false. Stay under the Workers 6-connection cap.
//
// ⚠️  `fetch_types: false` (below) breaks array-typed BIND params: `${jsArray}`
//     serializes to a bare comma string and Postgres rejects it ("malformed array
//     literal"). Don't write `= ANY(${arr})` / `unnest(${arr}::x[])`. Pass a
//     comma-joined string and rebuild with `string_to_array(${csv}, ',')::x[]`,
//     or use the `IN ${sql(arr)}` helper. (See routes/admin/tierRewards.js.)
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
    // Parse int8/bigint as JS numbers (tmdb ids + our bigint PKs are all well
    // within Number.MAX_SAFE_INTEGER). Without this, postgres.js returns them as
    // strings, which breaks numeric comparisons like `role !== 4`.
    types: {
      bigint: {
        to: 20,
        from: [20],
        parse: (x) => (x === null ? null : Number(x)),
        serialize: (x) => x.toString(),
      },
    },
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
