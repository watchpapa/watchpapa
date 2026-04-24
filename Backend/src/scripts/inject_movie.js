import dotenv from "dotenv";
import { pathToFileURL } from "url";
import sequelize from "../db/database.js";
import { tmdbRateLimitedFetch } from "./tmdb_rate_limited_fetch.js";
import { ingestPerson, fetchTmdbPerson } from "./inject_person.js";
import { resolveOrCreateJobId } from "./resolve_job.js";

dotenv.config();

const TMDB_MOVIE_URL = "https://api.themoviedb.org/3/movie";
const SCRIPT_NAME = "inject_movie";
const CAST_JOB_NAME = "Actor";
const CAST_DEPARTMENT_NAME = "Acting";

let cachedApiKey = null;
const existingMovieIdCache = new Map();

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
  const [movieTable] = await sequelize.query(`
    SELECT to_regclass('public.movie') AS table_name;
  `);
  const [movieGenreTable] = await sequelize.query(`
    SELECT to_regclass('public.movie_genre') AS table_name;
  `);
  const [genresTable] = await sequelize.query(`
    SELECT to_regclass('public.genres') AS table_name;
  `);
  const [movieCreditsTable] = await sequelize.query(`
    SELECT to_regclass('public.movie_credits') AS table_name;
  `);
  const [personTable] = await sequelize.query(`
    SELECT to_regclass('public.person') AS table_name;
  `);
  const [jobTable] = await sequelize.query(`
    SELECT to_regclass('public.job') AS table_name;
  `);

  if (
    !movieTable?.[0]?.table_name ||
    !movieGenreTable?.[0]?.table_name ||
    !genresTable?.[0]?.table_name ||
    !movieCreditsTable?.[0]?.table_name ||
    !personTable?.[0]?.table_name ||
    !jobTable?.[0]?.table_name
  ) {
    throw new Error(
      "Required tables missing: expected public.movie, public.movie_genre, public.genres, public.movie_credits, public.person, and public.job."
    );
  }
}

async function fetchTmdbMovie(apiKey, tmdbId) {
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

  const payload = await response.json();
  if (!payload || typeof payload.id !== "number") {
    throw new Error(
      `Unexpected TMDB response: missing numeric \`id\` for movie ${tmdbId}.`
    );
  }
  return payload;
}

