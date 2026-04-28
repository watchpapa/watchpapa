import test from "node:test";
import assert from "node:assert/strict";

import {
  envWithoutTmdbKey,
  runScript,
} from "./helpers/script_runner.js";
import {
  parsePopularityArgs,
} from "../../Backend/src/scripts/update_tmdb_popularity.js";

test("parsePopularityArgs with allowEntity=false rejects --entity", () => {
  assert.throws(
    () => parsePopularityArgs(["--entity=movie"], { allowEntity: false }),
    /Flag --entity is not supported by this script/
  );
});

test("parsePopularityArgs with allowEntity=false still parses limit/page-size", () => {
  const parsed = parsePopularityArgs(
    ["--limit=50", "--page-size=10", "--fetch-concurrency=4"],
    { allowEntity: false }
  );
  assert.equal(parsed.entity, null);
  assert.equal(parsed.limit, 50);
  assert.equal(parsed.pageSize, 10);
  assert.equal(parsed.fetchConcurrency, 4);
});

test("parsePopularityArgs validates --page-size upper bound", () => {
  assert.throws(
    () => parsePopularityArgs(["--page-size=99999"]),
    /Requested --page-size=99999 is too high/
  );
});

test("update_tmdb_popularity_movies CLI rejects --entity flag", () => {
  const result = runScript(
    "Backend/src/scripts/update_tmdb_popularity_movies.js",
    ["--entity=show"]
  );
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /Flag --entity is not supported by this script/
  );
});

test("update_tmdb_popularity_shows CLI rejects --entity flag", () => {
  const result = runScript(
    "Backend/src/scripts/update_tmdb_popularity_shows.js",
    ["--entity=movie"]
  );
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /Flag --entity is not supported by this script/
  );
});

test("update_tmdb_popularity_people CLI rejects --entity flag", () => {
  const result = runScript(
    "Backend/src/scripts/update_tmdb_popularity_people.js",
    ["--entity=movie"]
  );
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /Flag --entity is not supported by this script/
  );
});

test("update_tmdb_popularity_movies CLI fails with clear error when TMDB key missing", () => {
  const result = runScript(
    "Backend/src/scripts/update_tmdb_popularity_movies.js",
    ["--limit=1"],
    envWithoutTmdbKey()
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing TMDB_API_KEY_SECRET in environment/);
});
