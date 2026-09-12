import { getSqlFromEnv, pgErrorMessage } from "./db.js";
import { writeAuditRowEnv } from "./audit.js";
import { config } from "./env.js";
import { resolveChunk } from "./import/resolve.js";
import { commitImport } from "./import/commit.js";
import { filmKey } from "./import/filmKey.js";

// Import-job background processor. There are no Durable Objects/alarms on the
// Workers Free plan, so a Cloudflare Cron Trigger (wrangler.jsonc
// `triggers.crons`, every 1 minute) is what actually finishes an import once
// the browser tab that started it may be long closed. Each tick advances a
// handful of jobs by one chunk; POST /api/import/jobs also fires one
// immediate tick via `runImportTickForJob` so the UI shows progress right away
// instead of waiting up to a minute for the first real cron fire.

const JOBS_PER_TICK = 2;

async function claimJobs(sql, { limit, jobId } = {}) {
  const filter = jobId != null ? sql`id = ${jobId} AND` : sql``;
  return sql`
    WITH claimed AS (
      SELECT id FROM public.import_job
      WHERE ${filter} status IN ('pending', 'resolving', 'committing')
      ORDER BY created_at
      LIMIT ${limit ?? 1}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE public.import_job j
    SET updated_at = now()
    FROM claimed
    WHERE j.id = claimed.id
    RETURNING j.id, j.profile_id, j.payload, j.resolved, j.unresolved, j.resolve_cursor, j.total, j.status
  `;
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
        method: "CRON",
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

// One cron tick: advance up to JOBS_PER_TICK unfinished jobs by one step.
export async function runImportTick(env) {
  const sql = getSqlFromEnv(env);
  try {
    const jobs = await claimJobs(sql, { limit: JOBS_PER_TICK });
    for (const job of jobs) {
      await advanceJob(env, sql, job).catch((e) => failJob(sql, job.id, e?.message ?? "Import failed"));
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

// Fired once right after job creation for instant feedback — best-effort, the
// next cron tick picks the job up regardless if this gets cut short.
export async function runImportTickForJob(env, jobId) {
  const sql = getSqlFromEnv(env);
  try {
    const [job] = await claimJobs(sql, { jobId });
    if (job) await advanceJob(env, sql, job).catch((e) => failJob(sql, job.id, e?.message ?? "Import failed"));
  } catch (e) {
    console.error("[IMPORT] immediate tick failed:", e?.message);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
