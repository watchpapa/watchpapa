// Shared setup of the E2E tests: starts the frontend (the Vite dev server) against a dummy
// Supabase address and launches a browser. Every E2E file calls startE2eEnvironment() in
// `before` and environment.stop() in `after`, and fakes the network itself with page.route.

import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "../../../../Frontend/node_modules/playwright/index.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const FRONTEND = resolve(ROOT, "Frontend");

const SERVER_START_TIMEOUT_MS = 60_000;
const SERVER_POLL_INTERVAL_MS = 250;
const SERVER_REQUEST_TIMEOUT_MS = 2_000;

// The dummy address the frontend is told to use as Supabase. Nothing listens there:
// the tests intercept every request to it.
export const SUPABASE_URL = "https://e2e.supabase.test";

// Where the frontend answers for a given port.
export function appUrlFor(port) {
  return `http://127.0.0.1:${port}`;
}

function startFrontend(port) {
  const server = spawn(
    process.execPath,
    [
      resolve(FRONTEND, "node_modules/vite/bin/vite.js"),
      "--port",
      String(port),
      "--strictPort",
      "--host",
      "127.0.0.1",
    ],
    {
      cwd: FRONTEND,
      env: {
        ...process.env,
        VITE_SUPABASE_URL: SUPABASE_URL,
        VITE_SUPABASE_PUBLISHABLE_KEY: "e2e-publishable-key",
        VITE_API_BASE_URL: "",
      },
      // Vite's own messages are kept, so a failed start can say why (see waitForServer).
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const output = [];
  server.stdout.on("data", (chunk) => output.push(String(chunk)));
  server.stderr.on("data", (chunk) => output.push(String(chunk)));
  return { server, output };
}

async function waitForServer(url, { server, output }) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < SERVER_START_TIMEOUT_MS) {
    if (server.exitCode !== null) break; // Vite stopped by itself, no point in waiting
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(SERVER_REQUEST_TIMEOUT_MS),
      });
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((resolveDelay) =>
      setTimeout(resolveDelay, SERVER_POLL_INTERVAL_MS),
    );
  }
  server.kill("SIGTERM");
  throw new Error(
    `Vite dev server did not start on ${url}. Its output:\n${output.join("")}`,
  );
}

// Returns { appUrl, browser, stop }: where the frontend answers, the browser to drive it,
// and a function that closes both.
export async function startE2eEnvironment({ port }) {
  const appUrl = appUrlFor(port);
  const frontend = startFrontend(port);
  await waitForServer(appUrl, frontend);
  const browser = await chromium.launch();
  return {
    appUrl,
    browser,
    async stop() {
      await browser.close();
      frontend.server.kill("SIGTERM");
    },
  };
}
