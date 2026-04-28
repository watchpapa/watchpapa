import test from "node:test";
import assert from "node:assert/strict";

import sequelize from "../../Backend/src/db/database.js";
import {
  batchIngestPersons,
  ingestPerson,
} from "../../Backend/src/scripts/inject_person.js";
import { withPatchedMethod } from "./helpers/patch.js";

const FAKE_PERSON_PAYLOAD = Object.freeze({
  id: 700,
  name: "Refreshed Person",
  adult: false,
  biography: "Refreshed bio",
  birthday: null,
  place_of_birth: null,
  deathday: null,
  gender: 0,
  popularity: 4.2,
  known_for_department: "Acting",
  profile_path: "/p.jpg",
  also_known_as: ["Alias One", "Alias Two"],
});

test("ingestPerson scope details=true skips AKA sync when aka=false", async () => {
  let sawPersonUpdate = false;
  let sawAkaSelect = false;
  let sawAkaInsert = false;

  await withPatchedMethod(
    sequelize,
    "query",
    async (sql) => {
      if (sql.includes("FROM person") && sql.includes("WHERE tmdb_id")) {
        return [[{ id: 700 }]];
      }
      if (sql.includes("FROM department")) {
        return [[{ id: 1 }]];
      }
      if (sql.includes("UPDATE person")) {
        sawPersonUpdate = true;
        return [[], null];
      }
      if (sql.includes("FROM person_aka")) {
        sawAkaSelect = true;
        return [[]];
      }
      if (sql.includes("INSERT INTO person_aka")) {
        sawAkaInsert = true;
        return [[]];
      }
      return [[]];
    },
    async () => {
      const result = await ingestPerson({
        tmdbId: 700,
        transaction: { id: "fake-tx" },
        forceRefreshExisting: true,
        refreshScope: { details: true, aka: false },
        preloadedPayload: FAKE_PERSON_PAYLOAD,
      });

      assert.equal(result.action, "scoped_existing");
      assert.equal(result.akaInserted, 0);
      assert.equal(result.akaRestored, 0);
      assert.equal(result.akaDeleted, 0);
      assert.deepEqual(result.scope, { details: true, aka: false });
    }
  );

  assert.equal(sawPersonUpdate, true, "person UPDATE should run when details=true");
  assert.equal(sawAkaSelect, false, "AKA SELECT must not run when aka=false");
  assert.equal(sawAkaInsert, false, "AKA INSERT must not run when aka=false");
});

test("ingestPerson scope aka=true skips person row update when details=false", async () => {
  let sawPersonUpdate = false;
  let sawAkaSelect = false;

  await withPatchedMethod(
    sequelize,
    "query",
    async (sql) => {
      if (sql.includes("FROM person") && sql.includes("WHERE tmdb_id")) {
        return [[{ id: 700 }]];
      }
      if (sql.includes("UPDATE person")) {
        sawPersonUpdate = true;
        return [[], null];
      }
      if (sql.includes("FROM person_aka")) {
        sawAkaSelect = true;
        return [[]];
      }
      return [[]];
    },
    async () => {
      const result = await ingestPerson({
        tmdbId: 700,
        transaction: { id: "fake-tx" },
        forceRefreshExisting: true,
        refreshScope: { details: false, aka: true },
        preloadedPayload: FAKE_PERSON_PAYLOAD,
      });

      assert.equal(result.action, "scoped_existing");
      assert.deepEqual(result.scope, { details: false, aka: true });
    }
  );

  assert.equal(sawPersonUpdate, false, "person UPDATE must not run when details=false");
  assert.equal(sawAkaSelect, true, "AKA SELECT should run when aka=true");
});

test("ingestPerson scope all-false short-circuits to unchanged_existing", async () => {
  let sawAnyWrite = false;

  await withPatchedMethod(
    sequelize,
    "query",
    async (sql) => {
      if (sql.includes("FROM person") && sql.includes("WHERE tmdb_id")) {
        return [[{ id: 700 }]];
      }
      if (sql.startsWith("UPDATE") || sql.startsWith("INSERT")) {
        sawAnyWrite = true;
      }
      return [[]];
    },
    async () => {
      const result = await ingestPerson({
        tmdbId: 700,
        transaction: { id: "fake-tx" },
        forceRefreshExisting: true,
        refreshScope: { details: false, aka: false },
        preloadedPayload: FAKE_PERSON_PAYLOAD,
      });

      assert.equal(result.action, "unchanged_existing");
      assert.equal(result.akaInserted, 0);
    }
  );

  assert.equal(sawAnyWrite, false, "no writes should occur for all-false scope");
});

test("batchIngestPersons maps string tmdb_id rows to numeric lookup keys", async () => {
  await withPatchedMethod(
    sequelize,
    "query",
    async (sql) => {
      if (sql.includes("SELECT id, tmdb_id FROM person WHERE tmdb_id IN")) {
        return [[{ id: 501, tmdb_id: "700" }]];
      }
      throw new Error(`Unexpected query in test: ${sql}`);
    },
    async () => {
      const personIdMap = await batchIngestPersons(
        [700],
        new Map([[700, FAKE_PERSON_PAYLOAD]]),
        { id: "fake-tx" }
      );

      assert.equal(
        personIdMap.get(700),
        501,
        "numeric lookup key should resolve even if DB returns string tmdb_id"
      );
    }
  );
});
