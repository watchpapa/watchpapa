import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const repoRoot = path.resolve(__dirname, "../../..");

export function runScript(relativeScriptPath, args = [], env = {}) {
  const scriptPath = path.join(repoRoot, relativeScriptPath);
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ...env,
    },
  });
}

export function envWithoutTmdbKey() {
  return {
    TMDB_API_KEY_SECRET: "",
  };
}
