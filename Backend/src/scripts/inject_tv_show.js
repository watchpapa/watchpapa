import dotenv from "dotenv";
import { pathToFileURL } from "url";
import sequelize from "../db/database.js";
import { tmdbRateLimitedFetch } from "./tmdb_rate_limited_fetch.js";
import { ingestPerson, fetchTmdbPerson } from "./inject_person.js";
import { resolveOrCreateJobId } from "./resolve_job.js";

dotenv.config();

const TMDB_TV_URL = "https://api.themoviedb.org/3/tv";
const SCRIPT_NAME = "inject_tv_show";
const CAST_JOB_NAME = "Actor";
const CAST_DEPARTMENT_NAME = "Acting";

let cachedApiKey = null;
const existingShowIdCache = new Map();

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
  const [showGenreTable] = await sequelize.query(`
    SELECT to_regclass('public.show_genre') AS table_name;
  `);
  const [genresTable] = await sequelize.query(`
    SELECT to_regclass('public.genres') AS table_name;
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
  const [episodeTable] = await sequelize.query(`
    SELECT to_regclass('public.episode') AS table_name;
  `);
  const [episodeCreditsTable] = await sequelize.query(`
    SELECT to_regclass('public.episode_credits') AS table_name;
  `);

  if (
    !showTable?.[0]?.table_name ||
    !showCreditsTable?.[0]?.table_name ||
    !showGenreTable?.[0]?.table_name ||
    !genresTable?.[0]?.table_name ||
    !personTable?.[0]?.table_name ||
    !jobTable?.[0]?.table_name ||
    !departmentTable?.[0]?.table_name ||
    !seasonTable?.[0]?.table_name ||
    !episodeTable?.[0]?.table_name ||
    !episodeCreditsTable?.[0]?.table_name
  ) {
    throw new Error(
      "Required tables missing: expected public.show, public.show_credits, public.show_genre, public.genres, public.person, public.job, public.department, public.season, public.episode, and public.episode_credits."
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

async function fetchTmdbEpisode(apiKey, tmdbTvId, seasonNumber, episodeNumber) {
  const url = new URL(
    `${TMDB_TV_URL}/${tmdbTvId}/season/${seasonNumber}/episode/${episodeNumber}`
  );
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("language", "en-US");

  const response = await tmdbRateLimitedFetch(url, {
    method: "GET",
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    const errorText = await response.text();
    const err = new Error(
      `TMDB episode request failed: ${response.status} ${response.statusText} - ${errorText}`
    );
    err.status = response.status;
    throw err;
  }

  const payload = await response.json();
  if (!payload || typeof payload.id !== "number") {
    throw new Error(
      `Unexpected TMDB episode response for tv=${tmdbTvId} season=${seasonNumber} episode=${episodeNumber}: missing numeric \`id\`.`
    );
  }
  return payload;
}

