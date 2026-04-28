import dotenv from "dotenv";
import { pathToFileURL } from "url";
import { runPopularityCli } from "./update_tmdb_popularity.js";

dotenv.config();

const SCRIPT_NAME = "update_tmdb_popularity_shows";

const isDirectRun = import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  runPopularityCli({
    argv: process.argv.slice(2),
    fixedEntity: "show",
    scriptNamePrefix: SCRIPT_NAME,
  }).catch((error) => {
    console.error("Failed to refresh TMDB show popularity:", error.message);
    process.exit(1);
  });
}
