import dotenv from "dotenv";
import { pathToFileURL } from "url";
import sequelize from "../db/database.js";
import { tmdbRateLimitedFetch } from "./tmdb_rate_limited_fetch.js";

dotenv.config();

const SCRIPT_NAME = "backfill_movie_poster_paths";
const TMDB_MOVIE_URL = "https://api.themoviedb.org/3/movie";

let cachedApiKey = null;
let logWritten = false;

function getApiKey() {
  if (cachedApiKey) return cachedApiKey;
  const apiKey = process.env.TMDB_API_KEY_SECRET;
  if (!apiKey) {
    throw new Error(
      "Missing TMDB_API_KEY_SECRET in environment. Add it to your .env file."
    );
  }
  cachedApiKey = apiKey;
  return apiKey;
}

async function writeScriptLog({
  scriptName = SCRIPT_NAME,
  status,
  batchSize,
  errorCode,
  errorDetail,
  startedAt,
}) {
  const finishedAt = new Date();
  const runtime =
    startedAt != null
      ? Math.max(0, (finishedAt.getTime() - new Date(startedAt).getTime()) / 1000)
      : null;
  try {
    await sequelize.query(
      `
        INSERT INTO public.script_logs
          (script_name, status, batch_size, error_code, error_detail, started_at, finished_at, runtime)
        VALUES
          (:scriptName, :status, :batchSize, :errorCode, :errorDetail, :startedAt, :finishedAt, :runtime);
      `,
      {
        replacements: {
          scriptName,
          status,
          batchSize: batchSize ?? null,
          errorCode: errorCode ?? null,
          errorDetail: errorDetail ?? null,
          startedAt: startedAt ?? null,
          finishedAt,
          runtime,
        },
      }
    );
  } catch (logError) {
    console.error("Failed to write script_logs row:", logError.message);
  }
}

function buildFailureErrorDetail({ scriptName, summary, failedItems, fatalError }) {
  return JSON.stringify({
    scriptName,
    summary,
    failedItems,
    fatalError: fatalError
      ? { name: fatalError?.name ?? "Error", message: fatalError?.message ?? String(fatalError) }
      : null,
  });
}

async function ensureTables() {
  const [movieTable] = await sequelize.query(
    `SELECT to_regclass('public.movie') AS table_name;`
  );
  const [scriptLogsTable] = await sequelize.query(
    `SELECT to_regclass('public.script_logs') AS table_name;`
  );
  if (!movieTable?.[0]?.table_name || !scriptLogsTable?.[0]?.table_name) {
    throw new Error("Required tables missing: expected public.movie and public.script_logs.");
  }
}

function parseArgs(argv) {
  let limit = null;
  for (const arg of argv) {
    const m = /^--limit=(.+)$/.exec(arg);
    if (m) {
      const parsed = Number.parseInt(m[1], 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid --limit value "${m[1]}". Expected a positive integer.`);
      }
      limit = parsed;
    }
  }
  return { limit };
}

async function fetchMoviesNeedingPosters(limit) {
  const limitClause = limit != null ? `LIMIT ${Number(limit)}` : "";
  const [rows] = await sequelize.query(
    `
      SELECT id, tmdb_id
      FROM movie
      WHERE poster_path IS NULL
        AND deleted_at IS NULL
      ORDER BY id
      ${limitClause};
    `
  );
  return rows;
}

async function fetchTmdbMoviePoster(apiKey, tmdbId) {
  const url = new URL(`${TMDB_MOVIE_URL}/${tmdbId}`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("language", "en-US");

  const response = await tmdbRateLimitedFetch(url, {
    method: "GET",
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    const errorText = await response.text();
    const err = new Error(
      `TMDB request failed: ${response.status} ${response.statusText} - ${errorText}`
    );
    err.status = response.status;
    throw err;
  }

  return response.json();
}

async function updateMoviePosterPath(id, posterPath) {
  await sequelize.query(
    `
      UPDATE movie
      SET poster_path = :posterPath,
          updated_at  = now()
      WHERE id = :id
        AND poster_path IS NULL;
    `,
    { replacements: { id, posterPath } }
  );
}

export async function backfillMoviePosterPaths({ limit = null, apiKey } = {}) {
  const resolvedKey = apiKey ?? getApiKey();
  const rows = await fetchMoviesNeedingPosters(limit);

  let updated = 0;
  let failed = 0;
  const failedItems = [];

  for (let i = 0; i < rows.length; i++) {
    const { id, tmdb_id: tmdbId } = rows[i];
    const prefix = `[${i + 1}/${rows.length}]`;

    try {
      const data = await fetchTmdbMoviePoster(resolvedKey, tmdbId);
      const posterPath = typeof data.poster_path === "string" ? data.poster_path : null;
      await updateMoviePosterPath(id, posterPath);
      updated += 1;
      console.log(`${prefix} Movie tmdb_id=${tmdbId} -> poster_path=${posterPath}`);
    } catch (error) {
      failed += 1;
      failedItems.push({ entityType: "movie", tmdbId });
      console.warn(`${prefix} Movie tmdb_id=${tmdbId} failed: ${error.message}`);
    }
  }

  return { total: rows.length, updated, failed, failedItems };
}

async function main() {
  const startedAt = new Date();
  const { limit } = parseArgs(process.argv.slice(2));
  const scopedScriptName = `${SCRIPT_NAME}:limit=${limit ?? "all"}`;

  function handleStopSignal(signal) {
    if (logWritten) return;
    logWritten = true;
    console.error(`\nReceived ${signal}. Writing stopped log and exiting...`);
    writeScriptLog({
      scriptName: scopedScriptName,
      status: "stopped",
      batchSize: null,
      errorCode: "StoppedBySignal",
      errorDetail: `Process interrupted by ${signal}.`,
      startedAt,
    })
      .finally(() => sequelize.close())
      .finally(() => process.exit(1));
  }

  process.on("SIGINT", handleStopSignal);
  process.on("SIGTERM", handleStopSignal);

  try {
    try {
      await sequelize.authenticate();
      await ensureTables();

      const result = await backfillMoviePosterPaths({ limit });

      console.log(
        `Movie poster backfill complete. Total: ${result.total}. Updated: ${result.updated}. Failed: ${result.failed}.`
      );

      if (!logWritten) {
        logWritten = true;
        await writeScriptLog({
          scriptName: scopedScriptName,
          status: result.failed === 0 ? "success" : "failure",
          batchSize: result.updated,
          errorCode: result.failed === 0 ? null : "PartialFailure",
          errorDetail:
            result.failed === 0
              ? null
              : buildFailureErrorDetail({
                  scriptName: scopedScriptName,
                  summary: { total: result.total, updated: result.updated, failed: result.failed },
                  failedItems: result.failedItems,
                }),
          startedAt,
        });
      }
    } catch (error) {
      if (!logWritten) {
        logWritten = true;
        await writeScriptLog({
          scriptName: scopedScriptName,
          status: "failure",
          batchSize: null,
          errorCode: error?.name ?? "Error",
          errorDetail: buildFailureErrorDetail({
            scriptName: scopedScriptName,
            summary: null,
            failedItems: [],
            fatalError: error,
          }),
          startedAt,
        });
      }
      throw error;
    }
  } finally {
    process.off("SIGINT", handleStopSignal);
    process.off("SIGTERM", handleStopSignal);
    await sequelize.close();
  }
}

const isDirectRun = import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error("Failed to backfill movie poster paths:", error.message);
    process.exit(1);
  });
}