async function fetchTmdbEpisodeCredits(
  apiKey,
  tmdbTvId,
  seasonNumber,
  episodeNumber
) {
  const url = new URL(
    `${TMDB_TV_URL}/${tmdbTvId}/season/${seasonNumber}/episode/${episodeNumber}/credits`
  );
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("language", "en-US");

  const response = await tmdbRateLimitedFetch(url, {
    method: "GET",
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    const errorText = await response.text();
    const err = new Error(
      `TMDB episode credits request failed: ${response.status} ${response.statusText} - ${errorText}`
    );
    err.status = response.status;
    throw err;
  }

  const payload = await response.json();
  return {
    cast: Array.isArray(payload?.cast) ? payload.cast : [],
    crew: Array.isArray(payload?.crew) ? payload.crew : [],
    guestStars: Array.isArray(payload?.guest_stars) ? payload.guest_stars : [],
  };
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
    genres: Array.isArray(payload.genres) ? payload.genres : [],
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

function deriveEpisodeNumbers(episodes) {
  if (!Array.isArray(episodes)) return [];

  const seen = new Set();
  const out = [];
  for (const ep of episodes) {
    const episodeNumber = ep?.episode_number;
    if (!Number.isFinite(episodeNumber) || episodeNumber <= 0) continue;
    if (seen.has(episodeNumber)) continue;
    seen.add(episodeNumber);
    out.push(episodeNumber);
  }

  out.sort((a, b) => a - b);
  return out;
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

  return {
    tmdbId,
    showId,
    name,
    seasonNumber,
    overview: typeof payload.overview === "string" ? payload.overview : "",
    airDate: payload.air_date || null,
  };
}

function normalizeEpisodePayload(payload, seasonId) {
  const tmdbId = payload.id;
  if (typeof tmdbId !== "number") {
    throw new Error("TMDB episode payload is missing numeric `id`.");
  }

  const episodeNumber = payload.episode_number;
  if (!Number.isFinite(episodeNumber) || episodeNumber <= 0) {
    throw new Error(
      `TMDB episode ${tmdbId} has invalid episode_number=${episodeNumber}.`
    );
  }

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  if (!name) {
    throw new Error(`TMDB episode ${tmdbId} is missing required \`name\`.`);
  }

  if (!payload.air_date) {
    throw new Error(`TMDB episode ${tmdbId} is missing required \`air_date\`.`);
  }

  return {
    tmdbId,
    seasonId,
    name,
    episodeNumber,
    overview: typeof payload.overview === "string" ? payload.overview : "",
    runtime: Number.isFinite(payload.runtime) ? payload.runtime : 0,
    airDate: payload.air_date,
  };
}

async function findExistingShowId(tmdbId, transaction) {
  if (existingShowIdCache.has(tmdbId)) {
    return existingShowIdCache.get(tmdbId);
  }

  const [existing] = await sequelize.query(
    `
      SELECT id
      FROM show
      WHERE tmdb_id = :tmdbId
      LIMIT 1;
    `,
    {
      replacements: { tmdbId },
      transaction,
    }
  );
  const showId = existing?.[0]?.id ?? null;
  if (showId) {
    existingShowIdCache.set(tmdbId, showId);
  }
  return showId;
}

async function upsertShow(
  normalized,
  transaction,
  { allowUpdateExisting = false } = {}
) {
  const replacements = {
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
  };

  const [rows] = await sequelize.query(
    allowUpdateExisting
      ? `
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
    `
      : `
      INSERT INTO show (
        tmdb_id, adult, episode_run_time, first_air_date, in_production, last_air_date,
        name, number_of_episodes, number_of_seasons, original_language, original_name,
        overview, tmdb_popularity, status, tagline, type, tmdb_vote_avg, tmdb_vote_count
      ) VALUES (
        :tmdbId, :adult, :episodeRunTime, :firstAirDate, :inProduction, :lastAirDate,
        :name, :numberOfEpisodes, :numberOfSeasons, :originalLanguage, :originalName,
        :overview, :tmdbPopularity, :status, :tagline, :type, :tmdbVoteAvg, :tmdbVoteCount
      )
      ON CONFLICT (tmdb_id) DO NOTHING
      RETURNING id;
    `,
    {
      replacements,
      transaction,
    }
  );

  const returned = rows?.[0];
  if (returned) {
    existingShowIdCache.set(normalized.tmdbId, returned.id);
    return {
      showId: returned.id,
      action:
        allowUpdateExisting && returned.was_inserted === false
          ? "updated_existing"
          : "inserted",
    };
  }

  const showId = await findExistingShowId(normalized.tmdbId, transaction);
  if (!showId) {
    throw new Error(
      `Failed to resolve show id for tmdb_id=${normalized.tmdbId} after insert.`
    );
  }

  existingShowIdCache.set(normalized.tmdbId, showId);
  return {
    showId,
    action: allowUpdateExisting ? "unchanged_existing" : "skipped_existing",
  };
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

async function replaceShowGenres(showId, tmdbGenres, transaction) {
  await sequelize.query(
    `
      DELETE FROM show_genre
      WHERE show_id = :showId;
    `,
    {
      replacements: { showId },
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
        INSERT INTO show_genre (show_id, genres_id)
        VALUES (:showId, :genresId);
      `,
      {
        replacements: { showId, genresId },
        transaction,
      }
    );
    linked += 1;
  }

  return { linked, skipped };
}

async function upsertEpisode(normalized, transaction) {
  const [rows] = await sequelize.query(
    `
      INSERT INTO episode (
        tmdb_id, season_id, name, episode_number, overview, runtime, air_date
      ) VALUES (
        :tmdbId, :seasonId, :name, :episodeNumber, :overview, :runtime, :airDate
      )
      ON CONFLICT (tmdb_id) DO UPDATE SET
        season_id = EXCLUDED.season_id,
        name = EXCLUDED.name,
        episode_number = EXCLUDED.episode_number,
        overview = EXCLUDED.overview,
        runtime = EXCLUDED.runtime,
        air_date = EXCLUDED.air_date,
        updated_at = now()
      WHERE (
        episode.season_id, episode.name, episode.episode_number, episode.overview,
        episode.runtime, episode.air_date
      ) IS DISTINCT FROM (
        EXCLUDED.season_id, EXCLUDED.name, EXCLUDED.episode_number, EXCLUDED.overview,
        EXCLUDED.runtime, EXCLUDED.air_date
      )
      RETURNING id, (xmax = 0) AS was_inserted;
    `,
    {
      replacements: {
        tmdbId: normalized.tmdbId,
        seasonId: normalized.seasonId,
        name: normalized.name,
        episodeNumber: normalized.episodeNumber,
        overview: normalized.overview,
        runtime: normalized.runtime,
        airDate: normalized.airDate,
      },
      transaction,
    }
  );

  const returned = rows?.[0];
  if (returned) {
    return {
      episodeId: returned.id,
      action: returned.was_inserted ? "inserted" : "updated",
    };
  }

  const [existing] = await sequelize.query(
    `
      SELECT id
      FROM episode
      WHERE tmdb_id = :tmdbId
      LIMIT 1;
    `,
    {
      replacements: { tmdbId: normalized.tmdbId },
      transaction,
    }
  );

  const episodeId = existing?.[0]?.id;
  if (!episodeId) {
    throw new Error(
      `Failed to resolve episode id for tmdb_id=${normalized.tmdbId} after upsert.`
    );
  }

  return { episodeId, action: "unchanged" };
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

function collectEpisodeCreditTasks(episodePayload, episodeCreditsPayload) {
  const detailCreditsCast = Array.isArray(episodePayload?.credits?.cast)
    ? episodePayload.credits.cast
    : [];
  const detailCreditsCrew = Array.isArray(episodePayload?.credits?.crew)
    ? episodePayload.credits.crew
    : [];
  const detailGuestStars = Array.isArray(episodePayload?.guest_stars)
    ? episodePayload.guest_stars
    : [];

  const apiCast = Array.isArray(episodeCreditsPayload?.cast)
    ? episodeCreditsPayload.cast
    : [];
  const apiCrew = Array.isArray(episodeCreditsPayload?.crew)
    ? episodeCreditsPayload.crew
    : [];
  const apiGuestStars = Array.isArray(episodeCreditsPayload?.guestStars)
    ? episodeCreditsPayload.guestStars
    : [];

  const mergedCast = [
    ...detailCreditsCast,
    ...apiCast,
    ...detailGuestStars,
    ...apiGuestStars,
  ];
  const mergedCrew = [...detailCreditsCrew, ...apiCrew];

  return collectCreditTasks(mergedCast, mergedCrew);
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

async function prefetchPersonPayloadsWithCache(
  tmdbIds,
  apiKey,
  payloadCache,
  onProgress
) {
  const uniqueIds = [...new Set(tmdbIds)];
  const idsToFetch = uniqueIds.filter((tmdbId) => !payloadCache.has(tmdbId));
  const prefetch = await prefetchPersonPayloads(idsToFetch, apiKey, onProgress);
  for (const [tmdbId, payload] of prefetch.payloads.entries()) {
    payloadCache.set(tmdbId, payload);
  }

  const payloads = new Map();
  for (const tmdbId of uniqueIds) {
    const payload = payloadCache.get(tmdbId);
    if (payload) payloads.set(tmdbId, payload);
  }

  return { payloads, failures: prefetch.failures };
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

async function bulkInsertEpisodeCredits(episodeId, rows, transaction) {
  if (rows.length === 0) return;

  const replacements = { episodeId };
  const tuples = rows.map((row, i) => {
    const pKey = `epP${i}`;
    const jKey = `epJ${i}`;
    const tKey = `epT${i}`;
    replacements[pKey] = row.personId;
    replacements[jKey] = row.jobId;
    replacements[tKey] = row.title;
    return `(:episodeId, :${pKey}, :${jKey}, :${tKey})`;
  });

  await sequelize.query(
    `
      INSERT INTO episode_credits (episode_id, person_id, job_id, title)
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

  await bulkInsertShowCredits(showId, creditRows, transaction);

  return { linked, skipped, personsIngested };
}

async function processEpisodeCreditsPhase({
  tasks,
  personPayloads,
  episodeId,
  jobCache,
  personIdCache,
  transaction,
}) {
  let linked = 0;
  let skipped = 0;
  let personsIngested = 0;
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
        `  Warning: job "${task.jobName}" could not be resolved for department "${task.departmentName}" (ambiguous duplicate with no matching department) — skipping episode credit for ${task.personName}.`
      );
      skipped += 1;
      continue;
    }

    let personId = personIdCache.get(task.personTmdbId);
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
        personIdCache.set(task.personTmdbId, personId);
        personsIngested += 1;
      } catch (error) {
        console.warn(
          `  Warning: failed to ingest person tmdb_id=${task.personTmdbId} (${task.personName}): ${error.message}. Skipping this episode credit.`
        );
        skipped += 1;
        continue;
      }
    }

    creditRows.push({ personId, jobId, title: task.title });
    linked += 1;
  }

  await bulkInsertEpisodeCredits(episodeId, creditRows, transaction);

  return { linked, skipped, personsIngested };
}

