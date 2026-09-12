import { getSqlFromEnv, pgErrorMessage } from "./db.js";
import { writeAuditRowEnv } from "./audit.js";
import { config } from "./env.js";
import { resolveChunk } from "./import/resolve.js";
import { commitImport } from "./import/commit.js";
import { filmKey } from "./import/filmKey.js";

// Import-job background processor, driven entirely by the Cron Trigger
// (wrangler.jsonc `triggers.crons`, once a minute — the Free plan's minimum;
// no Durable Objects/alarms available).
//
// An earlier version tried to go faster by having each chunk fire the next
// one itself via a self-fetch (`ctx.waitUntil(fetch(own url))`), so a whole
// import would finish in seconds instead of minutes. In production that self-
// chain never actually continued past its first hop — confirmed via
// `wrangler tail`: only the once-a-minute cron sweep ever advanced a job, not
// the chain calling itself. This reverts to the simpler thing proven reliable
// here: the cron tick advances each active job by a couple of chunks in a row.
//
// The real hard ceiling is Cloudflare's 50-subrequests-per-invocation limit
// (not CPU time) — each IMPORT_CHUNK_MAX(10)-film chunk can cost up to ~20
// TMDB fetches (`resolveOne` in import/resolve.js: a Letterboxd URI scrape +
// a /movie lookup, or a /search fallback), so JOBS_PER_TICK * STEPS_PER_JOB
// * 20 must stay well under 50. A first attempt at 3 jobs * 4 steps (up to
// 240 subrequests) hit "Too many subrequests by single Worker invocation"
// partway through and — worse — that error was treated as a permanent job
// failure. It isn't: the resolved/cursor state from every already-completed
// step is durably saved before the next step runs, so a mid-tick error here
// just means "stop for this tick, the next one resumes from the same
// cursor" — never fail the job for it. Only commitImport's own try/catch
// marks a job genuinely 'failed' (e.g. WATCHLIST_LIMIT_REACHED).
const ACTIVE_STATUSES = new Set(["pending", "resolving", "committing"]);
const JOBS_PER_TICK = 1;
const STEPS_PER_JOB_PER_TICK = 2;

async function claimJobs(sql, limit) {
  return sql`
    WITH claimed AS (
      SELECT id FROM public.import_job
      WHERE status IN ('pending', 'resolving', 'committing')
      ORDER BY created_at
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE public.import_job j
    SET updated_at = now()
    FROM claimed
    WHERE j.id = claimed.id
    RETURNING j.id, j.profile_id, j.payload, j.resolved, j.unresolved, j.resolve_cursor, j.total, j.status
  `;
}

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

// Advances `job` by one step and returns the updated in-memory job (so a
// caller can loop without re-querying between steps).
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
    return { ...job, resolved: resolvedMap, unresolved: unresolvedList, resolve_cursor: newCursor, status: nextStatus };
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
        method: "CRON",
        path: "/api/import/jobs",
        status: 200,
        targetUserId: null,
        body: JSON.stringify({ jobId: job.id, conflictMode, ...result }),
      });
      return { ...job, status: "done" };
    } catch (e) {
      const msg = pgErrorMessage(e);
      const cleaned = msg.includes("WATCHLIST_LIMIT_REACHED")
        ? msg.replace("WATCHLIST_LIMIT_REACHED: ", "")
        : e?.message || "Import failed";
      await failJob(sql, job.id, cleaned);
      return { ...job, status: "failed" };
    }
  }

  return job;
}

// Advances one freshly-created job by a single step, in-process (no HTTP self-
// call) — called via waitUntil right after POST /api/import/jobs inserts the
// row, so the UI shows real progress immediately instead of waiting up to a
// minute for the first cron tick. The cron tick above carries the rest.
export async function kickstartJob(env, jobId) {
  const sql = getSqlFromEnv(env);
  try {
    const job = await claimJob(sql, jobId);
    if (job) {
      // A thrown error here (network blip, subrequest budget) is never the
      // job's fault — just this invocation's. Leave its DB status untouched
      // (whatever the last successful step left it as) so the next cron tick
      // resumes it; only advanceJob's own commit-branch try/catch marks a
      // job genuinely 'failed'.
      await advanceJob(env, sql, job).catch((e) => console.error("[IMPORT] kickstart step failed:", e?.message));
    }
  } catch (e) {
    console.error("[IMPORT] kickstart failed:", e?.message);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

// One cron tick: claims up to JOBS_PER_TICK active jobs and advances each by
// up to STEPS_PER_JOB_PER_TICK chunks in a row (stopping early once a job
// finishes), so an import completes in a handful of ticks instead of one
// chunk per tick.
export async function runImportTick(env) {
  const sql = getSqlFromEnv(env);
  try {
    const jobs = await claimJobs(sql, JOBS_PER_TICK);
    for (let job of jobs) {
      for (let step = 0; step < STEPS_PER_JOB_PER_TICK && ACTIVE_STATUSES.has(job.status); step++) {
        try {
          job = await advanceJob(env, sql, job);
        } catch (e) {
          // Transient (subrequest/CPU budget, network blip) — stop advancing
          // this job for this tick; the next tick resumes from the same
          // cursor. Never mark the job failed for this (see comment above).
          console.error(`[IMPORT] job ${job.id} step failed, will retry next tick:`, e?.message);
          break;
        }
      }
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}
