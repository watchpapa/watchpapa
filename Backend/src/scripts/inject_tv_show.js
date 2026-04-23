import dotenv from "dotenv";
import { pathToFileURL } from "url";
import sequelize from "../db/database.js";
import { tmdbRateLimitedFetch } from "./tmdb_rate_limited_fetch.js";
import { ingestPerson, fetchTmdbPerson } from "./inject_person.js";

dotenv.config();

const TMDB_TV_URL = "https://api.themoviedb.org/3/tv";
const SCRIPT_NAME = "inject_tv_show";
const CAST_JOB_NAME = "Actor";
const CAST_DEPARTMENT_NAME = "Acting";

let cachedApiKey = null;

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

async function ensureTables() {
  const [showTable] = await sequelize.query(`
    SELECT to_regclass('public.show') AS table_name;
  `);
  const [showCreditsTable] = await sequelize.query(`
    SELECT to_regclass('public.show_credits') AS table_name;
  `);
  const [personTable] = await sequelize.query(`
    SELECT to_regclass('public.person') AS table_name;
  `);
  const [jobTable] = await sequelize.query(`
    SELECT to_regclass('public.job') AS table_name;
  `);
  const [departmentTable] = await sequelize.query(`
    SELECT to_regclass('public.department') AS table_name;
  `);
  const [seasonTable] = await sequelize.query(`
    SELECT to_regclass('public.season') AS table_name;
  `);

  if (
    !showTable?.[0]?.table_name ||
    !showCreditsTable?.[0]?.table_name ||
    !personTable?.[0]?.table_name ||
    !jobTable?.[0]?.table_name ||
    !departmentTable?.[0]?.table_name ||
    !seasonTable?.[0]?.table_name
  ) {
    throw new Error(
      "Required tables missing: expected public.show, public.show_credits, public.person, public.job, public.department, and public.season."
    );
  }
}

async function fetchTmdbTvShow(apiKey, tmdbTvId) {
  const url = new URL(`${TMDB_TV_URL}/${tmdbTvId}`);
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
  if (!payload || typeof payload.id !== "number") {
    throw new Error(
      `Unexpected TMDB response: missing numeric \`id\` for tv show ${tmdbTvId}.`
    );
  }
  return payload;
}

