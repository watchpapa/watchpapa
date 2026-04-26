import dotenv from "dotenv";
import { pathToFileURL } from "url";
import sequelize from "../db/database.js";
import { tmdbRateLimitedFetch } from "./tmdb_rate_limited_fetch.js";

dotenv.config();

const SCRIPT_NAME = "backfill_episode_poster_paths";
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
  const [episodeTable] = await sequelize.query(
    `SELECT to_regclass('public.episode') AS table_name;`
  );
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
    !episodeTable?.[0]?.table_name ||
    !seasonTable?.[0]?.table_name ||
    !showTable?.[0]?.table_name ||
    !scriptLogsTable?.[0]?.table_name
  ) {
    throw new Error(
      "Required tables missing: expected public.episode, public.season, public.show, and public.script_logs."
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

async function fetchSeasonPairsNeedingPosters() {
  const [rows] = await sequelize.query(
    `
      SELECT DISTINCT s.season_number,
                      sh.tmdb_id AS show_tmdb_id
      FROM episode e
      JOIN season s  ON s.id  = e.season_id
      JOIN show   sh ON sh.id = s.show_id
      WHERE e.poster_path IS NULL
        AND e.deleted_at  IS NULL
      ORDER BY sh.tmdb_id, s.season_number;
    `
  );
  return rows;
}

async function fetchTmdbSeasonEpisodes(apiKey, showTmdbId, seasonNumber) {
  const url = new URL(`${TMDB_TV_URL}/${showTmdbId}/season/${seasonNumber}`);
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
  return Array.isArray(payload.episodes) ? payload.episodes : [];
}

async function updateEpisodePosterPath(episodeTmdbId, posterPath) {
  await sequelize.query(
    `
      UPDATE episode
      SET poster_path = :posterPath,
          updated_at  = now()
      WHERE tmdb_id = :episodeTmdbId
        AND poster_path IS NULL;
    `,
    { replacements: { episodeTmdbId, posterPath } }
  );
}

export async function backfillEpisodePosterPaths({ limit = null, apiKey } = {}) {
  const resolvedKey = apiKey ?? getApiKey();
  let pairs = await fetchSeasonPairsNeedingPosters();

  if (limit != null) pairs = pairs.slice(0, limit);

  let seasonsProcessed = 0;
  let episodesUpdated = 0;
  let failed = 0;
  const failedItems = [];

  for (let i = 0; i < pairs.length; i++) {
    const { show_tmdb_id: showTmdbId, season_number: seasonNumber } = pairs[i];
    const prefix = `[${i + 1}/${pairs.length}]`;

    try {
      const episodes = await fetchTmdbSeasonEpisodes(resolvedKey, showTmdbId, seasonNumber);

      for (const ep of episodes) {
        if (typeof ep?.id !== "number") continue;
        const posterPath = typeof ep.still_path === "string" ? ep.still_path : null;
        await updateEpisodePosterPath(ep.id, posterPath);
        episodesUpdated += 1;
      }

      seasonsProcessed += 1;
      console.log(
        `${prefix} Show tmdb_id=${showTmdbId} S${seasonNumber}: ${episodes.length} episode(s) updated`
      );
    } catch (error) {
      failed += 1;
      failedItems.push({ entityType: "season", showTmdbId, seasonNumber });
      console.warn(
        `${prefix} Show tmdb_id=${showTmdbId} S${seasonNumber} failed: ${error.message}`
      );
    }
  }

  return {
    totalPairs: pairs.length,
    seasonsProcessed,
    episodesUpdated,
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

      const result = await backfillEpisodePosterPaths({ limit });

      console.log(
        `Episode poster backfill complete. Season pairs processed: ${result.seasonsProcessed}/${result.totalPairs}. Episodes updated: ${result.episodesUpdated}. Failed pairs: ${result.failed}.`
      );

      if (!logWritten) {
        logWritten = true;
        await writeScriptLog({
          scriptName: scopedScriptName,
          status: result.failed === 0 ? "success" : "failure",
          batchSize: result.episodesUpdated,
          errorCode: result.failed === 0 ? null : "PartialFailure",
          errorDetail:
            result.failed === 0
              ? null
              : buildFailureErrorDetail({
                  scriptName: scopedScriptName,
                  summary: {
                    totalPairs: result.totalPairs,
                    seasonsProcessed: result.seasonsProcessed,
                    episodesUpdated: result.episodesUpdated,
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
    console.error("Failed to backfill episode poster paths:", error.message);
    process.exit(1);
  });
}
