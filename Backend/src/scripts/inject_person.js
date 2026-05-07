import dotenv from "dotenv";
import { pathToFileURL } from "url";
import sequelize from "../db/database.js";
import { tmdbRateLimitedFetch } from "./tmdb_rate_limited_fetch.js";
import {
  str,
  strOrNull,
  clampedNum,
  clampedInt,
  strictBool,
  isoDate,
} from "../lib/sanitizeTmdb.js";

dotenv.config();

const TMDB_PERSON_URL = "https://api.themoviedb.org/3/person";
const SCRIPT_NAME = "inject_person";

let cachedApiKey = null;

export const FULL_PERSON_REFRESH_SCOPE = Object.freeze({
  details: true,
  aka: true,
});

// Turns a given scope object into one with clear true/false flags.
export function normalizePersonRefreshScope(scope) {
  if (!scope) return { ...FULL_PERSON_REFRESH_SCOPE };
  return {
    details: Boolean(scope.details),
    aka: Boolean(scope.aka),
  };
}

// Returns true only when every person scope flag is false (no-op refresh).
function isAllFalsePersonScope(scope) {
  if (!scope) return false;
  for (const v of Object.values(scope)) if (v) return false;
  return true;
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

// Verifies person, person_aka, and department tables exist before ingesting.
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

// Fetches person details from TMDB by id.
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

// Deduplicates and trims also_known_as strings into a clean list.
function normalizeNicknames(alsoKnownAs) {
  if (!Array.isArray(alsoKnownAs)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of alsoKnownAs) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim().slice(0, 500);
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

// Sanitizes raw TMDB person payload into validated, DB-safe field values.
function normalizePersonPayload(payload) {
  const tmdbId = payload.id;
  if (typeof tmdbId !== "number") {
    throw new Error("TMDB person payload is missing numeric `id`.");
  }

  const rawName = typeof payload.name === "string" ? payload.name.trim() : "";
  if (!rawName) {
    throw new Error(`TMDB person ${tmdbId} is missing required \`name\`.`);
  }

  return {
    tmdbId,
    name: str(rawName, 500),
    adult: strictBool(payload.adult),
    biography: strOrNull(payload.biography, 50_000),
    birthday: isoDate(payload.birthday),
    placeOfBirth: strOrNull(payload.place_of_birth, 500),
    deathday: isoDate(payload.deathday),
    gender: clampedInt(payload.gender, 0, 0, 3),
    popularity: clampedNum(payload.popularity, 0, 0, 9_999_999),
    knownForDepartmentName: strOrNull(payload.known_for_department, 200),
    profilePath: strOrNull(payload.profile_path, 500),
    alsoKnownAs: normalizeNicknames(payload.also_known_as),
  };
}

const departmentCache = new Map();
const existingPersonIdCache = new Map();

function normalizeDepartmentName(name) {
  return strOrNull(name === "Actors" ? "Acting" : name, 200);
}

// Looks up a department id by name using an in-process cache.
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

// Looks up the local person id by TMDB id, with an in-process cache.
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

// Inserts a person row; on conflict falls back to the existing row's id.
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

// Syncs person_aka rows: inserts new, restores soft-deleted, and soft-deletes removed aliases.
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

// Ingests a person and their aliases from TMDB, respecting refresh scope and ownership.
export async function ingestPerson({
  tmdbId,
  transaction,
  apiKey,
  preloadedPayload,
  forceRefreshExisting = false,
  refreshScope = null,
} = {}) {
  if (typeof tmdbId !== "number" || !Number.isFinite(tmdbId)) {
    throw new Error("ingestPerson requires a numeric `tmdbId`.");
  }

  // Reuse caller transaction when provided; otherwise own commit/rollback lifecycle.
  const ownsTransaction = !transaction;
  const tx = transaction ?? (await sequelize.transaction());

  try {
    // Fast path: skip DB/API work when person already exists and refresh is not requested.
    const existingPersonId = await findExistingPersonId(tmdbId, tx);
    if (existingPersonId && !forceRefreshExisting) {
      if (ownsTransaction) await tx.commit();
      return {
        personId: existingPersonId,
        action: "skipped_existing",
        scope: { ...FULL_PERSON_REFRESH_SCOPE },
        akaInserted: 0,
        akaRestored: 0,
        akaDeleted: 0,
      };
    }

    const isExistingEntity = Boolean(existingPersonId);
    const effectiveScope =
      isExistingEntity && refreshScope
        ? normalizePersonRefreshScope(refreshScope)
        : { ...FULL_PERSON_REFRESH_SCOPE };

    // Explicit no-op scope for an existing row returns immediately as unchanged.
    if (
      isExistingEntity &&
      refreshScope &&
      isAllFalsePersonScope(effectiveScope)
    ) {
      if (ownsTransaction) await tx.commit();
      return {
        personId: existingPersonId,
        action: "unchanged_existing",
        scope: effectiveScope,
        akaInserted: 0,
        akaRestored: 0,
        akaDeleted: 0,
      };
    }

    // Use preloaded payload when batching; otherwise fetch fresh data from TMDB.
    let payload;
    if (preloadedPayload) {
      payload = preloadedPayload;
    } else {
      const resolvedKey = apiKey ?? getApiKey();
      payload = await fetchTmdbPerson(resolvedKey, tmdbId);
    }
    const normalized = normalizePersonPayload(payload);

    // Existing row + force refresh: update requested scopes in place.
    if (existingPersonId && forceRefreshExisting) {
      if (effectiveScope.details) {
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
      }

      let akaInserted = 0;
      let akaRestored = 0;
      let akaDeleted = 0;
      // AKA sync is scope-gated so callers can skip alias churn when unnecessary.
      if (effectiveScope.aka) {
        const akaResult = await syncPersonAka(
          existingPersonId,
          normalized.alsoKnownAs,
          tx
        );
        akaInserted = akaResult.akaInserted;
        akaRestored = akaResult.akaRestored;
        akaDeleted = akaResult.akaDeleted;
      }

      if (ownsTransaction) await tx.commit();
      return {
        personId: existingPersonId,
        action: refreshScope ? "scoped_existing" : "updated_existing",
        scope: effectiveScope,
        akaInserted,
        akaRestored,
        akaDeleted,
      };
    }

    // Insert-first path for new people; conflict means another writer already created it.
    const insertResult = await insertPerson(normalized, tx);
    if (!insertResult.inserted) {
      if (ownsTransaction) await tx.commit();
      return {
        personId: insertResult.personId,
        action: "skipped_existing",
        scope: { ...FULL_PERSON_REFRESH_SCOPE },
        akaInserted: 0,
        akaRestored: 0,
        akaDeleted: 0,
      };
    }

    // New inserts always get full AKA synchronization from current TMDB payload.
    const { akaInserted, akaRestored, akaDeleted } = await syncPersonAka(
      insertResult.personId,
      normalized.alsoKnownAs,
      tx
    );

    if (ownsTransaction) await tx.commit();

    return {
      personId: insertResult.personId,
      action: "inserted",
      scope: { ...FULL_PERSON_REFRESH_SCOPE },
      akaInserted,
      akaRestored,
      akaDeleted,
    };
  } catch (error) {
    // Roll back only when we opened the transaction; preserve original failure signal.
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

// Parses --id and --force CLI arguments for the person ingest script.
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
  // Track one start timestamp for consistent script log runtime calculation.
  const startedAt = new Date();
  const { tmdbId, forceRefreshExisting } = parseArgs(process.argv.slice(2));
  const scopedScriptName = `${SCRIPT_NAME}:${tmdbId}`;

  try {
    try {
      // Validate connectivity and schema prerequisites up front.
      await sequelize.authenticate();
      await ensureTables();

      // Show single-item progress for this one-person ingest run.
      process.stdout.write(
        `Ingest ${renderProgressBar(0, 1)} | Person ${tmdbId}\r`
      );

      // Perform person ingest with optional force-refresh behavior.
      const result = await ingestPerson({ tmdbId, forceRefreshExisting });

      // Replace progress line with final action and AKA delta stats.
      process.stdout.write(
        `Ingest ${renderProgressBar(1, 1)} | Person ${tmdbId} | ${result.action} | AKAs +${result.akaInserted} restored ${result.akaRestored} -${result.akaDeleted}\n`
      );

      // Emit durable completion summary for terminal logs and CI output.
      console.log(
        `TMDB person sync complete. Person ${tmdbId} -> id=${result.personId} (${result.action}). AKAs: new ${result.akaInserted}, restored ${result.akaRestored}, soft-deleted ${result.akaDeleted}.`
      );

      // Record successful execution in script_logs.
      await writeScriptLog({
        scriptName: scopedScriptName,
        status: "success",
        batchSize: 1,
        errorCode: null,
        errorDetail: null,
        startedAt,
      });
    } catch (error) {
      // Persist failure context, then rethrow for CLI non-zero exit handling.
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
    // Always close DB resources, regardless of success or failure.
    await sequelize.close();
  }
}

// Batch-ingests multiple persons in one transaction and returns a tmdbId → local id map.
export async function batchIngestPersons(tmdbIds, personPayloads, transaction) {
  // Nothing to do when the caller gives an empty list.
  if (tmdbIds.length === 0) return new Map();

  // Load already-existing people in one query so we skip duplicate inserts.
  const existRepl = {};
  tmdbIds.forEach((id, i) => { existRepl[`eid${i}`] = id; });
  const [existingRows] = await sequelize.query(
    `SELECT id, tmdb_id FROM person WHERE tmdb_id IN (${tmdbIds.map((_, i) => `:eid${i}`).join(", ")})`,
    { replacements: existRepl, transaction }
  );

  const personIdMap = new Map();
  for (const row of existingRows) {
    const tmdbId = Number(row.tmdb_id);
    if (!Number.isFinite(tmdbId)) continue;
    personIdMap.set(tmdbId, row.id);
    existingPersonIdCache.set(tmdbId, row.id);
  }

  // Keep only the IDs that are still missing in our local database.
  const newIds = tmdbIds.filter((id) => !personIdMap.has(id));
  if (newIds.length === 0) return personIdMap;

  // Normalize and sanitize payloads before building the bulk INSERT values.
  const normalizedList = [];
  for (const id of newIds) {
    const n = normalizePersonPayload(personPayloads.get(id));
    n.knownForDepartmentId = await resolveDepartmentId(n.knownForDepartmentName, transaction);
    normalizedList.push(n);
  }

  // Build parameterized tuples for one bulk insert query.
  const insRepl = {};
  const tuples = normalizedList.map((n, i) => {
    insRepl[`t${i}`] = n.tmdbId;
    insRepl[`nm${i}`] = n.name;
    insRepl[`ad${i}`] = n.adult;
    insRepl[`bi${i}`] = n.biography;
    insRepl[`bd${i}`] = n.birthday;
    insRepl[`pb${i}`] = n.placeOfBirth;
    insRepl[`dd${i}`] = n.deathday;
    insRepl[`gn${i}`] = n.gender;
    insRepl[`pp${i}`] = n.popularity;
    insRepl[`kd${i}`] = n.knownForDepartmentId;
    insRepl[`pf${i}`] = n.profilePath;
    return `(:t${i},:nm${i},:ad${i},:bi${i},:bd${i},:pb${i},:dd${i},:gn${i},:pp${i},:kd${i},:pf${i})`;
  });

  // Insert missing people; ignore conflicts when another writer inserted first.
  const [insertedRows] = await sequelize.query(
    `INSERT INTO person (tmdb_id,name,adult,biography,birthday,place_of_birth,deathday,gender,popularity,known_for_department_id,profile_path)
     VALUES ${tuples.join(", ")}
     ON CONFLICT (tmdb_id) DO NOTHING
     RETURNING id, tmdb_id`,
    { replacements: insRepl, transaction }
  );

  for (const row of insertedRows) {
    const tmdbId = Number(row.tmdb_id);
    if (!Number.isFinite(tmdbId)) continue;
    personIdMap.set(tmdbId, row.id);
    existingPersonIdCache.set(tmdbId, row.id);
  }

  // Resolve IDs for rows that were inserted concurrently by another process.
  const stillMissing = newIds.filter((id) => !personIdMap.has(id));
  if (stillMissing.length > 0) {
    const missRepl = {};
    stillMissing.forEach((id, i) => { missRepl[`mid${i}`] = id; });
    const [missRows] = await sequelize.query(
      `SELECT id, tmdb_id FROM person WHERE tmdb_id IN (${stillMissing.map((_, i) => `:mid${i}`).join(", ")})`,
      { replacements: missRepl, transaction }
    );
    for (const row of missRows) {
      const tmdbId = Number(row.tmdb_id);
      if (!Number.isFinite(tmdbId)) continue;
      personIdMap.set(tmdbId, row.id);
      existingPersonIdCache.set(tmdbId, row.id);
    }
  }

  // For newly inserted people, bulk insert their AKA nicknames.
  if (insertedRows.length > 0) {
    const akaRows = [];
    const normalizedByTmdbId = new Map(normalizedList.map((n) => [n.tmdbId, n]));
    for (const row of insertedRows) {
      const n = normalizedByTmdbId.get(row.tmdb_id);
      for (const nickname of (n?.alsoKnownAs ?? [])) {
        akaRows.push({ personId: row.id, nickname });
      }
    }
    if (akaRows.length > 0) {
      const akaRepl = {};
      const akaTuples = akaRows.map((r, i) => {
        akaRepl[`ap${i}`] = r.personId;
        akaRepl[`an${i}`] = r.nickname;
        return `(:ap${i},:an${i})`;
      });
      await sequelize.query(
        `INSERT INTO person_aka (person_id, nickname) VALUES ${akaTuples.join(", ")}`,
        { replacements: akaRepl, transaction }
      );
    }
  }

  // Return tmdb_id -> local person.id for all requested IDs.
  return personIdMap;
}

const isDirectRun = import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error("Failed to ingest TMDB person:", error.message);
    process.exit(1);
  });
}