async function runDetailsTransaction({
  normalized,
  transaction,
  forceRefreshExisting = false,
}) {
  const { showId, action } = await upsertShow(normalized, transaction, {
    allowUpdateExisting: forceRefreshExisting,
  });
  if (action === "skipped_existing") {
    return { showId, action, genresLinked: 0, genresSkipped: 0 };
  }
  const { linked: genresLinked, skipped: genresSkipped } = await replaceShowGenres(
    showId,
    normalized.genres,
    transaction
  );
  return { showId, action, genresLinked, genresSkipped };
}

async function runCreditsTransaction({
  showId,
  tasks,
  personPayloads,
  jobCache,
  transaction,
}) {
  await sequelize.query(
    `
      DELETE FROM show_credits
      WHERE show_id = :showId;
    `,
    {
      replacements: { showId },
      transaction,
    }
  );
  return processCreditsPhase({
    tasks,
    personPayloads,
    showId,
    jobCache,
    transaction,
  });
}

async function runSeasonsTransaction({
  showId,
  tmdbTvId,
  seasonNumbers,
  apiKey,
  transaction,
}) {
  let seasonsProcessed = 0;
  let seasonsInserted = 0;
  let seasonsUpdated = 0;
  let seasonsUnchanged = 0;
  const seasonByNumber = new Map();

  for (const seasonNumber of seasonNumbers) {
    const seasonPayload = await fetchTmdbSeason(apiKey, tmdbTvId, seasonNumber);
    const normalized = normalizeSeasonPayload(seasonPayload, showId);
    const result = await upsertSeason(normalized, transaction);
    seasonByNumber.set(seasonNumber, {
      seasonId: result.seasonId,
      seasonPayload,
    });
    seasonsProcessed += 1;
    if (result.action === "inserted") seasonsInserted += 1;
    else if (result.action === "updated") seasonsUpdated += 1;
    else seasonsUnchanged += 1;
  }

  return {
    seasonsProcessed,
    seasonsInserted,
    seasonsUpdated,
    seasonsUnchanged,
    seasonByNumber,
  };
}

