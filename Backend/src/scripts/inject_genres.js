import dotenv from "dotenv";
import sequelize from "../db/database.js";
import { tmdbRateLimitedFetch } from "./tmdb_rate_limited_fetch.js";
import { str } from "../lib/sanitizeTmdb.js";

dotenv.config();

const TMDB_MOVIE_GENRES_URL = "https://api.themoviedb.org/3/genre/movie/list";
const TMDB_TV_GENRES_URL = "https://api.themoviedb.org/3/genre/tv/list";
const SCRIPT_NAME = "inject_genres";

async function writeScriptLog({
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
          scriptName: SCRIPT_NAME,
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
  const apiKey = process.env.TMDB_API_KEY_SECRET;

  if (!apiKey) {
    throw new Error(
      "Missing TMDB_API_KEY_SECRET in environment. Add it to your .env file."
    );
  }

  return apiKey;
}

async function ensureTable() {
  const [genresTable] = await sequelize.query(`
    SELECT to_regclass('public.genres') AS table_name;
  `);

  if (!genresTable?.[0]?.table_name) {
    throw new Error("Required table missing: expected public.genres.");
  }
}

async function fetchTmdbGenres(apiKey, endpoint) {
  const url = new URL(endpoint);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("language", "en");

  const response = await tmdbRateLimitedFetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `TMDB request failed: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const payload = await response.json();
  if (!Array.isArray(payload?.genres)) {
    throw new Error(
      "Unexpected TMDB response: expected a `genres` array on the payload."
    );
  }
  return payload.genres;
}

function mergeAndDedupe(...genreLists) {
  const byTmdbId = new Map();
  for (const list of genreLists) {
    for (const genre of list) {
      const tmdbId = genre?.id;
      const rawName = typeof genre?.name === "string" ? genre.name.trim() : "";
      if (typeof tmdbId !== "number" || !rawName) continue;
      if (!byTmdbId.has(tmdbId)) {
        byTmdbId.set(tmdbId, { tmdbId, name: str(rawName, 200) });
      }
    }
  }
  return Array.from(byTmdbId.values());
}

// AIed {
function renderProgressBar(current, total, width = 30) {
  const safeTotal = total > 0 ? total : 1;
  const ratio = Math.min(current / safeTotal, 1);
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  const percent = Math.round(ratio * 100);
  return `[${"#".repeat(filled)}${"-".repeat(empty)}] ${percent}%`;
}

function logProgress(processed, total, inserted, updated) {
  const bar = renderProgressBar(processed, total);
  const line =
    `Ingest ${bar} | ` +
    `Genres ${processed}/${total} | ` +
    `New ${inserted} | Updated ${updated}`;
  process.stdout.write(`\r${line}`);
}
// AIed }

async function saveGenres(genres, transaction) {
  let inserted = 0;
  let updated = 0;
  let processed = 0;
  const total = genres.length;

  logProgress(processed, total, inserted, updated);

  for (const { tmdbId, name } of genres) {
    const [existingRows] = await sequelize.query(
      `
        SELECT id, name
        FROM genres
        WHERE tmdb_id = :tmdbId
        LIMIT 1;
      `,
      {
        replacements: { tmdbId },
        transaction,
      }
    );

    const existing = existingRows?.[0];

    if (!existing) {
      const [result] = await sequelize.query(
        `
          INSERT INTO genres (name, tmdb_id)
          VALUES (:name, :tmdbId)
          RETURNING id;
        `,
        {
          replacements: { name, tmdbId },
          transaction,
        }
      );

      if (Array.isArray(result) && result.length > 0) {
        inserted += 1;
      }
    } else if (existing.name !== name) {
      await sequelize.query(
        `
          UPDATE genres
          SET name = :name, updated_at = now()
          WHERE id = :id;
        `,
        {
          replacements: { name, id: existing.id },
          transaction,
        }
      );
      updated += 1;
    }

    processed += 1;
    logProgress(processed, total, inserted, updated);
  }

  process.stdout.write("\n");
  return { inserted, updated, total };
}

async function seedTmdbGenres() {
  const apiKey = getApiKey();
  const startedAt = new Date();

  try {
    try {
      await sequelize.authenticate();
      await ensureTable();

      const [movieGenres, tvGenres] = await Promise.all([
        fetchTmdbGenres(apiKey, TMDB_MOVIE_GENRES_URL),
        fetchTmdbGenres(apiKey, TMDB_TV_GENRES_URL),
      ]);

      const genres = mergeAndDedupe(movieGenres, tvGenres);
      const transaction = await sequelize.transaction();

      let saveResult;
      try {
        saveResult = await saveGenres(genres, transaction);
        await transaction.commit();
      } catch (error) {
        await transaction.rollback();
        throw error;
      }

      const { inserted, updated, total } = saveResult;

      console.log(
        `TMDB genres sync complete. New: ${inserted}, updated: ${updated}, total fetched (deduped): ${total}`
      );

      await writeScriptLog({
        status: "success",
        batchSize: total,
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

seedTmdbGenres().catch((error) => {
  console.error("Failed to sync TMDB genres:", error.message);
  process.exit(1);
});
