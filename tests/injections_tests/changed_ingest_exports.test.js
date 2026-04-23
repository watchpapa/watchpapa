import test from "node:test";
import assert from "node:assert/strict";

import { ingestChangedMovies24h } from "../../Backend/src/scripts/inject_changed_movies_24h.js";
import { ingestChangedPeople24h } from "../../Backend/src/scripts/inject_changed_people_24h.js";
import { ingestChangedShows24h } from "../../Backend/src/scripts/inject_changed_shows_24h.js";
import { withEnvVar } from "./helpers/patch.js";

test("ingestChangedMovies24h fails without TMDB api key", async () => {
  await withEnvVar("TMDB_API_KEY_SECRET", "", async () => {
    await assert.rejects(
      ingestChangedMovies24h(),
      /Missing TMDB_API_KEY_SECRET in environment/
    );
  });
});

test("ingestChangedPeople24h fails without TMDB api key", async () => {
  await withEnvVar("TMDB_API_KEY_SECRET", "", async () => {
    await assert.rejects(
      ingestChangedPeople24h(),
      /Missing TMDB_API_KEY_SECRET in environment/
    );
  });
});

test("ingestChangedShows24h fails without TMDB api key", async () => {
  await withEnvVar("TMDB_API_KEY_SECRET", "", async () => {
    await assert.rejects(
      ingestChangedShows24h(),
      /Missing TMDB_API_KEY_SECRET in environment/
    );
  });
});