async function runEpisodesTransaction({
  tmdbTvId,
  seasonByNumber,
  apiKey,
  jobCache,
  onEpisodeProgress,
  transaction,
}) {
  let episodesProcessed = 0;
  let episodesInserted = 0;
  let episodesUpdated = 0;
  let episodesUnchanged = 0;
  let episodesFailed = 0;
  let episodeCreditsLinked = 0;
  let episodeCreditsSkipped = 0;
  let episodePersonsIngested = 0;
  const personPayloadCache = new Map();
  const personIdCache = new Map();
  const workItems = [];

  for (const [seasonNumber, seasonState] of seasonByNumber.entries()) {
    const seasonPayload = seasonState.seasonPayload;
    const seasonId = seasonState.seasonId;
    const episodeNumbers = deriveEpisodeNumbers(seasonPayload.episodes);
    for (const episodeNumber of episodeNumbers) {
      workItems.push({ seasonNumber, seasonId, episodeNumber });
    }
  }

  const totalEpisodes = workItems.length;
  if (typeof onEpisodeProgress === "function") {
    onEpisodeProgress({
      processed: 0,
      total: totalEpisodes,
      seasonNumber: null,
      episodeNumber: null,
      episodeCreditsLinked,
      episodeCreditsSkipped,
      episodesFailed,
    });
  }

  for (const item of workItems) {
    const { seasonNumber, seasonId, episodeNumber } = item;
    const [episodePayload, episodeCreditsPayload] = await Promise.all([
      fetchTmdbEpisode(apiKey, tmdbTvId, seasonNumber, episodeNumber),
      fetchTmdbEpisodeCredits(apiKey, tmdbTvId, seasonNumber, episodeNumber),
    ]);

    const normalizedEpisode = normalizeEpisodePayload(episodePayload, seasonId);
    const episodeResult = await upsertEpisode(normalizedEpisode, transaction);
    const episodeId = episodeResult.episodeId;
    if (episodeResult.action === "inserted") episodesInserted += 1;
    else if (episodeResult.action === "updated") episodesUpdated += 1;
    else episodesUnchanged += 1;

    const episodeCreditTasks = collectEpisodeCreditTasks(
      episodePayload,
      episodeCreditsPayload
    );

    await sequelize.query(
      `
        DELETE FROM episode_credits
        WHERE episode_id = :episodeId;
      `,
      {
        replacements: { episodeId },
        transaction,
      }
    );

    const prefetch = await prefetchPersonPayloadsWithCache(
      episodeCreditTasks.map((t) => t.personTmdbId),
      apiKey,
      personPayloadCache
    );

    const episodeCreditResult = await processEpisodeCreditsPhase({
      tasks: episodeCreditTasks,
      personPayloads: prefetch.payloads,
      episodeId,
      jobCache,
      personIdCache,
      transaction,
    });

    episodeCreditsLinked += episodeCreditResult.linked;
    episodeCreditsSkipped += episodeCreditResult.skipped + prefetch.failures.length;
    episodePersonsIngested += episodeCreditResult.personsIngested;

    for (const f of prefetch.failures) {
      console.warn(
        `  Warning: failed to prefetch person tmdb_id=${f.tmdbId}: ${f.message}. Its episode credits were skipped.`
      );
    }

    episodesProcessed += 1;
    if (typeof onEpisodeProgress === "function") {
      onEpisodeProgress({
        processed: episodesProcessed,
        total: totalEpisodes,
        seasonNumber,
        episodeNumber,
        episodeCreditsLinked,
        episodeCreditsSkipped,
        episodesFailed,
      });
    }
  }

  return {
    episodesProcessed,
    episodesInserted,
    episodesUpdated,
    episodesUnchanged,
    episodesFailed,
    episodeCreditsLinked,
    episodeCreditsSkipped,
    episodePersonsIngested,
  };
}

