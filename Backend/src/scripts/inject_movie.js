import dotenv from "dotenv";
import { pathToFileURL } from "url";
import sequelize from "../db/database.js";
import { tmdbRateLimitedFetch } from "./tmdb_rate_limited_fetch.js";
import { ingestPerson, batchIngestPersons, fetchTmdbPerson } from "./inject_person.js";
import { resolveOrCreateJobId } from "./resolve_job.js";
import {
  str,
  strOrNull,
  clampedNum,
  clampedInt,
  strictBool,
  isoDate,
  isoLang,
} from "../lib/sanitizeTmdb.js";

dotenv.config();

const TMDB_MOVIE_URL = "https://api.themoviedb.org/3/movie";
const SCRIPT_NAME = "inject_movie";
const CAST_JOB_NAME = "Actor";
const CAST_DEPARTMENT_NAME = "Acting";

let cachedApiKey = null;
const existingMovieIdCache = new Map();

export const FULL_MOVIE_REFRESH_SCOPE = Object.freeze({
  details: true,
  genres: true,
  credits: true,
});

// Turns a given scope object into one with clear true/false flags.
export function normalizeMovieRefreshScope(scope) {
  if (!scope) return { ...FULL_MOVIE_REFRESH_SCOPE };
  return {
    details: Boolean(scope.details),
    genres: Boolean(scope.genres),
    credits: Boolean(scope.credits),
  };
}

// Returns true only if all scope flags are false, meaning no refresh action is needed.
function isAllFalseScope(scope) {
  if (!scope) return false;
  for (const v of Object.values(scope)) if (v) return false;
  return true;
}

