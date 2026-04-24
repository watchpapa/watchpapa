import dotenv from "dotenv";
import { pathToFileURL } from "url";
import sequelize from "../db/database.js";
import { tmdbRateLimitedFetch } from "./tmdb_rate_limited_fetch.js";

dotenv.config();

const TMDB_PERSON_URL = "https://api.themoviedb.org/3/person";
const SCRIPT_NAME = "inject_person";

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
  const [personTable] = await sequelize.query(`
    SELECT to_regclass('public.person') AS table_name;
  `);
  const [personAkaTable] = await sequelize.query(`
    SELECT to_regclass('public.person_aka') AS table_name;
  `);
  const [departmentTable] = await sequelize.query(`
    SELECT to_regclass('public.department') AS table_name;
  `);
  if (
    !personTable?.[0]?.table_name ||
    !personAkaTable?.[0]?.table_name ||
    !departmentTable?.[0]?.table_name
  ) {
    throw new Error(
      "Required tables missing: expected public.person, public.person_aka, and public.department."
    );
  }
}

export async function fetchTmdbPerson(apiKey, tmdbId) {
  const url = new URL(`${TMDB_PERSON_URL}/${tmdbId}`);
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
      `Unexpected TMDB response: missing numeric \`id\` for person ${tmdbId}.`
    );
  }
  return payload;
}