export async function ingestTvShow({
  tmdbTvId,
  apiKey,
  onPrefetchProgress,
  onEpisodeProgress,
  forceRefreshExisting = false,
} = {}) {
  if (typeof tmdbTvId !== "number" || !Number.isFinite(tmdbTvId)) {
    throw new Error("ingestTvShow requires a numeric `tmdbTvId`.");
  }

  const existingShowId = await findExistingShowId(tmdbTvId);
  if (existingShowId && !forceRefreshExisting) {
    return {
      showId: existingShowId,
      action: "skipped_existing",
      genresLinked: 0,
      genresSkipped: 0,
      creditsLinked: 0,
      creditsSkipped: 0,
      personsIngested: 0,
      seasonsProcessed: 0,
      seasonsInserted: 0,
      seasonsUpdated: 0,
      seasonsUnchanged: 0,
      seasonsSkippedSpecial: 0,
      episodesProcessed: 0,
      episodesInserted: 0,
      episodesUpdated: 0,
      episodesUnchanged: 0,
      episodesFailed: 0,
      episodeCreditsLinked: 0,
      episodeCreditsSkipped: 0,
      episodePersonsIngested: 0,
    };
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
  const tx = await sequelize.transaction();
  let showId;
  let action;
  let genresLinked = 0;
  let genresSkipped = 0;
  let creditsLinked = 0;
  let creditsSkipped = 0;
  let personsIngested = 0;
  let seasonsResult = {
    seasonsProcessed: 0,
    seasonsInserted: 0,
    seasonsUpdated: 0,
    seasonsUnchanged: 0,
  };
  let episodesResult = {
    episodesProcessed: 0,
    episodesInserted: 0,
    episodesUpdated: 0,
    episodesUnchanged: 0,
    episodesFailed: 0,
    episodeCreditsLinked: 0,
    episodeCreditsSkipped: 0,
    episodePersonsIngested: 0,
  };
  try {
    const detailsResult = await runDetailsTransaction({
      normalized,
      transaction: tx,
      forceRefreshExisting,
    });
    showId = detailsResult.showId;
    action = detailsResult.action;
    genresLinked = detailsResult.genresLinked;
    genresSkipped = detailsResult.genresSkipped;

    if (action !== "skipped_existing") {
      const creditsResult = await runCreditsTransaction({
        showId,
        tasks: creditTasks,
        personPayloads: prefetch.payloads,
        jobCache,
        transaction: tx,
      });
      creditsLinked = creditsResult.linked;
      creditsSkipped = creditsResult.skipped + prefetch.failures.length;
      personsIngested = creditsResult.personsIngested;

      seasonsResult = await runSeasonsTransaction({
        showId,
        tmdbTvId,
        seasonNumbers,
        apiKey: resolvedKey,
        transaction: tx,
      });
      episodesResult = await runEpisodesTransaction({
        tmdbTvId,
        seasonByNumber: seasonsResult.seasonByNumber,
        apiKey: resolvedKey,
        jobCache,
        onEpisodeProgress,
        transaction: tx,
      });
    }

    await tx.commit();
  } catch (error) {
    try {
      await tx.rollback();
    } catch (_rollbackError) {
      // swallow rollback error so the original error surfaces
    }
    throw error;
  }

  for (const f of prefetch.failures) {
    console.warn(
      `  Warning: failed to prefetch person tmdb_id=${f.tmdbId}: ${f.message}. Its credits were skipped.`
    );
  }

  return {
    showId,
    action,
    genresLinked,
    genresSkipped,
    creditsLinked,
    creditsSkipped,
    personsIngested,
    seasonsProcessed: seasonsResult.seasonsProcessed,
    seasonsInserted: seasonsResult.seasonsInserted,
    seasonsUpdated: seasonsResult.seasonsUpdated,
    seasonsUnchanged: seasonsResult.seasonsUnchanged,
    seasonsSkippedSpecial,
    episodesProcessed: episodesResult.episodesProcessed,
    episodesInserted: episodesResult.episodesInserted,
    episodesUpdated: episodesResult.episodesUpdated,
    episodesUnchanged: episodesResult.episodesUnchanged,
    episodesFailed: episodesResult.episodesFailed,
    episodeCreditsLinked: episodesResult.episodeCreditsLinked,
    episodeCreditsSkipped: episodesResult.episodeCreditsSkipped,
    episodePersonsIngested: episodesResult.episodePersonsIngested,
  };
}

export default ingestTvShow;

function parseArgs(argv) {
  let tmdbTvId = null;
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
      tmdbTvId = parsed;
      continue;
    }

    if (arg === "--force") {
      forceRefreshExisting = true;
    }
  }

  if (tmdbTvId == null) {
    throw new Error(
      "Missing required --id=<tmdbTvId>. Example: npm run seed:tmdb:tv-show -- --id=1399 [--force]"
    );
  }

  return { tmdbTvId, forceRefreshExisting };
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
  const { tmdbTvId, forceRefreshExisting } = parseArgs(process.argv.slice(2));
  const scopedScriptName = `${SCRIPT_NAME}:${tmdbTvId}`;

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

      const onEpisodeProgress = ({
        processed,
        total,
        seasonNumber,
        episodeNumber,
        episodesFailed,
      }) => {
        const bar = renderProgressBar(processed, total);
        const label =
          seasonNumber != null && episodeNumber != null
            ? `S${seasonNumber}E${episodeNumber}`
            : "-";
        process.stdout.write(
          `\rEpisodes ${bar} | TV Show ${tmdbTvId} | ${label} | ${processed}/${total} | Failed ${episodesFailed}`
        );
      };

      const result = await ingestTvShow({
        tmdbTvId,
        onPrefetchProgress,
        onEpisodeProgress,
        forceRefreshExisting,
      });

      const totalCredits = result.creditsLinked + result.creditsSkipped;
      const totalGenres = result.genresLinked + result.genresSkipped;
      const totalRegularSeasons =
        result.seasonsProcessed + result.seasonsSkippedSpecial;
      const totalEpisodeCredits =
        result.episodeCreditsLinked + result.episodeCreditsSkipped;

      process.stdout.write(
        `\rIngest ${renderProgressBar(1, 1)} | TV Show ${tmdbTvId} | ${result.action} | ` +
          `Genres ${result.genresLinked}/${totalGenres} | ` +
          `Credits ${result.creditsLinked}/${totalCredits} | ` +
          `Persons +${result.personsIngested} | ` +
          `Seasons ${result.seasonsProcessed}/${totalRegularSeasons} | ` +
          `Specials skipped ${result.seasonsSkippedSpecial} | ` +
          `Episodes ${result.episodesProcessed} | ` +
          `EpisodeFailed ${result.episodesFailed} | ` +
          `EpisodeCredits ${result.episodeCreditsLinked}/${totalEpisodeCredits} | ` +
          `EpisodePersons +${result.episodePersonsIngested}\n`
      );

      console.log(
        `TMDB tv show sync complete. TV ${tmdbTvId} -> id=${result.showId} (${result.action}). ` +
          `Genres: linked ${result.genresLinked}, skipped ${result.genresSkipped}. ` +
          `Credits: linked ${result.creditsLinked}, skipped ${result.creditsSkipped}. ` +
          `Persons ingested: ${result.personsIngested}. ` +
          `Seasons: processed ${result.seasonsProcessed}, inserted ${result.seasonsInserted}, ` +
          `updated ${result.seasonsUpdated}, unchanged ${result.seasonsUnchanged}, ` +
          `specials skipped ${result.seasonsSkippedSpecial}. ` +
          `Episodes: processed ${result.episodesProcessed}, inserted ${result.episodesInserted}, ` +
          `updated ${result.episodesUpdated}, unchanged ${result.episodesUnchanged}, failed ${result.episodesFailed}. ` +
          `Episode credits: linked ${result.episodeCreditsLinked}, skipped ${result.episodeCreditsSkipped}. ` +
          `Episode persons ingested: ${result.episodePersonsIngested}.`
      );

      await writeScriptLog({
        scriptName: scopedScriptName,
        status: "success",
        batchSize: result.creditsLinked,
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
    console.error("Failed to ingest TMDB tv show:", error.message);
    process.exit(1);
  });
}
