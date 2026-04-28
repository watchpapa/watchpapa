import dotenv from "dotenv";
import { pathToFileURL } from "url";
import sequelize from "../db/database.js";
import ingestPerson from "./inject_person.js";
import {
  classifyPersonChanges,
  fetchChangedPersonIds,
  fetchTmdbEntityChanges,
  resolve24hDateWindow,
} from "./tmdb_changes_fetch.js";

dotenv.config();

const SCRIPT_NAME = "inject_changed_people_24h";
const MAX_LIMIT = 100000;

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

async function ensureTables() {
  const [personTable] = await sequelize.query(`
    SELECT to_regclass('public.person') AS table_name;
  `);
  const [scriptLogsTable] = await sequelize.query(`
    SELECT to_regclass('public.script_logs') AS table_name;
  `);

  if (!personTable?.[0]?.table_name) {
    throw new Error("Required table missing: expected public.person.");
  }
  if (!scriptLogsTable?.[0]?.table_name) {
    throw new Error("Required table missing: expected public.script_logs.");
  }
}

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

async function fetchExistingPersonTmdbIds(tmdbIds) {
  if (tmdbIds.length === 0) return new Set();

  const [rows] = await sequelize.query(
    `
      SELECT tmdb_id
      FROM person
      WHERE tmdb_id IN (:tmdbIds);
    `,
    { replacements: { tmdbIds } }
  );
  // person.tmdb_id is BIGINT and the pg driver returns those as strings.
  // Coerce to Number so Set.has(numericTmdbId) actually matches the input.
  return new Set(rows.map((row) => Number(row.tmdb_id)));
}

function buildFailureErrorDetail({ scriptName, summary, failedItems, fatalError }) {
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

export async function ingestChangedPeople24h({
  limit = 100000,
  apiKey,
  startDate,
  endDate,
} = {}) {
  const resolvedKey = apiKey ?? getApiKey();
  const resolvedRange = resolve24hDateWindow({ startDate, endDate });

  const changedIds = await fetchChangedPersonIds({
    apiKey: resolvedKey,
    limit,
    startDate: resolvedRange.startDate,
    endDate: resolvedRange.endDate,
  });
  const existingIds = await fetchExistingPersonTmdbIds(changedIds);
  const toRefresh = changedIds.filter((tmdbId) => existingIds.has(tmdbId));

  let refreshed = 0;
  let refreshedFull = 0;
  let refreshedScoped = 0;
  let unchanged = 0;
  let failed = 0;
  let skippedRace = 0;
  const failedItems = [];

  for (let i = 0; i < toRefresh.length; i += 1) {
    const tmdbId = toRefresh[i];
    const prefix = `[${i + 1}/${toRefresh.length}]`;

    const raceCheck = await fetchExistingPersonTmdbIds([tmdbId]);
    if (!raceCheck.has(tmdbId)) {
      console.log(`${prefix} Person ${tmdbId} no longer exists locally -> skipped`);
      skippedRace += 1;
      continue;
    }

    try {
      const { changes } = await fetchTmdbEntityChanges({
        apiKey: resolvedKey,
        entityPath: "person",
        tmdbId,
        startDate: resolvedRange.startDate,
        endDate: resolvedRange.endDate,
      });
      const classification = classifyPersonChanges(changes);

      if (!classification.hasChanges) {
        console.log(
          `${prefix} Person ${tmdbId} no field-level changes -> unchanged`
        );
        unchanged += 1;
        continue;
      }

      const refreshScope = classification.fullSync
        ? null
        : classification.scope;

      const result = await ingestPerson({
        tmdbId,
        apiKey: resolvedKey,
        forceRefreshExisting: true,
        refreshScope,
      });

      const scopeLabel = refreshScope
        ? `scope=${formatScope(classification.scope)}`
        : "full";
      console.log(
        `${prefix} Person ${tmdbId} refreshed (${result.action}, ${scopeLabel})`
      );
      refreshed += 1;
      if (refreshScope) refreshedScoped += 1;
      else refreshedFull += 1;
    } catch (error) {
      failed += 1;
      failedItems.push({ entityType: "person", tmdbId });
      console.warn(`${prefix} Person ${tmdbId} failed refresh: ${error.message}`);
    }
  }

  return {
    startDate: resolvedRange.startDate,
    endDate: resolvedRange.endDate,
    changedFetched: changedIds.length,
    existingMatched: toRefresh.length,
    refreshed,
    refreshedFull,
    refreshedScoped,
    unchanged,
    failed,
    skippedRace,
    failedItems,
  };
}

function formatScope(scope) {
  return Object.entries(scope)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(",") || "none";
}

async function main() {
  const startedAt = new Date();
  const { limit, startDate, endDate } = parseArgs(process.argv.slice(2));
  const scopedScriptName = `${SCRIPT_NAME}:limit=${limit}`;

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

      const result = await ingestChangedPeople24h({ limit, startDate, endDate });
      console.log(
        `Changed people refresh complete (${result.startDate}..${result.endDate}). ` +
          `Changed fetched: ${result.changedFetched}. Existing matched: ${result.existingMatched}. ` +
          `Refreshed: ${result.refreshed} (full ${result.refreshedFull}, scoped ${result.refreshedScoped}). ` +
          `Unchanged: ${result.unchanged}. Failed: ${result.failed}. Skipped race: ${result.skippedRace}.`
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
                    unchanged: result.unchanged,
                    failed: result.failed,
                    changedFetched: result.changedFetched,
                    existingMatched: result.existingMatched,
                    skippedRace: result.skippedRace,
                    startDate: result.startDate,
                    endDate: result.endDate,
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
    console.error("Failed to refresh changed TMDB people:", error.message);
    process.exit(1);
  });
}