async function fetchTmdbMovieCredits(apiKey, tmdbId) {
  const url = new URL(`${TMDB_MOVIE_URL}/${tmdbId}/credits`);
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

async function findExistingMovieId(tmdbId, transaction) {
  if (existingMovieIdCache.has(tmdbId)) {
    return existingMovieIdCache.get(tmdbId);
  }

  const [existing] = await sequelize.query(
    `
      SELECT id
      FROM movie
      WHERE tmdb_id = :tmdbId
      LIMIT 1;
    `,
    {
      replacements: { tmdbId },
      transaction,
    }
  );
  const movieId = existing?.[0]?.id ?? null;
  if (movieId) {
    existingMovieIdCache.set(tmdbId, movieId);
  }
  return movieId;
}

function normalizeMoviePayload(payload) {
  const tmdbId = payload.id;
  if (typeof tmdbId !== "number") {
    throw new Error("TMDB movie payload is missing numeric `id`.");
  }

  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  if (!title) {
    throw new Error(`TMDB movie ${tmdbId} is missing required \`title\`.`);
  }

  return {
    tmdbId,
    adult: Boolean(payload.adult),
    budget: Number.isFinite(payload.budget) ? payload.budget : 0,
    originalLanguage:
      typeof payload.original_language === "string"
        ? payload.original_language
        : "",
    originalTitle:
      typeof payload.original_title === "string"
        ? payload.original_title.trim()
        : title,
    overview:
      typeof payload.overview === "string" ? payload.overview : "",
    tmdbPopularity: Number.isFinite(payload.popularity) ? payload.popularity : 0,
    releaseDate: payload.release_date || null,
    revenue: Number.isFinite(payload.revenue) ? payload.revenue : 0,
    runtime: Number.isFinite(payload.runtime) ? payload.runtime : 0,
    status: typeof payload.status === "string" ? payload.status : "",
    tagline: typeof payload.tagline === "string" ? payload.tagline : "",
    title,
    tmdbVoteAvg: Number.isFinite(payload.vote_average) ? payload.vote_average : 0,
    tmdbVoteCount: Number.isFinite(payload.vote_count) ? payload.vote_count : 0,
    genres: Array.isArray(payload.genres) ? payload.genres : [],
  };
}

async function upsertMovie(
  normalized,
  transaction,
  { allowUpdateExisting = false } = {}
) {
  const replacements = {
    tmdbId: normalized.tmdbId,
    adult: normalized.adult,
    budget: normalized.budget,
    originalLanguage: normalized.originalLanguage,
    originalTitle: normalized.originalTitle,
    overview: normalized.overview,
    tmdbPopularity: normalized.tmdbPopularity,
    releaseDate: normalized.releaseDate,
    revenue: normalized.revenue,
    runtime: normalized.runtime,
    status: normalized.status,
    tagline: normalized.tagline,
    title: normalized.title,
    tmdbVoteAvg: normalized.tmdbVoteAvg,
    tmdbVoteCount: normalized.tmdbVoteCount,
  };

  const [rows] = await sequelize.query(
    allowUpdateExisting
      ? `
      INSERT INTO movie (
        tmdb_id, adult, budget, original_language, original_title, overview,
        tmdb_popularity, release_date, revenue, runtime, status, tagline,
        title, tmdb_vote_avg, tmdb_vote_count
      ) VALUES (
        :tmdbId, :adult, :budget, :originalLanguage, :originalTitle, :overview,
        :tmdbPopularity, :releaseDate, :revenue, :runtime, :status, :tagline,
        :title, :tmdbVoteAvg, :tmdbVoteCount
      )
      ON CONFLICT (tmdb_id) DO UPDATE SET
        adult = EXCLUDED.adult,
        budget = EXCLUDED.budget,
        original_language = EXCLUDED.original_language,
        original_title = EXCLUDED.original_title,
        overview = EXCLUDED.overview,
        tmdb_popularity = EXCLUDED.tmdb_popularity,
        release_date = EXCLUDED.release_date,
        revenue = EXCLUDED.revenue,
        runtime = EXCLUDED.runtime,
        status = EXCLUDED.status,
        tagline = EXCLUDED.tagline,
        title = EXCLUDED.title,
        tmdb_vote_avg = EXCLUDED.tmdb_vote_avg,
        tmdb_vote_count = EXCLUDED.tmdb_vote_count,
        updated_at = now()
      WHERE (
        movie.adult, movie.budget, movie.original_language, movie.original_title, movie.overview,
        movie.tmdb_popularity, movie.release_date, movie.revenue, movie.runtime, movie.status,
        movie.tagline, movie.title, movie.tmdb_vote_avg, movie.tmdb_vote_count
      ) IS DISTINCT FROM (
        EXCLUDED.adult, EXCLUDED.budget, EXCLUDED.original_language, EXCLUDED.original_title, EXCLUDED.overview,
        EXCLUDED.tmdb_popularity, EXCLUDED.release_date, EXCLUDED.revenue, EXCLUDED.runtime, EXCLUDED.status,
        EXCLUDED.tagline, EXCLUDED.title, EXCLUDED.tmdb_vote_avg, EXCLUDED.tmdb_vote_count
      )
      RETURNING id, (xmax = 0) AS was_inserted;
    `
      : `
      INSERT INTO movie (
        tmdb_id, adult, budget, original_language, original_title, overview,
        tmdb_popularity, release_date, revenue, runtime, status, tagline,
        title, tmdb_vote_avg, tmdb_vote_count
      ) VALUES (
        :tmdbId, :adult, :budget, :originalLanguage, :originalTitle, :overview,
        :tmdbPopularity, :releaseDate, :revenue, :runtime, :status, :tagline,
        :title, :tmdbVoteAvg, :tmdbVoteCount
      )
      ON CONFLICT (tmdb_id) DO NOTHING
      RETURNING id;
    `,
    { replacements, transaction }
  );

  const returned = rows?.[0];
  if (returned) {
    existingMovieIdCache.set(normalized.tmdbId, returned.id);
    return {
      movieId: returned.id,
      action:
        allowUpdateExisting && returned.was_inserted === false
          ? "updated_existing"
          : "inserted",
    };
  }

  const movieId = await findExistingMovieId(normalized.tmdbId, transaction);
  if (!movieId) {
    throw new Error(
      `Failed to resolve movie id for tmdb_id=${normalized.tmdbId} after insert.`
    );
  }

  existingMovieIdCache.set(normalized.tmdbId, movieId);
  return {
    movieId,
    action: allowUpdateExisting ? "unchanged_existing" : "skipped_existing",
  };
}

async function replaceMovieGenres(movieId, tmdbGenres, transaction) {
  await sequelize.query(
    `
      DELETE FROM movie_genre
      WHERE movie_id = :movieId;
    `,
    {
      replacements: { movieId },
      transaction,
    }
  );

  let linked = 0;
  let skipped = 0;

  for (const tmdbGenre of tmdbGenres) {
    const tmdbGenreId = tmdbGenre?.id;
    if (typeof tmdbGenreId !== "number") continue;

    const [genreRows] = await sequelize.query(
      `
        SELECT id
        FROM genres
        WHERE tmdb_id = :tmdbGenreId
        LIMIT 1;
      `,
      {
        replacements: { tmdbGenreId },
        transaction,
      }
    );

    const genresId = genreRows?.[0]?.id;
    if (!genresId) {
      console.warn(
        `  Warning: genre tmdb_id=${tmdbGenreId} (${tmdbGenre?.name ?? "?"}) not found in genres table — skipping. Run seed:tmdb:genres first.`
      );
      skipped += 1;
      continue;
    }

    await sequelize.query(
      `
        INSERT INTO movie_genre (movie_id, genres_id)
        VALUES (:movieId, :genresId);
      `,
      {
        replacements: { movieId, genresId },
        transaction,
      }
    );
    linked += 1;
  }

  return { linked, skipped };
}

async function resolveJobId(jobName, departmentName, jobCache, transaction) {
  return resolveOrCreateJobId(jobName, departmentName, jobCache, transaction);
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

async function bulkInsertMovieCredits(movieId, rows, transaction) {
  if (rows.length === 0) return;

  const replacements = { movieId };
  const tuples = rows.map((row, i) => {
    const pKey = `p${i}`;
    const jKey = `j${i}`;
    const tKey = `t${i}`;
    replacements[pKey] = row.personId;
    replacements[jKey] = row.jobId;
    replacements[tKey] = row.title;
    return `(:movieId, :${pKey}, :${jKey}, :${tKey})`;
  });

  await sequelize.query(
    `
      INSERT INTO movie_credits (movie_id, person_id, job_id, title)
      VALUES ${tuples.join(", ")};
    `,
    { replacements, transaction }
  );
}

async function processCreditsPhase({
  tasks,
  personPayloads,
  movieId,
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
        `  Warning: job "${task.jobName}" could not be resolved for department "${task.departmentName}" (ambiguous duplicate with no matching department) — skipping credit for ${task.personName}.`
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

  await bulkInsertMovieCredits(movieId, creditRows, transaction);

  return { linked, skipped, personsIngested };
}

async function runDetailsTransaction({
  normalized,
  baseScriptName,
  forceRefreshExisting = false,
}) {
  const startedAt = new Date();
  const tx = await sequelize.transaction();
  try {
    const { movieId, action } = await upsertMovie(normalized, tx, {
      allowUpdateExisting: forceRefreshExisting,
    });
    if (action === "skipped_existing") {
      await tx.commit();

      await writeScriptLog({
        scriptName: `${baseScriptName}:details`,
        status: "success",
        batchSize: 0,
        startedAt,
      });

      return { movieId, action, genresLinked: 0, genresSkipped: 0 };
    }

    const { linked: genresLinked, skipped: genresSkipped } = await replaceMovieGenres(
      movieId,
      normalized.genres,
      tx
    );
    await tx.commit();

    await writeScriptLog({
      scriptName: `${baseScriptName}:details`,
      status: "success",
      batchSize: 1,
      startedAt,
    });

    return { movieId, action, genresLinked, genresSkipped };
  } catch (error) {
    try {
      await tx.rollback();
    } catch (_rollbackError) {
      // swallow rollback error so the original error surfaces
    }
    await writeScriptLog({
      scriptName: `${baseScriptName}:details`,
      status: "failure",
      errorCode: error?.name ?? "Error",
      errorDetail: error?.message ?? String(error),
      startedAt,
    });
    throw error;
  }
}

async function runCreditsPhaseTransaction({
  baseScriptName,
  phaseName,
  movieId,
  tasks,
  personPayloads,
  jobCache,
  deleteExisting,
}) {
  const startedAt = new Date();
  const scriptName = `${baseScriptName}:${phaseName}`;
  const tx = await sequelize.transaction();
  try {
    if (deleteExisting) {
      await sequelize.query(
        `
          DELETE FROM movie_credits
          WHERE movie_id = :movieId;
        `,
        {
          replacements: { movieId },
          transaction: tx,
        }
      );
    }

    const { linked, skipped, personsIngested } = await processCreditsPhase({
      tasks,
      personPayloads,
      movieId,
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

export async function ingestMovie({
  tmdbId,
  apiKey,
  onPrefetchProgress,
  forceRefreshExisting = false,
} = {}) {
  if (typeof tmdbId !== "number" || !Number.isFinite(tmdbId)) {
    throw new Error("ingestMovie requires a numeric `tmdbId`.");
  }

  const existingMovieId = await findExistingMovieId(tmdbId);
  if (existingMovieId && !forceRefreshExisting) {
    return {
      movieId: existingMovieId,
      action: "skipped_existing",
      genresLinked: 0,
      genresSkipped: 0,
      castLinked: 0,
      castSkipped: 0,
      castPersonsIngested: 0,
      crewLinked: 0,
      crewSkipped: 0,
      crewPersonsIngested: 0,
    };
  }

  const resolvedKey = apiKey ?? getApiKey();
  const baseScriptName = `${SCRIPT_NAME}:${tmdbId}`;
  const [moviePayload, credits] = await Promise.all([
    fetchTmdbMovie(resolvedKey, tmdbId),
    fetchTmdbMovieCredits(resolvedKey, tmdbId),
  ]);
  const normalized = normalizeMoviePayload(moviePayload);

  const castTasks = collectCreditTasks(credits.cast, []);
  const crewTasks = collectCreditTasks([], credits.crew);

  const castIds = castTasks.map((t) => t.personTmdbId);
  const crewIds = crewTasks.map((t) => t.personTmdbId);

  const [castPrefetch, crewPrefetch] = await Promise.all([
    prefetchPersonPayloads(
      castIds,
      resolvedKey,
      onPrefetchProgress
        ? (done, total) => onPrefetchProgress("cast", done, total)
        : undefined
    ),
    prefetchPersonPayloads(
      crewIds,
      resolvedKey,
      onPrefetchProgress
        ? (done, total) => onPrefetchProgress("crew", done, total)
        : undefined
    ),
  ]);

  const jobCache = new Map();

  const detailsResult = await runDetailsTransaction({
    normalized,
    baseScriptName,
    forceRefreshExisting,
  });
  const { movieId, action, genresLinked, genresSkipped } = detailsResult;
  if (action === "skipped_existing") {
    return {
      movieId,
      action,
      genresLinked: 0,
      genresSkipped: 0,
      castLinked: 0,
      castSkipped: 0,
      castPersonsIngested: 0,
      crewLinked: 0,
      crewSkipped: 0,
      crewPersonsIngested: 0,
    };
  }

  const castResult = await runCreditsPhaseTransaction({
    baseScriptName,
    phaseName: "cast",
    movieId,
    tasks: castTasks,
    personPayloads: castPrefetch.payloads,
    jobCache,
    deleteExisting: true,
  });
  const castLinked = castResult.linked;
  const castSkipped = castResult.skipped + castPrefetch.failures.length;
  const castPersonsIngested = castResult.personsIngested;

  const crewResult = await runCreditsPhaseTransaction({
    baseScriptName,
    phaseName: "crew",
    movieId,
    tasks: crewTasks,
    personPayloads: crewPrefetch.payloads,
    jobCache,
    deleteExisting: false,
  });
  const crewLinked = crewResult.linked;
  const crewSkipped = crewResult.skipped + crewPrefetch.failures.length;
  const crewPersonsIngested = crewResult.personsIngested;

  for (const f of [...castPrefetch.failures, ...crewPrefetch.failures]) {
    console.warn(
      `  Warning: failed to prefetch person tmdb_id=${f.tmdbId}: ${f.message}. Its credits were skipped.`
    );
  }

  return {
    movieId,
    action,
    genresLinked,
    genresSkipped,
    castLinked,
    castSkipped,
    castPersonsIngested,
    crewLinked,
    crewSkipped,
    crewPersonsIngested,
  };
}

export default ingestMovie;

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
      return { tmdbId: parsed };
    }
  }
  throw new Error(
    "Missing required --id=<tmdbMovieId>. Example: npm run seed:tmdb:movie -- --id=550"
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
  const { tmdbId } = parseArgs(process.argv.slice(2));
  const scopedScriptName = `${SCRIPT_NAME}:${tmdbId}`;

  try {
    try {
      await sequelize.authenticate();
      await ensureTables();

      process.stdout.write(
        `Ingest ${renderProgressBar(0, 1)} | Movie ${tmdbId}\r`
      );

      const onPrefetchProgress = (phase, done, total) => {
        const bar = renderProgressBar(done, total);
        const label = phase === "cast" ? "Cast" : "Crew";
        process.stdout.write(
          `\rPrefetch ${bar} | Movie ${tmdbId} | ${label} ${done}/${total}`
        );
      };

      const result = await ingestMovie({ tmdbId, onPrefetchProgress });

      const totalCreditsLinked = result.castLinked + result.crewLinked;
      const totalCreditsSkipped = result.castSkipped + result.crewSkipped;
      const totalPersonsIngested =
        result.castPersonsIngested + result.crewPersonsIngested;

      process.stdout.write(
        `\rIngest ${renderProgressBar(1, 1)} | Movie ${tmdbId} | ${result.action} | ` +
          `Genres ${result.genresLinked}/${result.genresLinked + result.genresSkipped} | ` +
          `Cast ${result.castLinked}/${result.castLinked + result.castSkipped} | ` +
          `Crew ${result.crewLinked}/${result.crewLinked + result.crewSkipped} | ` +
          `Persons +${totalPersonsIngested}\n`
      );

      console.log(
        `TMDB movie sync complete. Movie ${tmdbId} -> id=${result.movieId} (${result.action}). ` +
          `Genres: linked ${result.genresLinked}, skipped ${result.genresSkipped}. ` +
          `Cast: linked ${result.castLinked}, skipped ${result.castSkipped}. ` +
          `Crew: linked ${result.crewLinked}, skipped ${result.crewSkipped}. ` +
          `Persons ingested: ${totalPersonsIngested}.`
      );

      await writeScriptLog({
        scriptName: scopedScriptName,
        status: "success",
        batchSize: totalCreditsLinked,
        errorCode: null,
        errorDetail: null,
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
    console.error("Failed to ingest TMDB movie:", error.message);
    process.exit(1);
  });
}
