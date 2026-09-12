import { getSqlFromEnv, pgErrorMessage } from "./db.js";
import { writeAuditRowEnv } from "./audit.js";
import { config } from "./env.js";
import { resolveChunk } from "./import/resolve.js";
import { commitImport } from "./import/commit.js";
import { filmKey } from "./import/filmKey.js";

// Import-job background processor.
//
// Each chunk is advanced by a REAL Worker invocation (a self-fetch to
// POST /api/import/_advance/:id), not a loop inside one invocation — the
// Free plan's per-request CPU budget (~10ms) is tight enough that resolving
// hundreds of films in one invocation isn't safe, but one chunk at a time
// always was (the old synchronous /resolve route already proved that shape).
// So `continueChain` below fires the next chunk's invocation from inside the
// current one via `ctx.waitUntil(fetch(...))`, giving each chunk a fresh
// budget while still finishing in seconds, not minutes.
//
// The Cron Trigger (wrangler.jsonc `triggers.crons`, once a minute — no
// Durable Objects/alarms on the Workers Free plan) is just a safety net: it
// sweeps for jobs whose chain died (no progress in STALL_SECONDS, e.g. the
// self-fetch failed) and restarts them. A healthy import never touches it.

const ACTIVE_STATUSES = new Set(["pending", "resolving", "committing"]);
const STALL_SECONDS = 90;
const JOBS_PER_SWEEP = 3;
// Generous runaway guard, not a real-world ceiling — MAX_FILMS (routes/import.js)
// is 5000, so even at IMPORT_CHUNK_MAX=1 this covers a full import with margin.
const DEFAULT_CHAIN_STEPS = 5200;

async function claimJob(sql, jobId) {
  const [job] = await sql`
    WITH claimed AS (
      SELECT id FROM public.import_job
      WHERE id = ${jobId} AND status IN ('pending', 'resolving', 'committing')
      FOR UPDATE SKIP LOCKED
    )
    UPDATE public.import_job j
    SET updated_at = now()
    FROM claimed
    WHERE j.id = claimed.id
    RETURNING j.id, j.profile_id, j.payload, j.resolved, j.unresolved, j.resolve_cursor, j.total, j.status
  `;
  return job ?? null;
}

async function failJob(sql, id, message) {
  try {
    await sql`UPDATE public.import_job SET status = 'failed', error = ${message}, updated_at = now() WHERE id = ${id}`;
  } catch (e) {
    console.error("[IMPORT] failed to record job failure:", e?.message);
  }
}

async function advanceJob(env, sql, job) {
  if (job.status === "pending" || job.status === "resolving") {
    const { importChunkMax } = config(env);
    const films = job.payload.uniqueFilms ?? [];
    const slice = films.slice(job.resolve_cursor, job.resolve_cursor + importChunkMax);
    const matches = await resolveChunk(env, slice);

    const resolvedMap = { ...job.resolved };
    const unresolvedList = [...job.unresolved];
    slice.forEach((film, i) => {
      if (matches[i]) resolvedMap[filmKey(film)] = matches[i].tmdbId;
      else unresolvedList.push(`${film.name} (${film.year})`);
    });

    const newCursor = job.resolve_cursor + slice.length;
    const nextStatus = newCursor >= films.length ? "committing" : "resolving";

    await sql`
      UPDATE public.import_job
      SET resolved = ${sql.json(resolvedMap)}, unresolved = ${sql.json(unresolvedList)},
          resolve_cursor = ${newCursor}, status = ${nextStatus}, updated_at = now()
      WHERE id = ${job.id}
    `;
    return;
  }

  if (job.status === "committing") {
    const { ratingsSrc = [], watchlistSrc = [], watchlistId, newWatchlistName, conflictMode } = job.payload;
    const resolvedMap = job.resolved;

    const ratings = [];
    for (const it of ratingsSrc) {
      const tmdbId = resolvedMap[filmKey(it)];
      if (tmdbId) ratings.push({ tmdbId, value: it.value, ratedAt: it.ratedAt });
    }
    const watchlistItems = [];
    for (const it of watchlistSrc) {
      const tmdbId = resolvedMap[filmKey(it)];
      if (tmdbId) watchlistItems.push({ tmdbId, watched: it.watched });
    }

    try {
      const result = await commitImport(sql, {
        profileId: job.profile_id,
        ratings,
        watchlistItems,
        watchlistId,
        newWatchlistName,
        conflictMode,
      });
      await sql`
        UPDATE public.import_job
        SET status = 'done', result = ${sql.json(result)}, updated_at = now()
        WHERE id = ${job.id}
      `;
      await writeAuditRowEnv(env, {
        action: "import_committed",
        userId: job.profile_id,
        email: null,
        ip: null,
        method: "CHAIN",
        path: "/api/import/jobs",
        status: 200,
        targetUserId: null,
        body: JSON.stringify({ jobId: job.id, conflictMode, ...result }),
      });
    } catch (e) {
      const msg = pgErrorMessage(e);
      const cleaned = msg.includes("WATCHLIST_LIMIT_REACHED")
        ? msg.replace("WATCHLIST_LIMIT_REACHED: ", "")
        : e?.message || "Import failed";
      await failJob(sql, job.id, cleaned);
    }
  }
}

