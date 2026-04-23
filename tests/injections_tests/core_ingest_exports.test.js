import test from "node:test";
import assert from "node:assert/strict";

import sequelize from "../../Backend/src/db/database.js";
import { ingestMovie } from "../../Backend/src/scripts/inject_movie.js";
import { ingestPerson } from "../../Backend/src/scripts/inject_person.js";
import { ingestTvShow } from "../../Backend/src/scripts/inject_tv_show.js";
import { withPatchedMethod } from "./helpers/patch.js";

test("ingestPerson validates tmdbId input", async () => {
  await assert.rejects(
    ingestPerson({ tmdbId: "42" }),
    /ingestPerson requires a numeric `tmdbId`\./
  );
});

test("ingestMovie validates tmdbId input", async () => {
  await assert.rejects(
    ingestMovie({ tmdbId: null }),
    /ingestMovie requires a numeric `tmdbId`\./
  );
});

test("ingestTvShow validates tmdbTvId input", async () => {
  await assert.rejects(
    ingestTvShow({ tmdbTvId: "99" }),
    /ingestTvShow requires a numeric `tmdbTvId`\./
  );
});

test("ingestPerson returns skipped_existing when person exists", async () => {
  await withPatchedMethod(
    sequelize,
    "query",
    async () => [[{ id: 456 }]],
    async () => {
      const result = await ingestPerson({
        tmdbId: 456,
        transaction: { id: "fake-tx" },
      });

      assert.equal(result.personId, 456);
      assert.equal(result.action, "skipped_existing");
      assert.equal(result.akaInserted, 0);
    }
  );
});

test("ingestPerson can force-refresh an existing person", async () => {
  let sawUpdate = false;
  await withPatchedMethod(
    sequelize,
    "query",
    async (sql) => {
      if (sql.includes("FROM person") && sql.includes("WHERE tmdb_id")) {
        return [[{ id: 456 }]];
      }
      if (sql.includes("UPDATE person")) {
        sawUpdate = true;
        return [[], null];
      }
      if (sql.includes("FROM person_aka")) {
        return [[]];
      }
      return [[]];
    },
    async () => {
      const result = await ingestPerson({
        tmdbId: 456,
        transaction: { id: "fake-tx" },
        forceRefreshExisting: true,
        preloadedPayload: {
          id: 456,
          name: "Updated Name",
          adult: false,
          biography: "Updated bio",
          birthday: null,
          place_of_birth: null,
          deathday: null,
          gender: 0,
          popularity: 1.23,
          known_for_department: "Acting",
          profile_path: "/profile.jpg",
          also_known_as: [],
        },
      });

      assert.equal(result.personId, 456);
      assert.equal(result.action, "updated_existing");
      assert.equal(sawUpdate, true);
    }
  );
});

test("ingestMovie returns skipped_existing when movie exists", async () => {
  await withPatchedMethod(
    sequelize,
    "query",
    async () => [[{ id: 123 }]],
    async () => {
      const result = await ingestMovie({ tmdbId: 123, apiKey: "fake-key" });
      assert.equal(result.movieId, 123);
      assert.equal(result.action, "skipped_existing");
      assert.equal(result.castLinked, 0);
      assert.equal(result.crewLinked, 0);
    }
  );
});

test("ingestTvShow returns skipped_existing when show exists", async () => {
  await withPatchedMethod(
    sequelize,
    "query",
    async () => [[{ id: 321 }]],
    async () => {
      const result = await ingestTvShow({ tmdbTvId: 321, apiKey: "fake-key" });
      assert.equal(result.showId, 321);
      assert.equal(result.action, "skipped_existing");
      assert.equal(result.creditsLinked, 0);
      assert.equal(result.seasonsProcessed, 0);
    }
  );
});