async function fetchTmdbTvShowCredits(apiKey, tmdbTvId) {
  const url = new URL(`${TMDB_TV_URL}/${tmdbTvId}/credits`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("language", "en-US");

  const response = await tmdbRateLimitedFetch(url, {
    method: "GET",
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    const errorText = await response.text();
    const err = new Error(
      `TMDB credits request failed: ${response.status} ${response.statusText} - ${errorText}`
    );
    err.status = response.status;
    throw err;
  }

  const payload = await response.json();
  return {
    cast: Array.isArray(payload?.cast) ? payload.cast : [],
    crew: Array.isArray(payload?.crew) ? payload.crew : [],
  };
}

async function fetchTmdbSeason(apiKey, tmdbTvId, seasonNumber) {
  const url = new URL(`${TMDB_TV_URL}/${tmdbTvId}/season/${seasonNumber}`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("language", "en-US");

  const response = await tmdbRateLimitedFetch(url, {
    method: "GET",
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    const errorText = await response.text();
    const err = new Error(
      `TMDB season request failed: ${response.status} ${response.statusText} - ${errorText}`
    );
    err.status = response.status;
    throw err;
  }

  const payload = await response.json();
  if (!payload || typeof payload.id !== "number") {
    throw new Error(
      `Unexpected TMDB season response for tv=${tmdbTvId} season=${seasonNumber}: missing numeric \`id\`.`
    );
  }
  return payload;
}

function pickEpisodeRunTime(raw) {
  if (!Array.isArray(raw)) return null;
  const firstFinite = raw.find((v) => Number.isFinite(v) && v > 0);
  return Number.isFinite(firstFinite) ? firstFinite : null;
}

function normalizeShowPayload(payload) {
  const tmdbId = payload.id;
  if (typeof tmdbId !== "number") {
    throw new Error("TMDB tv payload is missing numeric `id`.");
  }

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  if (!name) {
    throw new Error(`TMDB tv show ${tmdbId} is missing required \`name\`.`);
  }

  return {
    tmdbId,
    adult: Boolean(payload.adult),
    episodeRunTime: pickEpisodeRunTime(payload.episode_run_time),
    firstAirDate: payload.first_air_date || null,
    inProduction: Boolean(payload.in_production),
    lastAirDate: payload.last_air_date || null,
    name,
    numberOfEpisodes: Number.isFinite(payload.number_of_episodes)
      ? payload.number_of_episodes
      : 0,
    numberOfSeasons: Number.isFinite(payload.number_of_seasons)
      ? payload.number_of_seasons
      : 0,
    originalLanguage:
      typeof payload.original_language === "string"
        ? payload.original_language
        : "",
    originalName:
      typeof payload.original_name === "string" && payload.original_name.trim()
        ? payload.original_name.trim()
        : name,
    overview: typeof payload.overview === "string" ? payload.overview : "",
    tmdbPopularity: Number.isFinite(payload.popularity) ? payload.popularity : 0,
    status: typeof payload.status === "string" ? payload.status : "",
    tagline: typeof payload.tagline === "string" ? payload.tagline : "",
    type: typeof payload.type === "string" ? payload.type : "",
    tmdbVoteAvg: Number.isFinite(payload.vote_average) ? payload.vote_average : 0,
    tmdbVoteCount: Number.isFinite(payload.vote_count) ? payload.vote_count : 0,
  };
}

function deriveRegularSeasonNumbers(seasons) {
  if (!Array.isArray(seasons)) {
    return { seasonNumbers: [], seasonsSkippedSpecial: 0 };
  }

  const seen = new Set();
  const regular = [];
  let seasonsSkippedSpecial = 0;

  for (const entry of seasons) {
    const seasonNumber = entry?.season_number;
    if (!Number.isFinite(seasonNumber)) continue;
    if (seasonNumber <= 0) {
      seasonsSkippedSpecial += 1;
      continue;
    }
    if (seen.has(seasonNumber)) continue;
    seen.add(seasonNumber);
    regular.push(seasonNumber);
  }

  regular.sort((a, b) => a - b);
  return { seasonNumbers: regular, seasonsSkippedSpecial };
}

function normalizeSeasonPayload(payload, showId) {
  const tmdbId = payload.id;
  if (typeof tmdbId !== "number") {
    throw new Error("TMDB season payload is missing numeric `id`.");
  }

  const seasonNumber = payload.season_number;
  if (!Number.isFinite(seasonNumber) || seasonNumber <= 0) {
    throw new Error(
      `TMDB season ${tmdbId} has invalid season_number=${seasonNumber}.`
    );
  }

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  if (!name) {
    throw new Error(`TMDB season ${tmdbId} is missing required \`name\`.`);
  }

  if (!payload.air_date) {
    throw new Error(`TMDB season ${tmdbId} is missing required \`air_date\`.`);
  }

  return {
    tmdbId,
    showId,
    name,
    seasonNumber,
    overview: typeof payload.overview === "string" ? payload.overview : "",
    airDate: payload.air_date,
  };
}

async function upsertShow(normalized, transaction) {
  const [rows] = await sequelize.query(
    `
      INSERT INTO show (
        tmdb_id, adult, episode_run_time, first_air_date, in_production, last_air_date,
        name, number_of_episodes, number_of_seasons, original_language, original_name,
        overview, tmdb_popularity, status, tagline, type, tmdb_vote_avg, tmdb_vote_count
      ) VALUES (
        :tmdbId, :adult, :episodeRunTime, :firstAirDate, :inProduction, :lastAirDate,
        :name, :numberOfEpisodes, :numberOfSeasons, :originalLanguage, :originalName,
        :overview, :tmdbPopularity, :status, :tagline, :type, :tmdbVoteAvg, :tmdbVoteCount
      )
      ON CONFLICT (tmdb_id) DO UPDATE SET
        adult = EXCLUDED.adult,
        episode_run_time = EXCLUDED.episode_run_time,
        first_air_date = EXCLUDED.first_air_date,
        in_production = EXCLUDED.in_production,
        last_air_date = EXCLUDED.last_air_date,
        name = EXCLUDED.name,
        number_of_episodes = EXCLUDED.number_of_episodes,
        number_of_seasons = EXCLUDED.number_of_seasons,
        original_language = EXCLUDED.original_language,
        original_name = EXCLUDED.original_name,
        overview = EXCLUDED.overview,
        tmdb_popularity = EXCLUDED.tmdb_popularity,
        status = EXCLUDED.status,
        tagline = EXCLUDED.tagline,
        type = EXCLUDED.type,
        tmdb_vote_avg = EXCLUDED.tmdb_vote_avg,
        tmdb_vote_count = EXCLUDED.tmdb_vote_count,
        updated_at = now()
      WHERE (
        show.adult, show.episode_run_time, show.first_air_date, show.in_production,
        show.last_air_date, show.name, show.number_of_episodes, show.number_of_seasons,
        show.original_language, show.original_name, show.overview, show.tmdb_popularity,
        show.status, show.tagline, show.type, show.tmdb_vote_avg, show.tmdb_vote_count
      ) IS DISTINCT FROM (
        EXCLUDED.adult, EXCLUDED.episode_run_time, EXCLUDED.first_air_date, EXCLUDED.in_production,
        EXCLUDED.last_air_date, EXCLUDED.name, EXCLUDED.number_of_episodes, EXCLUDED.number_of_seasons,
        EXCLUDED.original_language, EXCLUDED.original_name, EXCLUDED.overview, EXCLUDED.tmdb_popularity,
        EXCLUDED.status, EXCLUDED.tagline, EXCLUDED.type, EXCLUDED.tmdb_vote_avg, EXCLUDED.tmdb_vote_count
      )
      RETURNING id, (xmax = 0) AS was_inserted;
    `,
    {
      replacements: {
        tmdbId: normalized.tmdbId,
        adult: normalized.adult,
        episodeRunTime: normalized.episodeRunTime,
        firstAirDate: normalized.firstAirDate,
        inProduction: normalized.inProduction,
        lastAirDate: normalized.lastAirDate,
        name: normalized.name,
        numberOfEpisodes: normalized.numberOfEpisodes,
        numberOfSeasons: normalized.numberOfSeasons,
        originalLanguage: normalized.originalLanguage,
        originalName: normalized.originalName,
        overview: normalized.overview,
        tmdbPopularity: normalized.tmdbPopularity,
        status: normalized.status,
        tagline: normalized.tagline,
        type: normalized.type,
        tmdbVoteAvg: normalized.tmdbVoteAvg,
        tmdbVoteCount: normalized.tmdbVoteCount,
      },
      transaction,
    }
  );

  const returned = rows?.[0];
  if (returned) {
    return {
      showId: returned.id,
      action: returned.was_inserted ? "inserted" : "updated",
    };
  }

  const [existing] = await sequelize.query(
    `
      SELECT id
      FROM show
      WHERE tmdb_id = :tmdbId
      LIMIT 1;
    `,
    {
      replacements: { tmdbId: normalized.tmdbId },
      transaction,
    }
  );

  const showId = existing?.[0]?.id;
  if (!showId) {
    throw new Error(
      `Failed to resolve show id for tmdb_id=${normalized.tmdbId} after upsert.`
    );
  }

  return { showId, action: "unchanged" };
}

async function upsertSeason(normalized, transaction) {
  const [rows] = await sequelize.query(
    `
      INSERT INTO season (
        tmdb_id, show_id, name, season_number, overview, air_date
      ) VALUES (
        :tmdbId, :showId, :name, :seasonNumber, :overview, :airDate
      )
      ON CONFLICT (tmdb_id) DO UPDATE SET
        show_id = EXCLUDED.show_id,
        name = EXCLUDED.name,
        season_number = EXCLUDED.season_number,
        overview = EXCLUDED.overview,
        air_date = EXCLUDED.air_date,
        updated_at = now()
      WHERE (
        season.show_id, season.name, season.season_number, season.overview, season.air_date
      ) IS DISTINCT FROM (
        EXCLUDED.show_id, EXCLUDED.name, EXCLUDED.season_number, EXCLUDED.overview, EXCLUDED.air_date
      )
      RETURNING id, (xmax = 0) AS was_inserted;
    `,
    {
      replacements: {
        tmdbId: normalized.tmdbId,
        showId: normalized.showId,
        name: normalized.name,
        seasonNumber: normalized.seasonNumber,
        overview: normalized.overview,
        airDate: normalized.airDate,
      },
      transaction,
    }
  );

  const returned = rows?.[0];
  if (returned) {
    return {
      seasonId: returned.id,
      action: returned.was_inserted ? "inserted" : "updated",
    };
  }

  const [existing] = await sequelize.query(
    `
      SELECT id
      FROM season
      WHERE tmdb_id = :tmdbId
      LIMIT 1;
    `,
    {
      replacements: { tmdbId: normalized.tmdbId },
      transaction,
    }
  );

  const seasonId = existing?.[0]?.id;
  if (!seasonId) {
    throw new Error(
      `Failed to resolve season id for tmdb_id=${normalized.tmdbId} after upsert.`
    );
  }

  return { seasonId, action: "unchanged" };
}

async function resolveJobId(jobName, departmentName, jobCache, transaction) {
  const key = `${jobName}||${departmentName}`;
  if (jobCache.has(key)) {
    return jobCache.get(key);
  }

  const [rows] = await sequelize.query(
    `
      SELECT j.id
      FROM job j
      JOIN department d ON d.id = j.department_id
      WHERE j.name = :jobName AND d.name = :departmentName
      LIMIT 1;
    `,
    {
      replacements: { jobName, departmentName },
      transaction,
    }
  );

  const jobId = rows?.[0]?.id ?? null;
  jobCache.set(key, jobId);
  return jobId;
}

function collectCreditTasks(cast, crew) {
  const tasks = [];
  const seen = new Set();

  for (const entry of cast) {
    const personTmdbId = entry?.id;
    if (typeof personTmdbId !== "number") continue;
    const character =
      typeof entry.character === "string" && entry.character.trim() !== ""
        ? entry.character
        : null;
    const dedupKey = `cast|${personTmdbId}|${character ?? ""}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    tasks.push({
      kind: "cast",
      personTmdbId,
      personName: entry.name ?? `tmdb_id=${personTmdbId}`,
      jobName: CAST_JOB_NAME,
      departmentName: CAST_DEPARTMENT_NAME,
      title: character,
    });
  }

  for (const entry of crew) {
    const personTmdbId = entry?.id;
    if (typeof personTmdbId !== "number") continue;
    const jobName =
      typeof entry.job === "string" && entry.job.trim() !== "" ? entry.job : null;
    const departmentName =
      typeof entry.department === "string" && entry.department.trim() !== ""
        ? entry.department
        : null;
    if (!jobName || !departmentName) continue;
    const dedupKey = `crew|${personTmdbId}|${jobName}|${departmentName}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    tasks.push({
      kind: "crew",
      personTmdbId,
      personName: entry.name ?? `tmdb_id=${personTmdbId}`,
      jobName,
      departmentName,
      title: null,
    });
  }

  return tasks;
}

async function prefetchPersonPayloads(tmdbIds, apiKey, onProgress) {
  const uniqueIds = [...new Set(tmdbIds)];
  const total = uniqueIds.length;
  const payloads = new Map();
  const failures = [];
  let done = 0;

  if (typeof onProgress === "function") onProgress(0, total);

  await Promise.all(
    uniqueIds.map(async (tmdbId) => {
      try {
        const payload = await fetchTmdbPerson(apiKey, tmdbId);
        payloads.set(tmdbId, payload);
      } catch (error) {
        failures.push({ tmdbId, message: error?.message ?? String(error) });
      } finally {
        done += 1;
        if (typeof onProgress === "function") onProgress(done, total);
      }
    })
  );

  return { payloads, failures };
}

async function bulkInsertShowCredits(showId, rows, transaction) {
  if (rows.length === 0) return;

  const replacements = { showId };
  const tuples = rows.map((row, i) => {
    const pKey = `p${i}`;
    const jKey = `j${i}`;
    const tKey = `t${i}`;
    replacements[pKey] = row.personId;
    replacements[jKey] = row.jobId;
    replacements[tKey] = row.title;
    return `(:showId, :${pKey}, :${jKey}, :${tKey})`;
  });

  await sequelize.query(
    `
      INSERT INTO show_credits (show_id, person_id, job_id, title)
      VALUES ${tuples.join(", ")};
    `,
    { replacements, transaction }
  );
}

async function processCreditsPhase({
  tasks,
  personPayloads,
  showId,
  jobCache,
  transaction,
}) {
  let linked = 0;
  let skipped = 0;
  let personsIngested = 0;
  const personCache = new Map();
  const creditRows = [];

  for (const task of tasks) {
    const jobId = await resolveJobId(
      task.jobName,
      task.departmentName,
      jobCache,
      transaction
    );
    if (!jobId) {
      console.warn(
        `  Warning: job "${task.jobName}" in department "${task.departmentName}" not found — skipping credit for ${task.personName}. Run seed:tmdb:jobs first.`
      );
      skipped += 1;
      continue;
    }

    let personId = personCache.get(task.personTmdbId);
    if (!personId) {
      const preloadedPayload = personPayloads.get(task.personTmdbId);
      if (!preloadedPayload) {
        skipped += 1;
        continue;
      }
      try {
        const personResult = await ingestPerson({
          tmdbId: task.personTmdbId,
          transaction,
          preloadedPayload,
        });
        personId = personResult.personId;
        personCache.set(task.personTmdbId, personId);
        personsIngested += 1;
      } catch (error) {
        console.warn(
          `  Warning: failed to ingest person tmdb_id=${task.personTmdbId} (${task.personName}): ${error.message}. Skipping this credit.`
        );
        skipped += 1;
        continue;
      }
    }

    creditRows.push({ personId, jobId, title: task.title });
    linked += 1;
  }

  await bulkInsertShowCredits(showId, creditRows, transaction);

  return { linked, skipped, personsIngested };
}

async function runDetailsTransaction({ normalized }) {
  const startedAt = new Date();
  const tx = await sequelize.transaction();
  try {
    const { showId, action } = await upsertShow(normalized, tx);
    await tx.commit();

    await writeScriptLog({
      scriptName: `${SCRIPT_NAME}:details`,
      status: "success",
      batchSize: 1,
      startedAt,
    });

    return { showId, action };
  } catch (error) {
    try {
      await tx.rollback();
    } catch (_rollbackError) {
      // swallow rollback error so the original error surfaces
    }
    await writeScriptLog({
      scriptName: `${SCRIPT_NAME}:details`,
      status: "failure",
      errorCode: error?.name ?? "Error",
      errorDetail: error?.message ?? String(error),
      startedAt,
    });
    throw error;
  }
}

async function runCreditsTransaction({
  showId,
  tasks,
  personPayloads,
  jobCache,
}) {
  const startedAt = new Date();
  const scriptName = `${SCRIPT_NAME}:credits`;
  const tx = await sequelize.transaction();
  try {
    await sequelize.query(
      `
        DELETE FROM show_credits
        WHERE show_id = :showId;
      `,
      {
        replacements: { showId },
        transaction: tx,
      }
    );

    const { linked, skipped, personsIngested } = await processCreditsPhase({
      tasks,
      personPayloads,
      showId,
      jobCache,
      transaction: tx,
    });

    await tx.commit();

    await writeScriptLog({
      scriptName,
      status: "success",
      batchSize: linked,
      startedAt,
    });

    return { linked, skipped, personsIngested };
  } catch (error) {
    try {
      await tx.rollback();
    } catch (_rollbackError) {
      // swallow rollback error so the original error surfaces
    }
    await writeScriptLog({
      scriptName,
      status: "failure",
      errorCode: error?.name ?? "Error",
      errorDetail: error?.message ?? String(error),
      startedAt,
    });
    throw error;
  }
}

async function runSeasonsTransaction({
  showId,
  tmdbTvId,
  seasonNumbers,
  apiKey,
}) {
  const startedAt = new Date();
  const scriptName = `${SCRIPT_NAME}:seasons`;
  const tx = await sequelize.transaction();
  try {
    let seasonsProcessed = 0;
    let seasonsInserted = 0;
    let seasonsUpdated = 0;
    let seasonsUnchanged = 0;

    for (const seasonNumber of seasonNumbers) {
      const seasonPayload = await fetchTmdbSeason(apiKey, tmdbTvId, seasonNumber);
      const normalized = normalizeSeasonPayload(seasonPayload, showId);
      const result = await upsertSeason(normalized, tx);
      seasonsProcessed += 1;
      if (result.action === "inserted") seasonsInserted += 1;
      else if (result.action === "updated") seasonsUpdated += 1;
      else seasonsUnchanged += 1;
    }

    await tx.commit();

    await writeScriptLog({
      scriptName,
      status: "success",
      batchSize: seasonsProcessed,
      startedAt,
    });

    return {
      seasonsProcessed,
      seasonsInserted,
      seasonsUpdated,
      seasonsUnchanged,
    };
  } catch (error) {
    try {
      await tx.rollback();
    } catch (_rollbackError) {
      // swallow rollback error so the original error surfaces
    }
    await writeScriptLog({
      scriptName,
      status: "failure",
      errorCode: error?.name ?? "Error",
      errorDetail: error?.message ?? String(error),
      startedAt,
    });
    throw error;
  }
}

export async function ingestTvShow({
  tmdbTvId,
  apiKey,
  onPrefetchProgress,
} = {}) {
  if (typeof tmdbTvId !== "number" || !Number.isFinite(tmdbTvId)) {
    throw new Error("ingestTvShow requires a numeric `tmdbTvId`.");
  }

  const resolvedKey = apiKey ?? getApiKey();

  const [showPayload, credits] = await Promise.all([
    fetchTmdbTvShow(resolvedKey, tmdbTvId),
    fetchTmdbTvShowCredits(resolvedKey, tmdbTvId),
  ]);
  const normalized = normalizeShowPayload(showPayload);
  const { seasonNumbers, seasonsSkippedSpecial } = deriveRegularSeasonNumbers(
    showPayload.seasons
  );

  const creditTasks = collectCreditTasks(credits.cast, credits.crew);
  const creditIds = creditTasks.map((t) => t.personTmdbId);

  const prefetch = await prefetchPersonPayloads(
    creditIds,
    resolvedKey,
    onPrefetchProgress
      ? (done, total) => onPrefetchProgress(done, total)
      : undefined
  );

  const jobCache = new Map();

  const detailsResult = await runDetailsTransaction({ normalized });
  const { showId, action } = detailsResult;

  const creditsResult = await runCreditsTransaction({
    showId,
    tasks: creditTasks,
    personPayloads: prefetch.payloads,
    jobCache,
  });
  const creditsLinked = creditsResult.linked;
  const creditsSkipped = creditsResult.skipped + prefetch.failures.length;
  const personsIngested = creditsResult.personsIngested;

  const seasonsResult = await runSeasonsTransaction({
    showId,
    tmdbTvId,
    seasonNumbers,
    apiKey: resolvedKey,
  });

  for (const f of prefetch.failures) {
    console.warn(
      `  Warning: failed to prefetch person tmdb_id=${f.tmdbId}: ${f.message}. Its credits were skipped.`
    );
  }

  return {
    showId,
    action,
    creditsLinked,
    creditsSkipped,
    personsIngested,
    seasonsProcessed: seasonsResult.seasonsProcessed,
    seasonsInserted: seasonsResult.seasonsInserted,
    seasonsUpdated: seasonsResult.seasonsUpdated,
    seasonsUnchanged: seasonsResult.seasonsUnchanged,
    seasonsSkippedSpecial,
  };
}

export default ingestTvShow;

function parseArgs(argv) {
  for (const arg of argv) {
    const match = /^--id=(.+)$/.exec(arg);
    if (match) {
      const parsed = Number.parseInt(match[1], 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(
          `Invalid --id value "${match[1]}". Expected a positive integer.`
        );
      }
      return { tmdbTvId: parsed };
    }
  }
  throw new Error(
    "Missing required --id=<tmdbTvId>. Example: npm run seed:tmdb:tv-show -- --id=1399"
  );
}

function renderProgressBar(current, total, width = 30) {
  const safeTotal = total > 0 ? total : 1;
  const ratio = Math.min(current / safeTotal, 1);
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  const percent = Math.round(ratio * 100);
  return `[${"#".repeat(filled)}${"-".repeat(empty)}] ${percent}%`;
}

async function main() {
  const startedAt = new Date();
  const { tmdbTvId } = parseArgs(process.argv.slice(2));

  try {
    try {
      await sequelize.authenticate();
      await ensureTables();

      process.stdout.write(
        `Ingest ${renderProgressBar(0, 1)} | TV Show ${tmdbTvId}\r`
      );

      const onPrefetchProgress = (done, total) => {
        const bar = renderProgressBar(done, total);
        process.stdout.write(
          `\rPrefetch ${bar} | TV Show ${tmdbTvId} | Credits ${done}/${total}`
        );
      };

      const result = await ingestTvShow({ tmdbTvId, onPrefetchProgress });

      const totalCredits = result.creditsLinked + result.creditsSkipped;
      const totalRegularSeasons =
        result.seasonsProcessed + result.seasonsSkippedSpecial;

      process.stdout.write(
        `\rIngest ${renderProgressBar(1, 1)} | TV Show ${tmdbTvId} | ${result.action} | ` +
          `Credits ${result.creditsLinked}/${totalCredits} | ` +
          `Persons +${result.personsIngested} | ` +
          `Seasons ${result.seasonsProcessed}/${totalRegularSeasons} | ` +
          `Specials skipped ${result.seasonsSkippedSpecial}\n`
      );

      console.log(
        `TMDB tv show sync complete. TV ${tmdbTvId} -> id=${result.showId} (${result.action}). ` +
          `Credits: linked ${result.creditsLinked}, skipped ${result.creditsSkipped}. ` +
          `Persons ingested: ${result.personsIngested}. ` +
          `Seasons: processed ${result.seasonsProcessed}, inserted ${result.seasonsInserted}, ` +
          `updated ${result.seasonsUpdated}, unchanged ${result.seasonsUnchanged}, ` +
          `specials skipped ${result.seasonsSkippedSpecial}.`
      );

      await writeScriptLog({
        status: "success",
        batchSize: result.creditsLinked,
        errorCode: null,
        errorDetail: null,
        startedAt,
      });
    } catch (error) {
      await writeScriptLog({
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
    console.error("Failed to ingest TMDB tv show:", error.message);
    process.exit(1);
  });
}