// Claims a job, advances it by one step, and returns its resulting status
// ('resolving'|'committing'|'done'|'failed'|'cancelled'), or null if it
// wasn't claimable (already finished, or another invocation has it).
export async function advanceOneStep(env, sql, jobId) {
  const job = await claimJob(sql, jobId);
  if (!job) return null;
  await advanceJob(env, sql, job).catch((e) => failJob(sql, job.id, e?.message ?? "Import failed"));
  const [row] = await sql`SELECT status FROM public.import_job WHERE id = ${jobId}`;
  return row?.status ?? null;
}

// Fires the next chunk's invocation. `steps` only guards against a runaway
// chain from a logic bug — a real import finishes in well under it.
export function continueChain({ env, ctx, origin, jobId, steps = DEFAULT_CHAIN_STEPS }) {
  if (!env.INTERNAL_TICK_SECRET) {
    console.error("[IMPORT] INTERNAL_TICK_SECRET not set — background import chain disabled");
    return;
  }
  const url = `${origin}/api/import/_advance/${jobId}?steps=${steps}`;
  ctx.waitUntil(
    fetch(url, { method: "POST", headers: { "X-Internal-Secret": env.INTERNAL_TICK_SECRET } }).catch((e) =>
      console.error("[IMPORT] chain continuation failed:", e?.message),
    ),
  );
}

// Handles POST /api/import/_advance/:id (mounted directly in index.js, not
// under importRoutes — no user JWT here, this is the Worker calling itself,
// gated on the shared secret instead).
export async function handleAdvance(c) {
  if (!c.env.INTERNAL_TICK_SECRET || c.req.header("X-Internal-Secret") !== c.env.INTERNAL_TICK_SECRET) {
    return c.json({ error: "Forbidden" }, 403);
  }
  const jobId = Number(c.req.param("id"));
  if (!Number.isInteger(jobId) || jobId <= 0) return c.json({ error: "Invalid job id" }, 400);
  const steps = Number.parseInt(c.req.query("steps") ?? "", 10) || DEFAULT_CHAIN_STEPS;

  const sql = getSqlFromEnv(c.env);
  try {
    const status = await advanceOneStep(c.env, sql, jobId);
    if (status && ACTIVE_STATUSES.has(status)) {
      if (steps > 1) {
        continueChain({ env: c.env, ctx: c.executionCtx, origin: new URL(c.req.url).origin, jobId, steps: steps - 1 });
      } else {
        await failJob(sql, jobId, "Import chain exceeded its step limit");
      }
    }
  } finally {
    c.executionCtx.waitUntil(sql.end({ timeout: 5 }));
  }
  return c.json({ ok: true });
}

// Cron Trigger safety net — restarts any job whose self-chain died. `ctx` is
// the scheduled() handler's own executionCtx, so a restarted chain's fetch is
// held open by waitUntil the same way it would be from a normal request.
export async function runImportTick(env, ctx) {
  const sql = getSqlFromEnv(env);
  try {
    const stalled = await sql`
      SELECT id FROM public.import_job
      WHERE status IN ('pending', 'resolving', 'committing')
        AND updated_at < now() - make_interval(secs => ${STALL_SECONDS})
      ORDER BY created_at
      LIMIT ${JOBS_PER_SWEEP}
    `;
    for (const { id } of stalled) {
      const status = await advanceOneStep(env, sql, id);
      if (status && ACTIVE_STATUSES.has(status) && env.API_ORIGIN) {
        continueChain({ env, ctx, origin: env.API_ORIGIN, jobId: id });
      }
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}
