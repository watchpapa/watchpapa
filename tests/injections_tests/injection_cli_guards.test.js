import test from "node:test";
import assert from "node:assert/strict";

import { envWithoutTmdbKey, runScript } from "./helpers/script_runner.js";
import { buildFailureErrorDetail } from "../../Backend/src/scripts/inject_changed_all_24h.js";

test("inject_genres exits with clear error when TMDB key is missing", () => {
  const result = runScript(
    "Backend/src/scripts/inject_genres.js",
    [],
    envWithoutTmdbKey()
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing TMDB_API_KEY_SECRET in environment/);
});

test("inject_jobs_and_departments exits with clear error when TMDB key is missing", () => {
  const result = runScript(
    "Backend/src/scripts/inject_jobs_and_departments.js",
    [],
    envWithoutTmdbKey()
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing TMDB_API_KEY_SECRET in environment/);
});

test("inject_person CLI requires --id", () => {
  const result = runScript("Backend/src/scripts/inject_person.js", []);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing required --id=<tmdbPersonId>/);
});

test("inject_movie CLI requires --id", () => {
  const result = runScript("Backend/src/scripts/inject_movie.js", []);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing required --id=<tmdbMovieId>/);
});

test("inject_tv_show CLI requires --id", () => {
  const result = runScript("Backend/src/scripts/inject_tv_show.js", []);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing required --id=<tmdbTvId>/);
});

test("inject_popular_movies_today rejects limit values above max", () => {
  const result = runScript("Backend/src/scripts/inject_popular_movies_today.js", [
    "--limit=999",
  ]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Requested --limit=999 is too high/);
});

test("inject_popular_people_today rejects limit values above max", () => {
  const result = runScript("Backend/src/scripts/inject_popular_people_today.js", [
    "--limit=999",
  ]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Requested --limit=999 is too high/);
});

test("inject_popular_shows_today rejects limit values above max", () => {
  const result = runScript("Backend/src/scripts/inject_popular_shows_today.js", [
    "--limit=999",
  ]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Requested --limit=999 is too high/);
});

test("inject_changed_movies_24h rejects limit values above max", () => {
  const result = runScript("Backend/src/scripts/inject_changed_movies_24h.js", [
    "--limit=100001",
  ]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Requested --limit=100001 is too high/);
});

test("inject_changed_people_24h rejects limit values above max", () => {
  const result = runScript("Backend/src/scripts/inject_changed_people_24h.js", [
    "--limit=100001",
  ]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Requested --limit=100001 is too high/);
});

test("inject_changed_shows_24h rejects limit values above max", () => {
  const result = runScript("Backend/src/scripts/inject_changed_shows_24h.js", [
    "--limit=100001",
  ]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Requested --limit=100001 is too high/);
});

test("inject_changed_all_24h rejects limit values above max", () => {
  const result = runScript("Backend/src/scripts/inject_changed_all_24h.js", [
    "--limit=100001",
  ]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Requested --limit=100001 is too high/);
});

test("signal handler exits non-zero and logs stopped message on SIGINT", () => {
  const result = runScript(
    "tests/injections_tests/helpers/signal_test_harness.js",
    ["SIGINT"]
  );
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Received SIGINT\. Writing stopped log and exiting/
  );
});

test("signal handler exits non-zero and logs stopped message on SIGTERM", () => {
  const result = runScript(
    "tests/injections_tests/helpers/signal_test_harness.js",
    ["SIGTERM"]
  );
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Received SIGTERM\. Writing stopped log and exiting/
  );
});

test("signal handler writes exactly one log on repeated SIGINT", () => {
  const result = runScript(
    "tests/injections_tests/helpers/signal_test_harness.js",
    ["SIGINT", "3"]
  );
  assert.equal(result.status, 1);
  const matches = result.stderr.match(/Received SIGINT/g) || [];
  assert.equal(matches.length, 1);
});

test("buildFailureErrorDetail serializes failedItems as parseable JSON", () => {
  const payload = buildFailureErrorDetail({
    scriptName: "inject_changed_all_24h:limit=5",
    summary: { refreshed: 2, failed: 2 },
    failedItems: [
      { entityType: "movie", tmdbId: 11 },
      { entityType: "show", tmdbId: 22 },
    ],
  });

  const parsed = JSON.parse(payload);
  assert.equal(parsed.scriptName, "inject_changed_all_24h:limit=5");
  assert.deepEqual(parsed.summary, { refreshed: 2, failed: 2 });
  assert.deepEqual(parsed.failedItems, [
    { entityType: "movie", tmdbId: 11 },
    { entityType: "show", tmdbId: 22 },
  ]);
  assert.equal(parsed.fatalError, null);
});
