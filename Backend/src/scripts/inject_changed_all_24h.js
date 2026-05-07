import dotenv from "dotenv";
import { pathToFileURL } from "url";
import sequelize from "../db/database.js";
import { ingestChangedMovies24h } from "./inject_changed_movies_24h.js";
import { ingestChangedShows24h } from "./inject_changed_shows_24h.js";
import { ingestChangedPeople24h } from "./inject_changed_people_24h.js";

dotenv.config();

const SCRIPT_NAME = "inject_changed_all_24h";
const MAX_LIMIT = 100000;
let logWritten = false;

// Persist one execution record in script_logs for observability.
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
      ? Math.max(
          0,
          (finishedAt.getTime() - new Date(startedAt).getTime()) / 1000
        )
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

// Ensure required database tables exist before refresh starts.
async function ensureTables() {
  const [movieTable] = await sequelize.query(`
    SELECT to_regclass('public.movie') AS table_name;
  `);
  const [showTable] = await sequelize.query(`
    SELECT to_regclass('public.show') AS table_name;
  `);
  const [personTable] = await sequelize.query(`
    SELECT to_regclass('public.person') AS table_name;
  `);
  const [scriptLogsTable] = await sequelize.query(`
    SELECT to_regclass('public.script_logs') AS table_name;
  `);

  if (!movieTable?.[0]?.table_name) {
    throw new Error("Required table missing: expected public.movie.");
  }
  if (!showTable?.[0]?.table_name) {
    throw new Error("Required table missing: expected public.show.");
  }
  if (!personTable?.[0]?.table_name) {
    throw new Error("Required table missing: expected public.person.");
  }
  if (!scriptLogsTable?.[0]?.table_name) {
    throw new Error("Required table missing: expected public.script_logs.");
  }
}

// Parse supported CLI arguments and validate their values.
function parseArgs(argv) {
  let limit = 100000;
  let startDate;
  let endDate;

  for (const arg of argv) {
    const limitMatch = /^--limit=(.+)$/.exec(arg);
    if (limitMatch) {
      const parsed = Number.parseInt(limitMatch[1], 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(
          `Invalid --limit value "${limitMatch[1]}". Expected a positive integer.`
        );
      }
      limit = parsed;
      continue;
    }

    const startMatch = /^--start-date=(.+)$/.exec(arg);
    if (startMatch) {
      startDate = startMatch[1];
      continue;
    }

    const endMatch = /^--end-date=(.+)$/.exec(arg);
    if (endMatch) {
      endDate = endMatch[1];
      continue;
    }
  }

  if (limit > MAX_LIMIT) {
    throw new Error(
      `Requested --limit=${limit} is too high. Max allowed value is ${MAX_LIMIT}.`
    );
  }

  return { limit, startDate, endDate };
}

// Sum a numeric field across multiple result objects.
function sumField(field, ...results) {
  return results.reduce((acc, r) => acc + (r?.[field] ?? 0), 0);
}

// Sum total refreshed entities across all entity groups.
function sumRefreshed(...results) {
  return sumField("refreshed", ...results);
}

// Sum total failed entities across all entity groups.
function sumFailed(...results) {
  return sumField("failed", ...results);
}

// Merge failed item arrays from all entity group results.
function combineFailedItems(...results) {
  return results.flatMap((result) =>
    Array.isArray(result?.failedItems) ? result.failedItems : []
  );
}

// Build a JSON error payload for failed or partial refresh runs.
export function buildFailureErrorDetail({
  scriptName,
  summary,
  failedItems,
  fatalError,
}) {
  return JSON.stringify({
    scriptName,
    summary,
    failedItems,
    fatalError: fatalError
      ? {
          name: fatalError?.name ?? "Error",
          message: fatalError?.message ?? String(fatalError),
        }
      : null,
  });
}

// Run changed-entity refresh for movies, shows, and people.
export async function ingestChangedAll24h({ limit = 100000, apiKey, startDate, endDate } = {}) {
  const movies = await ingestChangedMovies24h({ limit, apiKey, startDate, endDate });
  const shows = await ingestChangedShows24h({ limit, apiKey, startDate, endDate });
  const people = await ingestChangedPeople24h({ limit, apiKey, startDate, endDate });

  return {
    startDate: movies.startDate,
    endDate: movies.endDate,
    movies,
    shows,
    people,
    refreshed: sumRefreshed(movies, shows, people),
    refreshedFull: sumField("refreshedFull", movies, shows, people),
    refreshedScoped: sumField("refreshedScoped", movies, shows, people),
    refreshedTargeted: sumField("refreshedTargeted", movies, shows, people),
    unchanged: sumField("unchanged", movies, shows, people),
    failed: sumFailed(movies, shows, people),
    failedItems: combineFailedItems(movies, shows, people),
  };
}

