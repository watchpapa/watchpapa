import dotenv from "dotenv";
import { pathToFileURL } from "url";
import sequelize from "../db/database.js";
import { tmdbRateLimitedFetch } from "./tmdb_rate_limited_fetch.js";

dotenv.config();

const SCRIPT_NAME = "backfill_season_poster_paths";
const TMDB_TV_URL = "https://api.themoviedb.org/3/tv";

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
  const [seasonTable] = await sequelize.query(
    `SELECT to_regclass('public.season') AS table_name;`
  );
  const [showTable] = await sequelize.query(
    `SELECT to_regclass('public.show') AS table_name;`
  );
  const [scriptLogsTable] = await sequelize.query(
    `SELECT to_regclass('public.script_logs') AS table_name;`
  );
  if (
    !seasonTable?.[0]?.table_name ||
    !showTable?.[0]?.table_name ||
    !scriptLogsTable?.[0]?.table_name
  ) {
    throw new Error(
      "Required tables missing: expected public.season, public.show, and public.script_logs."
    );
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

async function fetchSeasonsNeedingPosters() {
  const [rows] = await sequelize.query(
    `
      SELECT s.id          AS season_id,
             s.season_number,
             sh.tmdb_id    AS show_tmdb_id
      FROM season s
      JOIN show sh ON sh.id = s.show_id
      WHERE s.poster_path IS NULL
        AND s.deleted_at  IS NULL
      ORDER BY sh.tmdb_id, s.season_number;
    `
  );
  return rows;
}

function groupByShow(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = row.show_tmdb_id;
    const seasonNumber = Number.parseInt(row.season_number, 10);
    if (!Number.isFinite(seasonNumber)) {
      console.warn(
        `Skipping season_id=${row.season_id} because season_number="${row.season_number}" is not numeric.`
      );
      continue;
    }
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({ seasonId: row.season_id, seasonNumber });
  }
  return [...map.entries()];
}

async function fetchTmdbShowSeasons(apiKey, showTmdbId) {
  const url = new URL(`${TMDB_TV_URL}/${showTmdbId}`);
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

  const payload = await response.json();
  const seasons = Array.isArray(payload.seasons) ? payload.seasons : [];

  const posterBySeasonNumber = new Map();
  for (const s of seasons) {
    if (Number.isFinite(s?.season_number)) {
      posterBySeasonNumber.set(
        s.season_number,
        typeof s.poster_path === "string" ? s.poster_path : null
      );
    }
  }
  return posterBySeasonNumber;
}

async function updateSeasonPosterPath(seasonId, posterPath) {
  if (typeof posterPath !== "string" || posterPath.length === 0) {
    return 0;
  }
  const [updatedRows] = await sequelize.query(
    `
      UPDATE season
      SET poster_path = :posterPath,
          updated_at  = now()
      WHERE id = :seasonId
        AND poster_path IS NULL
      RETURNING id;
    `,
    { replacements: { seasonId, posterPath } }
  );
  return updatedRows.length;
}

export async function backfillSeasonPosterPaths({ limit = null, apiKey } = {}) {
  const resolvedKey = apiKey ?? getApiKey();
  const rows = await fetchSeasonsNeedingPosters();
  let grouped = groupByShow(rows);

  if (limit != null) grouped = grouped.slice(0, limit);

  let showsProcessed = 0;
  let seasonsUpdated = 0;
  let seasonsSkippedNoPoster = 0;
  let failed = 0;
  const failedItems = [];

  for (let i = 0; i < grouped.length; i++) {
    const [showTmdbId, seasonRows] = grouped[i];
    const prefix = `[${i + 1}/${grouped.length}]`;

    try {
      const posterBySeasonNumber = await fetchTmdbShowSeasons(resolvedKey, showTmdbId);

      for (const { seasonId, seasonNumber } of seasonRows) {
        const posterPath = posterBySeasonNumber.get(seasonNumber) ?? null;
        if (posterPath == null) {
          seasonsSkippedNoPoster += 1;
          continue;
        }
        seasonsUpdated += await updateSeasonPosterPath(seasonId, posterPath);
      }

      showsProcessed += 1;
      console.log(
        `${prefix} Show tmdb_id=${showTmdbId}: ${seasonRows.length} season(s) updated`
      );
    } catch (error) {
      failed += 1;
      failedItems.push({ entityType: "show", showTmdbId });
      console.warn(
        `${prefix} Show tmdb_id=${showTmdbId} failed: ${error.message}`
      );
    }
  }

  return {
    totalShows: grouped.length,
    showsProcessed,
    seasonsUpdated,
    seasonsSkippedNoPoster,
    failed,
    failedItems,
  };
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

      const result = await backfillSeasonPosterPaths({ limit });

      console.log(
        `Season poster backfill complete. Shows processed: ${result.showsProcessed}/${result.totalShows}. ` +
          `Seasons updated: ${result.seasonsUpdated}. ` +
          `Seasons skipped (no TMDB poster): ${result.seasonsSkippedNoPoster}. ` +
          `Failed shows: ${result.failed}.`
      );

      if (!logWritten) {
        logWritten = true;
        await writeScriptLog({
          scriptName: scopedScriptName,
          status: result.failed === 0 ? "success" : "failure",
          batchSize: result.seasonsUpdated,
          errorCode: result.failed === 0 ? null : "PartialFailure",
          errorDetail:
            result.failed === 0
              ? null
              : buildFailureErrorDetail({
                  scriptName: scopedScriptName,
                  summary: {
                    totalShows: result.totalShows,
                    showsProcessed: result.showsProcessed,
                    seasonsUpdated: result.seasonsUpdated,
                    seasonsSkippedNoPoster: result.seasonsSkippedNoPoster,
                    failed: result.failed,
                  },
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
    console.error("Failed to backfill season poster paths:", error.message);
    process.exit(1);
  });
}
