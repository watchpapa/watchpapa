import dotenv from "dotenv";
import { pathToFileURL } from "url";
import sequelize from "../db/database.js";
import ingestPerson from "./inject_person.js";
import { tmdbRateLimitedFetch } from "./tmdb_rate_limited_fetch.js";

dotenv.config();

const SCRIPT_NAME = "inject_popular_people_today";
const TMDB_POPULAR_PEOPLE_URL = "https://api.themoviedb.org/3/person/popular";
const TMDB_PAGE_SIZE = 20;
const MAX_LIMIT = 500;

let cachedApiKey = null;

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

async function fetchPopularPeoplePage(apiKey, page) {
  const url = new URL(TMDB_POPULAR_PEOPLE_URL);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("language", "en-US");
  url.searchParams.set("page", String(page));

  const response = await tmdbRateLimitedFetch(url, {
    method: "GET",
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    const errorText = await response.text();
    const err = new Error(
      `TMDB popular people request failed: ${response.status} ${response.statusText} - ${errorText}`
    );
    err.status = response.status;
    throw err;
  }

  const payload = await response.json();
  const results = Array.isArray(payload?.results) ? payload.results : [];
  const totalPages = Number.isFinite(payload?.total_pages) ? payload.total_pages : 1;

  return { results, totalPages };
}

async function fetchTopPopularPersonIds(apiKey, limit) {
  const targetPages = Math.max(1, Math.ceil(limit / TMDB_PAGE_SIZE));
  const collected = [];
  const seen = new Set();
  let page = 1;
  let maxPages = targetPages;

  while (page <= maxPages && collected.length < limit) {
    const { results, totalPages } = await fetchPopularPeoplePage(apiKey, page);
    maxPages = Math.min(Math.max(targetPages, 1), Math.max(totalPages, 1));

    for (const person of results) {
      const tmdbId = person?.id;
      if (!Number.isFinite(tmdbId) || seen.has(tmdbId)) continue;
      seen.add(tmdbId);
      collected.push(tmdbId);
      if (collected.length >= limit) break;
    }

    page += 1;
  }

  return collected;
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

function parseArgs(argv) {
  let limit = 20;

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
  }

  if (limit > MAX_LIMIT) {
    throw new Error(
      `Requested --limit=${limit} is too high. Max allowed value is ${MAX_LIMIT}.`
    );
  }

  return { limit };
}

export async function ingestPopularPeopleToday({ limit = 20, apiKey } = {}) {
  const resolvedKey = apiKey ?? getApiKey();
  const requestedIds = await fetchTopPopularPersonIds(resolvedKey, limit);
  const existingIds = await fetchExistingPersonTmdbIds(requestedIds);

  let inserted = 0;
  let skippedExisting = 0;
  let skippedRace = 0;

  for (let i = 0; i < requestedIds.length; i += 1) {
    const tmdbId = requestedIds[i];
    const prefix = `[${i + 1}/${requestedIds.length}]`;

    if (existingIds.has(tmdbId)) {
      console.log(`${prefix} Person ${tmdbId} already exists -> skipped`);
      skippedExisting += 1;
      continue;
    }

    // Defensive second check: if another process inserted in the meantime, skip.
    const raceCheck = await fetchExistingPersonTmdbIds([tmdbId]);
    if (raceCheck.has(tmdbId)) {
      console.log(`${prefix} Person ${tmdbId} exists now -> skipped`);
      skippedRace += 1;
      continue;
    }

    const result = await ingestPerson({ tmdbId, apiKey: resolvedKey });
    if (result.action !== "inserted") {
      // Keep behavior strict for this loader: treat non-insert as skipped.
      console.log(`${prefix} Person ${tmdbId} already synced elsewhere -> skipped`);
      skippedRace += 1;
      continue;
    }

    inserted += 1;
    console.log(`${prefix} Person ${tmdbId} inserted (id=${result.personId})`);
  }

  return {
    requested: requestedIds.length,
    skippedExisting,
    skippedRace,
    inserted,
  };
}

async function main() {
  const startedAt = new Date();
  const { limit } = parseArgs(process.argv.slice(2));
  const scopedScriptName = `${SCRIPT_NAME}:limit=${limit}`;

  try {
    try {
      await sequelize.authenticate();
      await ensureTables();

      const result = await ingestPopularPeopleToday({ limit });

      console.log(
        `Popular people ingestion complete. Requested: ${result.requested}. ` +
          `Skipped existing: ${result.skippedExisting}. ` +
          `Skipped race: ${result.skippedRace}. ` +
          `Inserted: ${result.inserted}.`
      );

      await writeScriptLog({
        scriptName: scopedScriptName,
        status: "success",
        batchSize: result.inserted,
        startedAt,
      });
    } catch (error) {
      await writeScriptLog({
        scriptName: scopedScriptName,
        status: "failure",
        batchSize: null,
        errorCode: error?.name ?? "Error",
        errorDetail: error?.message ?? String(error),
        startedAt,
      });
      throw error;
    }
  } finally {
    await sequelize.close();
  }
}

const isDirectRun = import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error("Failed to ingest popular TMDB people:", error.message);
    process.exit(1);
  });
}
