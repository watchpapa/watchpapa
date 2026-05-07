import dotenv from "dotenv";
import { pathToFileURL } from "url";
import sequelize from "../db/database.js";
import { tmdbRateLimitedFetch } from "./tmdb_rate_limited_fetch.js";

dotenv.config();

const SCRIPT_NAME = "update_tmdb_popularity";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const ALLOWED_ENTITIES = new Set(["movie", "show", "person", "all"]);
const DEFAULT_ENTITY = "all";
const DEFAULT_PAGE_SIZE = 1000;
const DEFAULT_FETCH_CONCURRENCY = 128;
const MAX_PAGE_SIZE = 5000;
const MAX_FETCH_CONCURRENCY = 512;

const ENTITY_CONFIG = {
  movie: {
    tableName: "movie",
    tmdbPath: "movie",
    popularityColumn: "tmdb_popularity",
  },
  show: {
    tableName: "show",
    tmdbPath: "tv",
    popularityColumn: "tmdb_popularity",
  },
  person: {
    tableName: "person",
    tmdbPath: "person",
    popularityColumn: "popularity",
  },
};

let cachedApiKey = null;
let logWritten = false;

// Read and cache the TMDB API key from environment variables.
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

// Build a JSON error payload for failed or partial refresh runs.
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

// Parse and validate a positive integer from CLI args.
function parsePositiveInt(value, flagName) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${flagName} value "${value}". Expected a positive integer.`);
  }
  return parsed;
}

// Parse and validate CLI flags for popularity refresh scripts.
export function parsePopularityArgs(argv, { allowEntity = true } = {}) {
  let entity = allowEntity ? DEFAULT_ENTITY : null;
  let pageSize = DEFAULT_PAGE_SIZE;
  let limit = null;
  let fetchConcurrency = DEFAULT_FETCH_CONCURRENCY;

  for (const arg of argv) {
    const entityMatch = /^--entity=(.+)$/.exec(arg);
    if (entityMatch) {
      if (!allowEntity) {
        throw new Error(
          `Flag --entity is not supported by this script. ` +
            `Run the entity-specific command, or use seed:tmdb:update-popularity for the multi-entity aggregator.`
        );
      }
      const normalized = entityMatch[1].trim().toLowerCase();
      if (!ALLOWED_ENTITIES.has(normalized)) {
        throw new Error(
          `Invalid --entity value "${entityMatch[1]}". Expected one of: movie, show, person, all.`
        );
      }
      entity = normalized;
      continue;
    }

    const pageSizeMatch = /^--page-size=(.+)$/.exec(arg);
    if (pageSizeMatch) {
      pageSize = parsePositiveInt(pageSizeMatch[1], "--page-size");
      continue;
    }

    const limitMatch = /^--limit=(.+)$/.exec(arg);
    if (limitMatch) {
      limit = parsePositiveInt(limitMatch[1], "--limit");
      continue;
    }

    const concurrencyMatch = /^--fetch-concurrency=(.+)$/.exec(arg);
    if (concurrencyMatch) {
      fetchConcurrency = parsePositiveInt(
        concurrencyMatch[1],
        "--fetch-concurrency"
      );
      continue;
    }
  }

  if (pageSize > MAX_PAGE_SIZE) {
    throw new Error(
      `Requested --page-size=${pageSize} is too high. Max allowed value is ${MAX_PAGE_SIZE}.`
    );
  }

  if (fetchConcurrency > MAX_FETCH_CONCURRENCY) {
    throw new Error(
      `Requested --fetch-concurrency=${fetchConcurrency} is too high. Max allowed value is ${MAX_FETCH_CONCURRENCY}.`
    );
  }

  return { entity, pageSize, limit, fetchConcurrency };
}

// Parse CLI args for the main multi-entity popularity script.
function parseArgs(argv) {
  return parsePopularityArgs(argv, { allowEntity: true });
}

// Ensure required database tables exist before refresh starts.
async function ensureTables() {
  const [movieTable] = await sequelize.query(
    `SELECT to_regclass('public.movie') AS table_name;`
  );
  const [showTable] = await sequelize.query(
    `SELECT to_regclass('public.show') AS table_name;`
  );
  const [personTable] = await sequelize.query(
    `SELECT to_regclass('public.person') AS table_name;`
  );
  const [scriptLogsTable] = await sequelize.query(
    `SELECT to_regclass('public.script_logs') AS table_name;`
  );

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

// Resolve the processing order for selected entity scopes.
function getEntityOrder(entity) {
  if (entity === "all") return ["movie", "show", "person"];
  return [entity];
}

// Fetch one local database page of entity ids and tmdb ids.
async function fetchEntityPage({ entityKey, pageSize, lastId, remainingLimit }) {
  const config = ENTITY_CONFIG[entityKey];
  const effectivePageSize =
    remainingLimit == null ? pageSize : Math.min(pageSize, remainingLimit);

  if (effectivePageSize <= 0) {
    return [];
  }

  const [rows] = await sequelize.query(
    `
      SELECT id, tmdb_id
      FROM ${config.tableName}
      WHERE deleted_at IS NULL
        AND id > :lastId
      ORDER BY id
      LIMIT :limit;
    `,
    {
      replacements: {
        lastId,
        limit: effectivePageSize,
      },
    }
  );

  return rows;
}

// Fetch popularity for one TMDB entity id.
async function fetchPopularityForTmdbId({ apiKey, entityKey, tmdbId }) {
  const config = ENTITY_CONFIG[entityKey];
  const url = new URL(`${TMDB_BASE_URL}/${config.tmdbPath}/${tmdbId}`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("language", "en-US");

  const response = await tmdbRateLimitedFetch(url, {
    method: "GET",
    headers: { accept: "application/json" },
  });

  if (response.status === 404) {
    return { status: "missing", tmdbId };
  }

  if (!response.ok) {
    const errorText = await response.text();
    const err = new Error(
      `TMDB ${entityKey} request failed for ${tmdbId}: ${response.status} ${response.statusText} - ${errorText}`
    );
    err.status = response.status;
    throw err;
  }

  const payload = await response.json();
  const popularity = Number(payload?.popularity);

  return {
    status: Number.isFinite(popularity) ? "ok" : "missing-popularity",
    tmdbId,
    popularity: Number.isFinite(popularity) ? popularity : null,
  };
}

// Execute async work across items with bounded concurrency.
async function runWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const current = cursor;
      cursor += 1;
      if (current >= items.length) return;
      results[current] = await worker(items[current], current);
    }
  });

  await Promise.all(workers);
  return results;
}

// Apply popularity updates in bulk using a JSON recordset.
async function bulkUpdatePopularity({ entityKey, updates }) {
  if (updates.length === 0) return 0;

  const config = ENTITY_CONFIG[entityKey];
  const updatesJson = JSON.stringify(
    updates.map((item) => ({
      tmdb_id: item.tmdbId,
      popularity: item.popularity,
    }))
  );

  const [, metadata] = await sequelize.query(
    `
      UPDATE ${config.tableName} AS t
      SET ${config.popularityColumn} = v.popularity,
          updated_at = now()
      FROM (
        SELECT tmdb_id, popularity
        FROM json_to_recordset(CAST(:updatesJson AS json))
          AS x(tmdb_id BIGINT, popularity DOUBLE PRECISION)
      ) AS v
      WHERE t.tmdb_id = v.tmdb_id
        AND t.deleted_at IS NULL
        AND t.${config.popularityColumn} IS DISTINCT FROM v.popularity;
    `,
    {
      replacements: {
        updatesJson,
      },
    }
  );

  return metadata.rowCount ?? 0;
}

// Refresh popularity values for a single entity type.
async function refreshEntityPopularity({
  apiKey,
  entityKey,
  pageSize,
  limit,
  fetchConcurrency,
}) {
  // Track incremental progress and final counters for this entity type.
  let lastId = 0;
  let fetchedRows = 0;
  let updatedRows = 0;
  let missingOnTmdb = 0;
  let missingPopularity = 0;
  let failed = 0;
  const failedItems = [];

  for (;;) {
    // Respect optional run limit while still processing in paginated batches.
    const remainingLimit = limit == null ? null : limit - fetchedRows;
    if (remainingLimit != null && remainingLimit <= 0) break;

    // Read the next page using keyset pagination (id > lastId).
    const rows = await fetchEntityPage({
      entityKey,
      pageSize,
      lastId,
      remainingLimit,
    });

    if (rows.length === 0) break;

    lastId = rows[rows.length - 1].id;
    fetchedRows += rows.length;

    // Fan out TMDB requests with a capped concurrency to avoid API spikes.
    const fetchResults = await runWithConcurrency(
      rows,
      fetchConcurrency,
      async (row) => {
        const tmdbId = Number(row.tmdb_id);
        if (!Number.isFinite(tmdbId)) {
          return { status: "invalid-tmdb-id", tmdbId: row.tmdb_id };
        }
        try {
          return await fetchPopularityForTmdbId({
            apiKey,
            entityKey,
            tmdbId,
          });
        } catch (error) {
          return { status: "failed", tmdbId, error };
        }
      }
    );

    const updates = [];

    // Bucket each fetch result into updates or failure/missing counters.
    for (const item of fetchResults) {
      if (item.status === "ok") {
        updates.push({ tmdbId: item.tmdbId, popularity: item.popularity });
        continue;
      }

      if (item.status === "missing") {
        missingOnTmdb += 1;
        continue;
      }

      if (item.status === "missing-popularity") {
        missingPopularity += 1;
        continue;
      }

      if (item.status === "invalid-tmdb-id") {
        failed += 1;
        failedItems.push({
          entityType: entityKey,
          tmdbId: item.tmdbId,
          reason: "InvalidLocalTmdbId",
        });
        continue;
      }

      failed += 1;
      failedItems.push({
        entityType: entityKey,
        tmdbId: item.tmdbId,
        reason: item.error?.name ?? "Error",
        message: item.error?.message ?? "Unknown error",
      });
    }

    // Persist only successful popularity payloads for this page.
    const changed = await bulkUpdatePopularity({ entityKey, updates });
    updatedRows += changed;

    console.log(
      `[${entityKey}] processed=${fetchedRows} page=${rows.length} updatesCandidate=${updates.length} changed=${changed} missingOnTmdb=${missingOnTmdb} failed=${failed}`
    );
  }

  return {
    entity: entityKey,
    fetchedRows,
    updatedRows,
    missingOnTmdb,
    missingPopularity,
    failed,
    failedItems,
  };
}

// Refresh TMDB popularity values for one or more entity groups.
export async function updateTmdbPopularity({
  entity = DEFAULT_ENTITY,
  pageSize = DEFAULT_PAGE_SIZE,
  limit = null,
  fetchConcurrency = DEFAULT_FETCH_CONCURRENCY,
  apiKey,
} = {}) {
  // Resolve API key once and reuse it across all entity passes.
  const resolvedKey = apiKey ?? getApiKey();
  // Expand "all" into an ordered list so runs are deterministic.
  const entities = getEntityOrder(entity);

  const perEntityResults = [];
  // Process each entity bucket independently and keep per-entity diagnostics.
  for (const entityKey of entities) {
    const result = await refreshEntityPopularity({
      apiKey: resolvedKey,
      entityKey,
      pageSize,
      limit,
      fetchConcurrency,
    });
    perEntityResults.push(result);
  }

  // Roll up counters for a single top-level summary payload.
  const summary = perEntityResults.reduce(
    (acc, result) => {
      acc.fetchedRows += result.fetchedRows;
      acc.updatedRows += result.updatedRows;
      acc.missingOnTmdb += result.missingOnTmdb;
      acc.missingPopularity += result.missingPopularity;
      acc.failed += result.failed;
      return acc;
    },
    {
      fetchedRows: 0,
      updatedRows: 0,
      missingOnTmdb: 0,
      missingPopularity: 0,
      failed: 0,
    }
  );

  // Return both aggregate stats and detailed per-entity failure metadata.
  return {
    entity,
    pageSize,
    limit,
    fetchConcurrency,
    ...summary,
    perEntityResults,
    failedItems: perEntityResults.flatMap((result) => result.failedItems),
  };
}

/**
 * Full CLI lifecycle for a popularity refresh run.
 *
 * - argv: process.argv.slice(2) for arg parsing.
 * - fixedEntity: when set, ignores --entity and locks the run to this entity
 *   (used by entity-specific wrapper scripts).
 * - scriptNamePrefix: prefix for `script_logs.script_name` (e.g. wrappers use
 *   their own prefix so logs are easy to filter).
 */
// Run the full CLI flow for popularity refresh commands.
export async function runPopularityCli({
  argv = process.argv.slice(2),
  fixedEntity = null,
  scriptNamePrefix = SCRIPT_NAME,
} = {}) {
  const startedAt = new Date();
  // Wrapper scripts can lock entity selection by setting fixedEntity.
  const parsed = parsePopularityArgs(argv, {
    allowEntity: fixedEntity == null,
  });
  const entity = fixedEntity ?? parsed.entity ?? DEFAULT_ENTITY;
  const { pageSize, limit, fetchConcurrency } = parsed;

  // Include runtime args in the script log key for easier filtering/comparison.
  const scopedScriptName =
    `${scriptNamePrefix}:entity=${entity}` +
    `:pageSize=${pageSize}` +
    `:limit=${limit ?? "all"}` +
    `:fetchConcurrency=${fetchConcurrency}`;

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
      // Surface missing TMDB key before any DB work so the error is clear
      // even when running in an environment without DB access (CLI tests).
      getApiKey();
      await sequelize.authenticate();
      await ensureTables();

      const result = await updateTmdbPopularity({
        entity,
        pageSize,
        limit,
        fetchConcurrency,
      });

      console.log(
        `Popularity refresh complete. Entity=${entity}. ` +
          `Fetched: ${result.fetchedRows}. Updated: ${result.updatedRows}. ` +
          `TMDB 404/missing: ${result.missingOnTmdb}. Missing popularity: ${result.missingPopularity}. ` +
          `Failed: ${result.failed}.`
      );

      // Persist success or partial-failure summary once per run.
      if (!logWritten) {
        logWritten = true;
        await writeScriptLog({
          scriptName: scopedScriptName,
          status: result.failed === 0 ? "success" : "failure",
          batchSize: result.updatedRows,
          errorCode: result.failed === 0 ? null : "PartialFailure",
          errorDetail:
            result.failed === 0
              ? null
              : buildFailureErrorDetail({
                  scriptName: scopedScriptName,
                  summary: {
                    entity: result.entity,
                    fetchedRows: result.fetchedRows,
                    updatedRows: result.updatedRows,
                    missingOnTmdb: result.missingOnTmdb,
                    missingPopularity: result.missingPopularity,
                    failed: result.failed,
                  },
                  failedItems: result.failedItems,
                }),
          startedAt,
        });
      }
      return result;
    } catch (error) {
      // Fatal path: capture a failure log entry before bubbling error up.
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
    // Always unregister signal handlers and close DB connections.
    process.off("SIGINT", handleStopSignal);
    process.off("SIGTERM", handleStopSignal);
    await sequelize.close();
  }
}

// Run CLI entrypoint for direct script execution.
async function main() {
  await runPopularityCli({ argv: process.argv.slice(2) });
}

const isDirectRun = import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error("Failed to refresh TMDB popularity fields:", error.message);
    process.exit(1);
  });
}