// Returns an empty result object for skipped or unused movie ingests.
function buildEmptyMovieResult(movieId, action, scope) {
  return {
    movieId,
    action,
    scope: scope ? { ...scope } : { ...FULL_MOVIE_REFRESH_SCOPE },
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

// Writes run result, batch size, and runtime to the script_logs table.
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

// Returns the TMDB API key, caching it after the first read.
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

// Verifies all required movie tables exist in the DB before ingesting.
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

// Fetches movie details from TMDB by id.
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

// Fetches cast and crew credits for a movie from TMDB.
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

// Looks up the local movie id by TMDB id, using an in-process cache.
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

// Sanitizes raw TMDB movie payload into validated, DB-safe field values.
function normalizeMoviePayload(payload) {
  const tmdbId = payload.id;
  if (typeof tmdbId !== "number") {
    throw new Error("TMDB movie payload is missing numeric `id`.");
  }

  const rawTitle = typeof payload.title === "string" ? payload.title.trim() : "";
  if (!rawTitle) {
    throw new Error(`TMDB movie ${tmdbId} is missing required \`title\`.`);
  }
  const title = str(rawTitle, 500);

  const rawOriginalTitle =
    typeof payload.original_title === "string" && payload.original_title.trim()
      ? payload.original_title.trim()
      : rawTitle;

  return {
    tmdbId,
    adult: strictBool(payload.adult),
    budget: clampedInt(payload.budget, 0, 0, 9_999_999_999_999),
    originalLanguage: isoLang(payload.original_language) ?? "",
    originalTitle: str(rawOriginalTitle, 500),
    overview: str(payload.overview, 5000),
    tmdbPopularity: clampedNum(payload.popularity, 0, 0, 9_999_999),
    releaseDate: isoDate(payload.release_date),
    revenue: clampedInt(payload.revenue, 0, 0, 9_999_999_999_999),
    runtime: clampedInt(payload.runtime, 0, 0, 100_000),
    status: str(payload.status, 100),
    tagline: str(payload.tagline, 500),
    title,
    tmdbVoteAvg: clampedNum(payload.vote_average, 0, 0, 10),
    tmdbVoteCount: clampedInt(payload.vote_count, 0, 0, 99_999_999),
    genres: Array.isArray(payload.genres) ? payload.genres : [],
    posterPath: strOrNull(payload.poster_path, 500),
  };
}

// Inserts or updates a movie row; optionally allows conflict-based updates.
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
    posterPath: normalized.posterPath,
  };

  const [rows] = await sequelize.query(
    allowUpdateExisting
      ? `
      INSERT INTO movie (
        tmdb_id, adult, budget, original_language, original_title, overview,
        tmdb_popularity, release_date, revenue, runtime, status, tagline,
        title, tmdb_vote_avg, tmdb_vote_count, poster_path
      ) VALUES (
        :tmdbId, :adult, :budget, :originalLanguage, :originalTitle, :overview,
        :tmdbPopularity, :releaseDate, :revenue, :runtime, :status, :tagline,
        :title, :tmdbVoteAvg, :tmdbVoteCount, :posterPath
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
        poster_path = EXCLUDED.poster_path,
        updated_at = now()
      WHERE (
        movie.adult, movie.budget, movie.original_language, movie.original_title, movie.overview,
        movie.tmdb_popularity, movie.release_date, movie.revenue, movie.runtime, movie.status,
        movie.tagline, movie.title, movie.tmdb_vote_avg, movie.tmdb_vote_count, movie.poster_path
      ) IS DISTINCT FROM (
        EXCLUDED.adult, EXCLUDED.budget, EXCLUDED.original_language, EXCLUDED.original_title, EXCLUDED.overview,
        EXCLUDED.tmdb_popularity, EXCLUDED.release_date, EXCLUDED.revenue, EXCLUDED.runtime, EXCLUDED.status,
        EXCLUDED.tagline, EXCLUDED.title, EXCLUDED.tmdb_vote_avg, EXCLUDED.tmdb_vote_count, EXCLUDED.poster_path
      )
      RETURNING id, (xmax = 0) AS was_inserted;
    `
      : `
      INSERT INTO movie (
        tmdb_id, adult, budget, original_language, original_title, overview,
        tmdb_popularity, release_date, revenue, runtime, status, tagline,
        title, tmdb_vote_avg, tmdb_vote_count, poster_path
      ) VALUES (
        :tmdbId, :adult, :budget, :originalLanguage, :originalTitle, :overview,
        :tmdbPopularity, :releaseDate, :revenue, :runtime, :status, :tagline,
        :title, :tmdbVoteAvg, :tmdbVoteCount, :posterPath
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

// Atomically replaces all genre links for a movie (upsert kept, delete removed).
async function replaceMovieGenres(movieId, tmdbGenres, transaction) {
  const validGenres = tmdbGenres.filter((g) => typeof g?.id === "number");

  if (validGenres.length === 0) {
    await sequelize.query(
      `DELETE FROM movie_genre WHERE movie_id = :movieId;`,
      { replacements: { movieId }, transaction }
    );
    return { linked: 0, skipped: 0 };
  }

  const lookupRepl = {};
  validGenres.forEach((g, i) => { lookupRepl[`gid${i}`] = g.id; });
  const [genreRows] = await sequelize.query(
    `SELECT id, tmdb_id FROM genres WHERE tmdb_id IN (${validGenres.map((_, i) => `:gid${i}`).join(", ")});`,
    { replacements: lookupRepl, transaction }
  );
  const genreMap = new Map(
    genreRows.map((r) => [Number(r.tmdb_id), Number(r.id)])
  );

  let skipped = 0;
  const linkedIds = [];
  for (const g of validGenres) {
    const genresId = genreMap.get(Number(g.id));
    if (!genresId) {
      console.warn(
        `  Warning: genre tmdb_id=${g.id} (${g?.name ?? "?"}) not found in genres table — skipping. Run seed:tmdb:genres first.`
      );
      skipped += 1;
      continue;
    }
    linkedIds.push(genresId);
  }

  if (linkedIds.length === 0) {
    await sequelize.query(
      `DELETE FROM movie_genre WHERE movie_id = :movieId;`,
      { replacements: { movieId }, transaction }
    );
    return { linked: 0, skipped };
  }

  const upsertRepl = { movieId };
  const tuples = linkedIds.map((gId, i) => {
    upsertRepl[`mg${i}`] = gId;
    return `(:movieId, :mg${i})`;
  });
  await sequelize.query(
    `INSERT INTO movie_genre (movie_id, genres_id)
     VALUES ${tuples.join(", ")}
     ON CONFLICT (movie_id, genres_id) DO NOTHING;`,
    { replacements: upsertRepl, transaction }
  );

  const deleteRepl = { movieId };
  const keepPlaceholders = linkedIds.map((gId, i) => {
    deleteRepl[`keep${i}`] = gId;
    return `:keep${i}`;
  });
  await sequelize.query(
    `DELETE FROM movie_genre
     WHERE movie_id = :movieId
       AND genres_id NOT IN (${keepPlaceholders.join(", ")});`,
    { replacements: deleteRepl, transaction }
  );

  return { linked: linkedIds.length, skipped };
}

// Delegates job id resolution to the shared resolveOrCreateJobId helper.
async function resolveJobId(jobName, departmentName, jobCache, transaction) {
  return resolveOrCreateJobId(jobName, departmentName, jobCache, transaction);
}

// Deduplicates cast/crew entries and converts them into normalized task objects.
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

// Fetches TMDB person payloads in parallel and logs any failures.
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

// Inserts multiple movie_credits rows in a single parameterized query.
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

// Batch-ingests persons and links them as movie credits within a transaction.
async function processCreditsPhase({
  tasks,
  personPayloads,
  movieId,
  jobCache,
  transaction,
}) {
  const uniqueIds = [
    ...new Set(tasks.map((t) => t.personTmdbId).filter((id) => personPayloads.has(id))),
  ];
  const personIdMap = await batchIngestPersons(uniqueIds, personPayloads, transaction);

  let linked = 0;
  let skipped = tasks.length - uniqueIds.length;
  const personsIngested = personIdMap.size;
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

    const personId = personIdMap.get(task.personTmdbId);
    if (!personId) {
      skipped += 1;
      continue;
    }

    creditRows.push({ personId, jobId, title: task.title });
    linked += 1;
  }

  await bulkInsertMovieCredits(movieId, creditRows, transaction);

  return { linked, skipped, personsIngested };
}

// Ingests a movie and all linked entities (genres, credits, persons) from TMDB.
export async function ingestMovie({
  tmdbId,
  apiKey,
  onPrefetchProgress,
  forceRefreshExisting = false,
  refreshScope = null,
} = {}) {
  // Guardrails: require a concrete TMDB movie id.
  if (typeof tmdbId !== "number" || !Number.isFinite(tmdbId)) {
    throw new Error("ingestMovie requires a numeric `tmdbId`.");
  }

  // Skip fast when movie already exists and no refresh is requested.
  const existingMovieId = await findExistingMovieId(tmdbId);
  if (existingMovieId && !forceRefreshExisting) {
    return buildEmptyMovieResult(existingMovieId, "skipped_existing", null);
  }

  const isExistingEntity = Boolean(existingMovieId);
  const effectiveScope =
    isExistingEntity && refreshScope
      ? normalizeMovieRefreshScope(refreshScope)
      : { ...FULL_MOVIE_REFRESH_SCOPE };

  if (isExistingEntity && refreshScope && isAllFalseScope(effectiveScope)) {
    return buildEmptyMovieResult(
      existingMovieId,
      "unchanged_existing",
      effectiveScope
    );
  }

  const resolvedKey = apiKey ?? getApiKey();
  // Fetch movie payload (and credits when in scope) before opening transaction.
  const fetchPromises = [fetchTmdbMovie(resolvedKey, tmdbId)];
  if (effectiveScope.credits) {
    fetchPromises.push(fetchTmdbMovieCredits(resolvedKey, tmdbId));
  }
  const fetched = await Promise.all(fetchPromises);
  const moviePayload = fetched[0];
  const credits = effectiveScope.credits
    ? fetched[1]
    : { cast: [], crew: [] };
  const normalized = normalizeMoviePayload(moviePayload);

  const castTasks = effectiveScope.credits
    ? collectCreditTasks(credits.cast, [])
    : [];
  const crewTasks = effectiveScope.credits
    ? collectCreditTasks([], credits.crew)
    : [];

  const castIds = castTasks.map((t) => t.personTmdbId);
  const crewIds = crewTasks.map((t) => t.personTmdbId);

  // Prefetch person payloads in parallel to reduce transaction work.
  const [castPrefetch, crewPrefetch] = effectiveScope.credits
    ? await Promise.all([
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
      ])
    : [
        { payloads: new Map(), failures: [] },
        { payloads: new Map(), failures: [] },
      ];

  const jobCache = new Map();

  const tx = await sequelize.transaction();
  let movieId;
  let action;
  let genresLinked = 0;
  let genresSkipped = 0;
  let castLinked = 0;
  let castSkipped = 0;
  let castPersonsIngested = 0;
  let crewLinked = 0;
  let crewSkipped = 0;
  let crewPersonsIngested = 0;
  try {
    // Upsert details unless this is a scope-only refresh on existing entity.
    if (!isExistingEntity || effectiveScope.details) {
      const upsertResult = await upsertMovie(normalized, tx, {
        allowUpdateExisting: forceRefreshExisting,
      });
      movieId = upsertResult.movieId;
      action = upsertResult.action;
    } else {
      movieId = await findExistingMovieId(tmdbId, tx);
      if (!movieId) {
        throw new Error(
          `Cannot scope-update non-existent movie tmdb_id=${tmdbId}.`
        );
      }
      action = "scoped_existing";
    }

    if (action !== "skipped_existing") {
      // Refresh genre links only when genre scope is enabled.
      if (effectiveScope.genres) {
        const genresResult = await replaceMovieGenres(
          movieId,
          normalized.genres,
          tx
        );
        genresLinked = genresResult.linked;
        genresSkipped = genresResult.skipped;
      }

      if (effectiveScope.credits) {
        // Replace credits atomically so links never partially overlap.
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

        const castResult = await processCreditsPhase({
          tasks: castTasks,
          personPayloads: castPrefetch.payloads,
          movieId,
          jobCache,
          transaction: tx,
        });
        castLinked = castResult.linked;
        castSkipped = castResult.skipped + castPrefetch.failures.length;
        castPersonsIngested = castResult.personsIngested;

        const crewResult = await processCreditsPhase({
          tasks: crewTasks,
          personPayloads: crewPrefetch.payloads,
          movieId,
          jobCache,
          transaction: tx,
        });
        crewLinked = crewResult.linked;
        crewSkipped = crewResult.skipped + crewPrefetch.failures.length;
        crewPersonsIngested = crewResult.personsIngested;
      }
    }

    await tx.commit();
  } catch (error) {
    // Preserve original failure even if rollback itself errors.
    try {
      await tx.rollback();
    } catch (_rollbackError) {
      // swallow rollback error so the original error surfaces
    }
    throw error;
  }

  for (const f of [...castPrefetch.failures, ...crewPrefetch.failures]) {
    console.warn(
      `  Warning: failed to prefetch person tmdb_id=${f.tmdbId}: ${f.message}. Its credits were skipped.`
    );
  }

  // Return counters used by scripts/tests to summarize ingest outcome.
  return {
    movieId,
    action,
    scope: effectiveScope,
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

// Parses --id and --force CLI arguments for the movie ingest script.
function parseArgs(argv) {
  let tmdbId = null;
  let forceRefreshExisting = false;

  for (const arg of argv) {
    const match = /^--id=(.+)$/.exec(arg);
    if (match) {
      const parsed = Number.parseInt(match[1], 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(
          `Invalid --id value "${match[1]}". Expected a positive integer.`
        );
      }
      tmdbId = parsed;
      continue;
    }

    if (arg === "--force") {
      forceRefreshExisting = true;
    }
  }

  if (tmdbId == null) {
    throw new Error(
      "Missing required --id=<tmdbMovieId>. Example: npm run seed:tmdb:movie -- --id=550 [--force]"
    );
  }

  return { tmdbId, forceRefreshExisting };
}

// Renders an ASCII progress bar string for terminal output.
function renderProgressBar(current, total, width = 30) {
  const safeTotal = total > 0 ? total : 1;
  const ratio = Math.min(current / safeTotal, 1);
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  const percent = Math.round(ratio * 100);
  return `[${"#".repeat(filled)}${"-".repeat(empty)}] ${percent}%`;
}

// Entry point: validates args, runs the ingest pipeline, and exits with appropriate code.
async function main() {
  // Capture a stable start time so success/failure logs share one execution window.
  const startedAt = new Date();
  const { tmdbId, forceRefreshExisting } = parseArgs(process.argv.slice(2));
  const scopedScriptName = `${SCRIPT_NAME}:${tmdbId}`;

  try {
    try {
      // Ensure DB connectivity and required tables before doing any ingest work.
      await sequelize.authenticate();
      await ensureTables();

      // Show an initial one-item ingest progress indicator for this movie.
      process.stdout.write(
        `Ingest ${renderProgressBar(0, 1)} | Movie ${tmdbId}\r`
      );

      // Stream cast/crew prefetch progress from ingestMovie into a single-line UI.
      const onPrefetchProgress = (phase, done, total) => {
        const bar = renderProgressBar(done, total);
        const label = phase === "cast" ? "Cast" : "Crew";
        process.stdout.write(
          `\rPrefetch ${bar} | Movie ${tmdbId} | ${label} ${done}/${total}`
        );
      };

      // Ingest the movie and all linked entities, optionally forcing a refresh.
      const result = await ingestMovie({
        tmdbId,
        onPrefetchProgress,
        forceRefreshExisting,
      });

      // Aggregate counters for concise output and script-run logging.
      const totalCreditsLinked = result.castLinked + result.crewLinked;
      const totalCreditsSkipped = result.castSkipped + result.crewSkipped;
      const totalPersonsIngested =
        result.castPersonsIngested + result.crewPersonsIngested;

      // Replace progress line with a final per-category ingest summary.
      process.stdout.write(
        `\rIngest ${renderProgressBar(1, 1)} | Movie ${tmdbId} | ${result.action} | ` +
          `Genres ${result.genresLinked}/${result.genresLinked + result.genresSkipped} | ` +
          `Cast ${result.castLinked}/${result.castLinked + result.castSkipped} | ` +
          `Crew ${result.crewLinked}/${result.crewLinked + result.crewSkipped} | ` +
          `Persons +${totalPersonsIngested}\n`
      );

      // Emit a persistent completion message for logs/CI output.
      console.log(
        `TMDB movie sync complete. Movie ${tmdbId} -> id=${result.movieId} (${result.action}). ` +
          `Genres: linked ${result.genresLinked}, skipped ${result.genresSkipped}. ` +
          `Cast: linked ${result.castLinked}, skipped ${result.castSkipped}. ` +
          `Crew: linked ${result.crewLinked}, skipped ${result.crewSkipped}. ` +
          `Persons ingested: ${totalPersonsIngested}.`
      );

      // Record successful execution metadata in script logs.
      await writeScriptLog({
        scriptName: scopedScriptName,
        status: "success",
        batchSize: totalCreditsLinked,
        errorCode: null,
        errorDetail: null,
        startedAt,
      });
    } catch (error) {
      // Record failure details before rethrowing so caller exit path still runs.
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
    // Always release the DB connection pool, regardless of outcome.
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
