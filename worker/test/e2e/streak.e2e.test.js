/**
 * E2E (Playwright + the real UI): the profile page shows the user's streak.
 *
 * RED ON PURPOSE (first version, 2026-11-12): there is no streak on the profile
 * page yet, so the streak check fails while the control check passes. The test is
 * written early and realigned as the feature grows (endpoint, response shape,
 * timezone); every change is recorded in uni-plan/notes-automated-testing.md,
 * "E2E test history".
 *
 * Hermetic, same approach as pwned-password.e2e.test.js: the Vite dev server runs
 * against a dummy Supabase URL and EVERY network call (Supabase and the Worker API)
 * is intercepted with page.route. No real project is touched and no account is used.
 * The logged-in user is a made-up one that views their own profile, so the page
 * skips the permission checks (private / blocked / observing).
 *
 *   cd worker && npm run test:e2e   (needs Playwright's Chromium: `cd Frontend && npx playwright install chromium`)
 *
 * Lives in worker/test/e2e and is excluded from `npm test` (vitest): it is a node:test file that
 * starts the frontend and a browser, so it runs with its own script and not in the unit-test run.
 */

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "../../../Frontend/node_modules/playwright/index.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const FRONTEND = resolve(ROOT, "Frontend");
const PORT = 5198;
const APP = `http://127.0.0.1:${PORT}`;
const SUPABASE = "https://e2e.supabase.test";
const STORAGE_KEY = "sb-e2e-auth-token"; // supabase-js: sb-<first host label>-auth-token

const USER_ID = "00000000-0000-0000-0000-000000000001";
const USERNAME = "e2e_user";

// What the (not yet built) streaks endpoint is expected to return, see 02-feature-spec.md.
const STREAKS = {
  current: 3,
  longest: 5,
  lastWatchedOn: "2026-11-11",
  timeZone: "Europe/Berlin",
};

// The made-up logged-in user and its tokens, used both for the session stored in the
// browser and for the replies of the faked Supabase auth endpoints.
const FAKE_USER = {
  id: USER_ID,
  aud: "authenticated",
  role: "authenticated",
  email: "e2e@example.com",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};
const FAKE_TOKENS = {
  access_token: "e2e.access.token",
  refresh_token: "e2e-refresh",
  token_type: "bearer",
  expires_in: 3600,
};

const PROFILE = {
  id: USER_ID,
  username: USERNAME,
  bio: null,
  created_at: "2026-01-01T00:00:00Z",
  is_private: false,
  setting_allow_profile_share: true,
  avatar_type: "none",
  avatar_poster_path: null,
  avatar_upload_path: null,
  banner_favourite_position: null,
  banner_crop: null,
};

// Replies to a faked request with a JSON body. The CORS headers let the browser accept
// answers that come from another address (the faked Supabase).
function replyWithJson(route, status, body) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "*",
    },
    body: JSON.stringify(body),
  });
}

let server;
let browser;

async function waitForServer(url, timeoutMs = 60_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error(`Vite dev server did not start on ${url}`);
}

before(async () => {
  server = spawn(
    process.execPath,
    [
      resolve(FRONTEND, "node_modules/vite/bin/vite.js"),
      "--port",
      String(PORT),
      "--strictPort",
      "--host",
      "127.0.0.1",
    ],
    {
      cwd: FRONTEND,
      env: {
        ...process.env,
        VITE_SUPABASE_URL: SUPABASE,
        VITE_SUPABASE_PUBLISHABLE_KEY: "e2e-publishable-key",
        VITE_API_BASE_URL: "",
      },
      stdio: "ignore",
    },
  );
  await waitForServer(APP);
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  server?.kill("SIGTERM");
});

/** Fresh page, logged in as the made-up user, all network mocked. */
async function newProfilePage() {
  const context = await browser.newContext();
  // Pretend the cookie banner was answered; "declined" => the Supabase session lives in sessionStorage.
  await context.addCookies([
    { name: "cookie_consent", value: "declined", url: APP },
  ]);
  await context.addInitScript(
    ({ key, user, tokens }) => {
      const expiresAtInSeconds =
        Math.floor(Date.now() / 1000) + tokens.expires_in;
      sessionStorage.setItem(
        key,
        JSON.stringify({ ...tokens, expires_at: expiresAtInSeconds, user }),
      );
    },
    { key: STORAGE_KEY, user: FAKE_USER, tokens: FAKE_TOKENS },
  );
  const page = await context.newPage();

  // Routes registered later win, so the generic stub goes first and the specific ones after it.
  await page.route(`${APP}/api/**`, (route) => replyWithJson(route, 200, {}));
  await page.route(`${APP}/api/insights/streaks/*`, (route) =>
    replyWithJson(route, 200, STREAKS),
  );

  await page.route(`${SUPABASE}/**`, async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    if (request.method() === "OPTIONS") return replyWithJson(route, 204, {});
    if (pathname.endsWith("/auth/v1/user"))
      return replyWithJson(route, 200, FAKE_USER);
    if (pathname.includes("/auth/v1/token"))
      return replyWithJson(route, 200, { ...FAKE_TOKENS, user: FAKE_USER });
    if (pathname.endsWith("/rest/v1/profile"))
      return replyWithJson(route, 200, PROFILE); // .maybeSingle() expects one object
    if (pathname.endsWith("/rest/v1/rpc/get_effective_tier"))
      return replyWithJson(route, 200, "free");
    if (pathname.includes("/rest/v1/")) return replyWithJson(route, 200, []);
    return replyWithJson(route, 200, {});
  });

  return { page, context };
}

describe("profile page", () => {
  test("shows the current streak from the streaks API", async () => {
    const { page, context } = await newProfilePage();
    try {
      await page.goto(`${APP}/u/${USERNAME}`);

      // Control check: the profile loaded and is the user's own. "Edit profile" is only rendered then
      // (the username alone is not enough: it also shows in the breadcrumb and in "Profile not found").
      // If this fails, the setup is broken, not the streak.
      await page
        .getByRole("link", { name: "Edit profile" })
        .waitFor({ timeout: 15_000 });

      // The streak: a "3" in an element with data-testid="streak-current".
      const streak = page.getByTestId("streak-current");
      await streak.waitFor({ timeout: 3_000 });
      assert.equal(
        (await streak.textContent()).trim(),
        String(STREAKS.current),
      );
    } finally {
      await context.close();
    }
  });
});
