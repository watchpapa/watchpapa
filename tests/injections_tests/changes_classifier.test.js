import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyMovieChanges,
  classifyPersonChanges,
  classifyTvChanges,
  extractChangeKeys,
} from "../../Backend/src/scripts/tmdb_changes_fetch.js";

const FULL_MOVIE_SCOPE = { details: true, genres: true, credits: true };
const EMPTY_MOVIE_SCOPE = { details: false, genres: false, credits: false };

const FULL_TV_SCOPE = {
  details: true,
  genres: true,
  credits: true,
  seasons: true,
  episodes: true,
  episodeCredits: true,
};

const TARGETED_EPISODES_SCOPE = {
  details: false,
  genres: false,
  credits: false,
  seasons: false,
  episodes: true,
  episodeCredits: true,
};

const EMPTY_TV_SCOPE = {
  details: false,
  genres: false,
  credits: false,
  seasons: false,
  episodes: false,
  episodeCredits: false,
};

test("extractChangeKeys deduplicates and ignores invalid entries", () => {
  const keys = extractChangeKeys([
    { key: "name" },
    { key: "name" },
    { key: "" },
    null,
    { key: "overview" },
    { notAKey: true },
  ]);
  assert.deepEqual([...keys].sort(), ["name", "overview"]);
});

test("classifyMovieChanges couples credits with any movie change (overview)", () => {
  const result = classifyMovieChanges([{ key: "overview", items: [] }]);
  assert.equal(result.fullSync, true);
  assert.equal(result.hasChanges, true);
  assert.deepEqual(result.scope, FULL_MOVIE_SCOPE);
});

test("classifyMovieChanges couples credits with cast/crew-only changes", () => {
  const result = classifyMovieChanges([
    { key: "cast", items: [{ value: { id: 1 } }] },
  ]);
  assert.equal(result.fullSync, true);
  assert.deepEqual(result.scope, FULL_MOVIE_SCOPE);
});

test("classifyMovieChanges flags unknown keys as full sync", () => {
  const result = classifyMovieChanges([{ key: "totally_new_key" }]);
  assert.equal(result.fullSync, true);
  assert.deepEqual(result.scope, FULL_MOVIE_SCOPE);
});

test("classifyMovieChanges with empty changes reports no changes", () => {
  const result = classifyMovieChanges([]);
  assert.equal(result.hasChanges, false);
  assert.equal(result.fullSync, false);
  assert.deepEqual(result.scope, EMPTY_MOVIE_SCOPE);
});

test("classifyPersonChanges separates aka-only updates", () => {
  const result = classifyPersonChanges([{ key: "also_known_as" }]);
  assert.equal(result.fullSync, false);
  assert.equal(result.hasChanges, true);
  assert.deepEqual(result.scope, { details: false, aka: true });
});

test("classifyPersonChanges biography only updates details", () => {
  const result = classifyPersonChanges([{ key: "biography" }]);
  assert.deepEqual(result.scope, { details: true, aka: false });
});

test("classifyTvChanges episode-only update yields targeted episodes (no show-level work)", () => {
  const result = classifyTvChanges([
    {
      key: "episode",
      items: [
        {
          value: { episode_id: 555, episode_number: 4, season_number: 2 },
        },
        {
          value: { episode_id: 556, episode_number: 5, season_number: 2 },
        },
      ],
    },
  ]);
  assert.equal(result.fullSync, false);
  assert.equal(result.hasChanges, true);
  assert.deepEqual(result.scope, TARGETED_EPISODES_SCOPE);
  assert.ok(Array.isArray(result.targetedEpisodes));
  assert.equal(result.targetedEpisodes.length, 2);
  assert.deepEqual(result.targetedEpisodes[0], {
    seasonNumber: 2,
    episodeNumber: 4,
    episodeTmdbId: 555,
  });
});

test("classifyTvChanges season+episode update triggers full sync (credits coupled)", () => {
  const result = classifyTvChanges([
    { key: "season", items: [{ value: {} }] },
    {
      key: "episode",
      items: [{ value: { episode_id: 1, episode_number: 1, season_number: 1 } }],
    },
  ]);
  assert.equal(result.fullSync, true);
  assert.deepEqual(result.scope, FULL_TV_SCOPE);
  assert.equal(result.targetedEpisodes, null);
});

test("classifyTvChanges name+episode update triggers full sync (no targeted path)", () => {
  const result = classifyTvChanges([
    { key: "name" },
    {
      key: "episode",
      items: [{ value: { episode_id: 9, episode_number: 1, season_number: 1 } }],
    },
  ]);
  assert.equal(result.fullSync, true);
  assert.deepEqual(result.scope, FULL_TV_SCOPE);
  assert.equal(result.targetedEpisodes, null);
});

test("classifyTvChanges cast-only change triggers full sync (credits + show coupled)", () => {
  const result = classifyTvChanges([
    { key: "cast", items: [{ value: { id: 1 } }] },
  ]);
  assert.equal(result.fullSync, true);
  assert.deepEqual(result.scope, FULL_TV_SCOPE);
});

test("classifyTvChanges treats missing season/episode numbers as full sync", () => {
  const result = classifyTvChanges([
    {
      key: "episode",
      items: [{ value: { episode_id: 9 } }],
    },
  ]);
  assert.equal(result.fullSync, true);
  assert.deepEqual(result.scope, FULL_TV_SCOPE);
  assert.equal(result.targetedEpisodes, null);
});

test("classifyTvChanges with unknown key triggers full sync", () => {
  const result = classifyTvChanges([{ key: "definitely_unknown" }]);
  assert.equal(result.fullSync, true);
  assert.deepEqual(result.scope, FULL_TV_SCOPE);
});

test("classifyTvChanges empty changes reports no changes and no targets", () => {
  const result = classifyTvChanges([]);
  assert.equal(result.hasChanges, false);
  assert.equal(result.fullSync, false);
  assert.equal(result.targetedEpisodes, null);
  assert.deepEqual(result.scope, EMPTY_TV_SCOPE);
});