function normalizeNicknames(alsoKnownAs) {
  if (!Array.isArray(alsoKnownAs)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of alsoKnownAs) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function normalizePersonPayload(payload) {
  const tmdbId = payload.id;
  if (typeof tmdbId !== "number") {
    throw new Error("TMDB person payload is missing numeric `id`.");
  }

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  if (!name) {
    throw new Error(`TMDB person ${tmdbId} is missing required \`name\`.`);
  }

  const biography =
    typeof payload.biography === "string" ? payload.biography : null;

  const knownForDepartmentName =
    typeof payload.known_for_department === "string" &&
    payload.known_for_department.trim() !== ""
      ? payload.known_for_department
      : null;

  const profilePath =
    typeof payload.profile_path === "string" ? payload.profile_path : null;

  return {
    tmdbId,
    name,
    adult: Boolean(payload.adult),
    biography,
    birthday: payload.birthday || null,
    placeOfBirth:
      typeof payload.place_of_birth === "string"
        ? payload.place_of_birth
        : null,
    deathday: payload.deathday || null,
    gender: Number.isFinite(payload.gender) ? payload.gender : 0,
    popularity: Number.isFinite(payload.popularity) ? payload.popularity : 0,
    knownForDepartmentName,
    profilePath,
    alsoKnownAs: normalizeNicknames(payload.also_known_as),
  };
}

const departmentCache = new Map();
const existingPersonIdCache = new Map();

function normalizeDepartmentName(name) {
  if (name === "Actors") return "Acting";
  return name;
}

async function resolveDepartmentId(deptName, transaction) {
  const normalizedName = normalizeDepartmentName(deptName);
  if (!normalizedName) return null;
  if (departmentCache.has(normalizedName)) {
    return departmentCache.get(normalizedName);
  }

  const [rows] = await sequelize.query(
    `SELECT id FROM department WHERE name = :deptName LIMIT 1;`,
    { replacements: { deptName: normalizedName }, transaction }
  );
  const id = rows?.[0]?.id ?? null;
  departmentCache.set(normalizedName, id);
  return id;
}

async function findExistingPersonId(tmdbId, transaction) {
  if (existingPersonIdCache.has(tmdbId)) {
    return existingPersonIdCache.get(tmdbId);
  }

  const [existing] = await sequelize.query(
    `
      SELECT id
      FROM person
      WHERE tmdb_id = :tmdbId
      LIMIT 1;
    `,
    {
      replacements: { tmdbId },
      transaction,
    }
  );
  const personId = existing?.[0]?.id ?? null;
  if (personId) {
    existingPersonIdCache.set(tmdbId, personId);
  }
  return personId;
}

async function insertPerson(normalized, transaction) {
  const knownForDepartmentId = await resolveDepartmentId(
    normalized.knownForDepartmentName,
    transaction
  );
  const [rows] = await sequelize.query(
    `
      INSERT INTO person (
        tmdb_id, name, adult, biography, birthday, place_of_birth, deathday,
        gender, popularity, known_for_department_id, profile_path
      ) VALUES (
        :tmdbId, :name, :adult, :biography, :birthday, :placeOfBirth, :deathday,
        :gender, :popularity, :knownForDepartmentId, :profilePath
      )
      ON CONFLICT (tmdb_id) DO NOTHING
      RETURNING id;
    `,
    {
      replacements: {
        tmdbId: normalized.tmdbId,
        name: normalized.name,
        adult: normalized.adult,
        biography: normalized.biography,
        birthday: normalized.birthday,
        placeOfBirth: normalized.placeOfBirth,
        deathday: normalized.deathday,
        gender: normalized.gender,
        popularity: normalized.popularity,
        knownForDepartmentId,
        profilePath: normalized.profilePath,
      },
      transaction,
    }
  );

  const returned = rows?.[0];
  if (returned) {
    existingPersonIdCache.set(normalized.tmdbId, returned.id);
    return {
      personId: returned.id,
      inserted: true,
    };
  }

  const personId = await findExistingPersonId(normalized.tmdbId, transaction);
  if (!personId) {
    throw new Error(
      `Failed to resolve person id for tmdb_id=${normalized.tmdbId} after insert.`
    );
  }

  existingPersonIdCache.set(normalized.tmdbId, personId);
  return { personId, inserted: false };
}

async function syncPersonAka(personId, nicknames, transaction) {
  const [existingRows] = await sequelize.query(
    `
      SELECT id, nickname, deleted_at
      FROM person_aka
      WHERE person_id = :personId;
    `,
    {
      replacements: { personId },
      transaction,
    }
  );

  const byNickname = new Map();
  for (const row of existingRows ?? []) {
    const list = byNickname.get(row.nickname) ?? [];
    list.push(row);
    byNickname.set(row.nickname, list);
  }

  const incomingSet = new Set(nicknames);

  let akaInserted = 0;
  let akaRestored = 0;
  let akaDeleted = 0;

  for (const nickname of nicknames) {
    const matches = byNickname.get(nickname);

    if (!matches || matches.length === 0) {
      await sequelize.query(
        `
          INSERT INTO person_aka (person_id, nickname)
          VALUES (:personId, :nickname);
        `,
        {
          replacements: { personId, nickname },
          transaction,
        }
      );
      akaInserted += 1;
      continue;
    }

    const live = matches.find((row) => row.deleted_at === null);
    if (live) continue;

    const softDeleted = matches[0];
    await sequelize.query(
      `
        UPDATE person_aka
        SET deleted_at = NULL, updated_at = now()
        WHERE id = :id;
      `,
      {
        replacements: { id: softDeleted.id },
        transaction,
      }
    );
    akaRestored += 1;
  }

  for (const row of existingRows ?? []) {
    if (row.deleted_at !== null) continue;
    if (incomingSet.has(row.nickname)) continue;
    await sequelize.query(
      `
        UPDATE person_aka
        SET deleted_at = now(), updated_at = now()
        WHERE id = :id;
      `,
      {
        replacements: { id: row.id },
        transaction,
      }
    );
    akaDeleted += 1;
  }

  return { akaInserted, akaRestored, akaDeleted };
}

export async function ingestPerson({
  tmdbId,
  transaction,
  apiKey,
  preloadedPayload,
  forceRefreshExisting = false,
} = {}) {
  if (typeof tmdbId !== "number" || !Number.isFinite(tmdbId)) {
    throw new Error("ingestPerson requires a numeric `tmdbId`.");
  }

  const ownsTransaction = !transaction;
  const tx = transaction ?? (await sequelize.transaction());

  try {
    const existingPersonId = await findExistingPersonId(tmdbId, tx);
    if (existingPersonId && !forceRefreshExisting) {
      if (ownsTransaction) await tx.commit();
      return {
        personId: existingPersonId,
        action: "skipped_existing",
        akaInserted: 0,
        akaRestored: 0,
        akaDeleted: 0,
      };
    }

    let payload;
    if (preloadedPayload) {
      payload = preloadedPayload;
    } else {
      const resolvedKey = apiKey ?? getApiKey();
      payload = await fetchTmdbPerson(resolvedKey, tmdbId);
    }
    const normalized = normalizePersonPayload(payload);

    if (existingPersonId && forceRefreshExisting) {
      const knownForDepartmentId = await resolveDepartmentId(
        normalized.knownForDepartmentName,
        tx
      );
      await sequelize.query(
        `
          UPDATE person
          SET
            name = :name,
            adult = :adult,
            biography = :biography,
            birthday = :birthday,
            place_of_birth = :placeOfBirth,
            deathday = :deathday,
            gender = :gender,
            popularity = :popularity,
            known_for_department_id = :knownForDepartmentId,
            profile_path = :profilePath,
            updated_at = now()
          WHERE id = :personId;
        `,
        {
          replacements: {
            personId: existingPersonId,
            name: normalized.name,
            adult: normalized.adult,
            biography: normalized.biography,
            birthday: normalized.birthday,
            placeOfBirth: normalized.placeOfBirth,
            deathday: normalized.deathday,
            gender: normalized.gender,
            popularity: normalized.popularity,
            knownForDepartmentId,
            profilePath: normalized.profilePath,
          },
          transaction: tx,
        }
      );

      const { akaInserted, akaRestored, akaDeleted } = await syncPersonAka(
        existingPersonId,
        normalized.alsoKnownAs,
        tx
      );
      if (ownsTransaction) await tx.commit();
      return {
        personId: existingPersonId,
        action: "updated_existing",
        akaInserted,
        akaRestored,
        akaDeleted,
      };
    }

    const insertResult = await insertPerson(normalized, tx);
    if (!insertResult.inserted) {
      if (ownsTransaction) await tx.commit();
      return {
        personId: insertResult.personId,
        action: "skipped_existing",
        akaInserted: 0,
        akaRestored: 0,
        akaDeleted: 0,
      };
    }

    const { akaInserted, akaRestored, akaDeleted } = await syncPersonAka(
      insertResult.personId,
      normalized.alsoKnownAs,
      tx
    );

    if (ownsTransaction) await tx.commit();

    return {
      personId: insertResult.personId,
      action: "inserted",
      akaInserted,
      akaRestored,
      akaDeleted,
    };
  } catch (error) {
    if (ownsTransaction) {
      try {
        await tx.rollback();
      } catch (_rollbackError) {
        // swallow rollback error so the original error surfaces
      }
    }
    throw error;
  }
}

export default ingestPerson;

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
      "Missing required --id=<tmdbPersonId>. Example: npm run seed:tmdb:person -- --id=287 [--force]"
    );
  }

  return { tmdbId, forceRefreshExisting };
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
  const { tmdbId, forceRefreshExisting } = parseArgs(process.argv.slice(2));
  const scopedScriptName = `${SCRIPT_NAME}:${tmdbId}`;

  try {
    try {
      await sequelize.authenticate();
      await ensureTables();

      process.stdout.write(
        `Ingest ${renderProgressBar(0, 1)} | Person ${tmdbId}\r`
      );

      const result = await ingestPerson({ tmdbId, forceRefreshExisting });

      process.stdout.write(
        `Ingest ${renderProgressBar(1, 1)} | Person ${tmdbId} | ${result.action} | AKAs +${result.akaInserted} restored ${result.akaRestored} -${result.akaDeleted}\n`
      );

      console.log(
        `TMDB person sync complete. Person ${tmdbId} -> id=${result.personId} (${result.action}). AKAs: new ${result.akaInserted}, restored ${result.akaRestored}, soft-deleted ${result.akaDeleted}.`
      );

      await writeScriptLog({
        scriptName: scopedScriptName,
        status: "success",
        batchSize: 1,
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
    console.error("Failed to ingest TMDB person:", error.message);
    process.exit(1);
  });
}
