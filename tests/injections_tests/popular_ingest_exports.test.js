import test from "node:test";
import assert from "node:assert/strict";

import { ingestPopularMoviesToday } from "../../Backend/src/scripts/inject_popular_movies_today.js";
import { ingestPopularPeopleToday } from "../../Backend/src/scripts/inject_popular_people_today.js";
import { ingestPopularShowsToday } from "../../Backend/src/scripts/inject_popular_shows_today.js";
import { withEnvVar } from "./helpers/patch.js";

test("ingestPopularMoviesToday fails without TMDB api key", async () => {
  await withEnvVar("TMDB_API_KEY_SECRET", "", async () => {
    await assert.rejects(
      ingestPopularMoviesToday(),
      /Missing TMDB_API_KEY_SECRET in environment/
    );
  });
});

test("ingestPopularPeopleToday fails without TMDB api key", async () => {
  await withEnvVar("TMDB_API_KEY_SECRET", "", async () => {
    await assert.rejects(
      ingestPopularPeopleToday(),
      /Missing TMDB_API_KEY_SECRET in environment/
    );
  });
});

test("ingestPopularShowsToday fails without TMDB api key", async () => {
  await withEnvVar("TMDB_API_KEY_SECRET", "", async () => {
    await assert.rejects(
      ingestPopularShowsToday(),
      /Missing TMDB_API_KEY_SECRET in environment/
    );
  });
});
