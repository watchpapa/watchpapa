import test from "node:test";
import assert from "node:assert/strict";

import { envWithoutTmdbKey, runScript } from "./helpers/script_runner.js";

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
