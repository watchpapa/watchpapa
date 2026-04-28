import dotenv from "dotenv";
import { pathToFileURL } from "url";
import { runPopularityCli } from "./update_tmdb_popularity.js";

dotenv.config();

const SCRIPT_NAME = "update_tmdb_popularity_people";

const isDirectRun = import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  runPopularityCli({
    argv: process.argv.slice(2),
    fixedEntity: "person",
    scriptNamePrefix: SCRIPT_NAME,
  }).catch((error) => {
    console.error("Failed to refresh TMDB person popularity:", error.message);
    process.exit(1);
  });
}