// Run the script lifecycle: setup, refresh, logging, and cleanup.
async function main() {
  const startedAt = new Date();
  // Parse CLI options once and scope the log name to the requested limit.
  const { limit, startDate, endDate } = parseArgs(process.argv.slice(2));
  const scopedScriptName = `${SCRIPT_NAME}:limit=${limit}`;

  // Handle termination signals and write a stopped log entry once.
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
      // Verify DB connectivity and required tables before doing any refresh work.
      await sequelize.authenticate();
      await ensureTables();

      // Execute the aggregate refresh that runs movies, shows, and people.
      const result = await ingestChangedAll24h({ limit, startDate, endDate });
      console.log(
        `Changed all refresh complete (${result.startDate}..${result.endDate}). ` +
          `Movies refreshed: ${result.movies.refreshed} ` +
          `(full ${result.movies.refreshedFull ?? 0}, scoped ${result.movies.refreshedScoped ?? 0}), ` +
          `unchanged: ${result.movies.unchanged ?? 0}, failed: ${result.movies.failed}. ` +
          `Shows refreshed: ${result.shows.refreshed} ` +
          `(full ${result.shows.refreshedFull ?? 0}, scoped ${result.shows.refreshedScoped ?? 0}, ` +
          `targetedEpisodes ${result.shows.refreshedTargeted ?? 0}), ` +
          `unchanged: ${result.shows.unchanged ?? 0}, failed: ${result.shows.failed}. ` +
          `People refreshed: ${result.people.refreshed} ` +
          `(full ${result.people.refreshedFull ?? 0}, scoped ${result.people.refreshedScoped ?? 0}), ` +
          `unchanged: ${result.people.unchanged ?? 0}, failed: ${result.people.failed}. ` +
          `Total refreshed: ${result.refreshed} ` +
          `(full ${result.refreshedFull}, scoped ${result.refreshedScoped}, targetedEpisodes ${result.refreshedTargeted}), ` +
          `total unchanged: ${result.unchanged}, total failed: ${result.failed}.`
      );

      if (!logWritten) {
        logWritten = true;
        await writeScriptLog({
          scriptName: scopedScriptName,
          status: result.failed === 0 ? "success" : "failure",
          batchSize: result.refreshed,
          errorCode: result.failed === 0 ? null : "PartialFailure",
          errorDetail:
            result.failed === 0
              ? null
              : buildFailureErrorDetail({
                  scriptName: scopedScriptName,
                  summary: {
                    refreshed: result.refreshed,
                    refreshedFull: result.refreshedFull,
                    refreshedScoped: result.refreshedScoped,
                    refreshedTargeted: result.refreshedTargeted,
                    unchanged: result.unchanged,
                    failed: result.failed,
                    startDate: result.startDate,
                    endDate: result.endDate,
                    movies: {
                      refreshed: result.movies.refreshed,
                      refreshedFull: result.movies.refreshedFull ?? 0,
                      refreshedScoped: result.movies.refreshedScoped ?? 0,
                      unchanged: result.movies.unchanged ?? 0,
                      failed: result.movies.failed,
                    },
                    shows: {
                      refreshed: result.shows.refreshed,
                      refreshedFull: result.shows.refreshedFull ?? 0,
                      refreshedScoped: result.shows.refreshedScoped ?? 0,
                      refreshedTargeted: result.shows.refreshedTargeted ?? 0,
                      unchanged: result.shows.unchanged ?? 0,
                      failed: result.shows.failed,
                    },
                    people: {
                      refreshed: result.people.refreshed,
                      refreshedFull: result.people.refreshedFull ?? 0,
                      refreshedScoped: result.people.refreshedScoped ?? 0,
                      unchanged: result.people.unchanged ?? 0,
                      failed: result.people.failed,
                    },
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
    // Always remove signal handlers and close the DB connection.
    process.off("SIGINT", handleStopSignal);
    process.off("SIGTERM", handleStopSignal);
    await sequelize.close();
  }
}

const isDirectRun = import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error("Failed to refresh all changed TMDB entities:", error.message);
    process.exit(1);
  });
}
