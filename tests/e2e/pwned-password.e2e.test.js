/**
 * E2E (Playwright + the real UI): breached passwords are rejected on sign-up and
 * password reset, with Supabase never receiving them.
 *
 * Hermetic: the Vite dev server runs against a dummy Supabase URL and EVERY
 * network call (Supabase auth/rest, HIBP, the Worker API) is intercepted with
 * page.route. No real project is touched, no email is sent, no account is made.
 *
 *   npm run test:e2e        (needs Playwright's Chromium: `cd Frontend && npx playwright install chromium`)
 */

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "../../Frontend/node_modules/playwright/index.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const FRONTEND = resolve(ROOT, "Frontend");
const PORT = 5199;
const APP = `http://127.0.0.1:${PORT}`;
const SUPABASE = "https://e2e.supabase.test";
const STORAGE_KEY = "sb-e2e-auth-token"; // supabase-js: sb-<first host label>-auth-token

const BREACHED = "Password123!"; // satisfies the client policy, but is in HIBP
const CLEAN = "Zq7!correct-horse-battery-staple";

const sha1 = (s) => createHash("sha1").update(s).digest("hex").toUpperCase();

let server;
let browser;

async function waitForServer(url, ms = 60_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if ((await fetch(url)).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Vite dev server did not start on ${url}`);
}

before(async () => {
  server = spawn(process.execPath, [resolve(FRONTEND, "node_modules/vite/bin/vite.js"), "--port", String(PORT), "--strictPort", "--host", "127.0.0.1"], {
    cwd: FRONTEND,
    env: { ...process.env, VITE_SUPABASE_URL: SUPABASE, VITE_SUPABASE_PUBLISHABLE_KEY: "e2e-publishable-key", VITE_API_BASE_URL: "" },
    stdio: "ignore",
  });
  await waitForServer(APP);
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  server?.kill("SIGTERM");
});

/**
 * Fresh page with all network mocked. Returns handles to inspect what was sent.
 * hibp: "clean" | "breached" | "down" | (fn) — how the range API answers.
 */
async function newPage({ hibp = "clean", session = false } = {}) {
  const context = await browser.newContext();
  // Pretend the cookie banner was answered (it would cover the form otherwise);
  // "declined" ⇒ the Supabase session lives in sessionStorage.
  await context.addCookies([{ name: "cookie_consent", value: "declined", url: APP }]);
  if (session) {
    await context.addInitScript(({ key }) => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const user = { id: "00000000-0000-0000-0000-000000000001", aud: "authenticated", role: "authenticated", email: "e2e@example.com", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
      sessionStorage.setItem(key, JSON.stringify({ access_token: "e2e.access.token", refresh_token: "e2e-refresh", token_type: "bearer", expires_in: 3600, expires_at: exp, user }));
    }, { key: STORAGE_KEY });
  }
  const page = await context.newPage();

  const seen = { hibp: [], signup: [], userPut: [], userGet: 0 };
  const state = { hibp };

  await page.route(`${APP}/api/**`, (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));

  await page.route("https://api.pwnedpasswords.com/range/*", async (route) => {
    const url = route.request().url();
    seen.hibp.push({ url, headers: route.request().headers() });
    const mode = typeof state.hibp === "function" ? state.hibp() : state.hibp;
    if (mode === "down") return route.abort("connectionrefused");
    const prefix = url.split("/").pop();
    const rows = ["0018A45C4D1DEF81644B54AB7F969B88D65:0"]; // padding
    if (mode === "breached") {
      const h = sha1(BREACHED);
      if (h.startsWith(prefix)) rows.push(`${h.slice(5)}:2254650`);
    }
    return route.fulfill({ status: 200, contentType: "text/plain", headers: { "access-control-allow-origin": "*" }, body: rows.join("\r\n") });
  });

  await page.route(`${SUPABASE}/**`, async (route) => {
    const req = route.request();
    const { pathname } = new URL(req.url());
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" }, body: JSON.stringify(body) });
    if (req.method() === "OPTIONS") return json(204, {});
    const user = { id: "00000000-0000-0000-0000-000000000001", aud: "authenticated", role: "authenticated", email: "e2e@example.com", app_metadata: {}, user_metadata: {}, identities: [{ id: "i" }], created_at: new Date().toISOString() };
    if (pathname.endsWith("/auth/v1/signup")) { seen.signup.push(req.postDataJSON()); return json(200, user); }
    if (pathname.endsWith("/auth/v1/user")) {
      if (req.method() === "PUT") { seen.userPut.push(req.postDataJSON()); return json(200, user); }
      seen.userGet += 1; return json(200, user);
    }
    if (pathname.endsWith("/auth/v1/logout")) return json(204, {});
    if (pathname.includes("/auth/v1/token")) return json(200, { access_token: "e2e.access.token", refresh_token: "e2e-refresh", token_type: "bearer", expires_in: 3600, user });
    if (pathname.includes("/rest/v1/")) return json(200, []);
    return json(200, {});
  });

  return { page, context, seen, state };
}

async function fillStep1(page, password) {
  await page.goto(`${APP}/register`);
  await page.fill("#reg-email", "e2e-new@example.com");
  await page.fill("#reg-password", password);
  await page.fill("#reg-repeat", password);
  await page.getByRole("button", { name: "Continue" }).click();
}

async function fillStep2AndSubmit(page) {
  await page.fill("#reg-username", "e2e_user");
  await page.fill("#reg-dob", "1990-01-01");
  await page.check("#reg-terms");
  await page.getByRole("button", { name: /create account/i }).click();
}

describe("register", () => {
  test("breached password is rejected at step 1 — never reaches step 2, Supabase gets no signup", async () => {
    const { page, context, seen } = await newPage({ hibp: "breached" });
    try {
      await fillStep1(page, BREACHED);
      await page.getByText(/data breach/i).first().waitFor({ timeout: 10_000 });
      assert.equal(await page.locator("#reg-username").count(), 0, "must stay on step 1");
      assert.equal(seen.signup.length, 0, "no /auth/v1/signup request may be made");
    } finally { await context.close(); }
  });

  test("clean password goes through: exactly one signup request carrying that password", async () => {
    const { page, context, seen } = await newPage({ hibp: "clean" });
    try {
      await fillStep1(page, CLEAN);
      await page.waitForSelector("#reg-username", { timeout: 10_000 }); // step 2 only ("About you" also labels the step indicator)
      await fillStep2AndSubmit(page);
      await page.waitForURL(/\/verify-email/, { timeout: 10_000 });
      assert.equal(seen.signup.length, 1);
      assert.equal(seen.signup[0].password, CLEAN);
      assert.equal(seen.signup[0].email, "e2e-new@example.com");
      assert.equal(seen.signup[0].data?.username, "e2e_user"); // metadata payload unchanged
    } finally { await context.close(); }
  });

  test("fail-open: HIBP unreachable → signup still works", async () => {
    const { page, context, seen } = await newPage({ hibp: "down" });
    try {
      await fillStep1(page, BREACHED);
      await page.waitForSelector("#reg-username", { timeout: 10_000 }); // step 2 only ("About you" also labels the step indicator)
      await fillStep2AndSubmit(page);
      await page.waitForURL(/\/verify-email/, { timeout: 10_000 });
      assert.equal(seen.signup.length, 1);
    } finally { await context.close(); }
  });

  test("backstop: if the step-1 check is bypassed/changes its mind, step 2 still blocks the signup", async () => {
    // Clean at step 1, breached by the time the form is submitted (e.g. a stale
    // result, or a future code path that skips step 1).
    const { page, context, seen, state } = await newPage({ hibp: "clean" });
    try {
      await fillStep1(page, BREACHED);
      await page.waitForSelector("#reg-username", { timeout: 10_000 }); // step 2 only ("About you" also labels the step indicator)
      state.hibp = "breached";
      await fillStep2AndSubmit(page);
      await page.getByText(/data breach/i).first().waitFor({ timeout: 10_000 });
      assert.equal(seen.signup.length, 0);
    } finally { await context.close(); }
  });

  test("the browser sends only the 5-char hash prefix to HIBP (and CORS lets it through)", async () => {
    const { page, context, seen } = await newPage({ hibp: "clean" });
    try {
      await fillStep1(page, CLEAN);
      await page.waitForSelector("#reg-username", { timeout: 10_000 }); // step 2 only ("About you" also labels the step indicator)
      assert.ok(seen.hibp.length >= 1, "HIBP should have been queried");
      for (const { url, headers } of seen.hibp) {
        assert.match(url, /^https:\/\/api\.pwnedpasswords\.com\/range\/[0-9A-F]{5}$/);
        assert.equal(headers["add-padding"], "true");
        assert.ok(!url.toLowerCase().includes(CLEAN.toLowerCase()));
        assert.ok(!url.includes(sha1(CLEAN).slice(5)), "hash suffix must not be sent");
      }
    } finally { await context.close(); }
  });

  test("the existing client-side policy still blocks first, with no HIBP call at all", async () => {
    const { page, context, seen } = await newPage({ hibp: "breached" });
    try {
      await fillStep1(page, "short");
      await page.getByText(/Password must include/i).first().waitFor({ timeout: 10_000 });
      assert.equal(seen.hibp.length, 0);
      assert.equal(seen.signup.length, 0);
    } finally { await context.close(); }
  });
});

describe("reset password", () => {
  async function openReset(opts) {
    const h = await newPage({ ...opts, session: true });
    await h.page.goto(`${APP}/reset-password`);
    await h.page.waitForSelector("#new-password:not([disabled])", { timeout: 15_000 });
    return h;
  }
  async function submitNewPassword(page, pw) {
    await page.fill("#new-password", pw);
    await page.fill("#repeat-new-password", pw);
    await page.getByRole("button", { name: /update password/i }).click();
  }

  test("breached new password → message shown, Supabase never sees a password update", async () => {
    const { page, context, seen } = await openReset({ hibp: "breached" });
    try {
      await submitNewPassword(page, BREACHED);
      await page.getByText(/data breach/i).first().waitFor({ timeout: 10_000 });
      assert.equal(seen.userPut.length, 0);
    } finally { await context.close(); }
  });

  test("clean new password → exactly one PUT /auth/v1/user with it", async () => {
    const { page, context, seen } = await openReset({ hibp: "clean" });
    try {
      await submitNewPassword(page, CLEAN);
      await page.waitForURL(/\/login/, { timeout: 15_000 }); // success ⇒ signed out locally, redirected to /login
      assert.equal(seen.userPut.length, 1);
      assert.equal(seen.userPut[0].password, CLEAN);
    } finally { await context.close(); }
  });

  test("fail-open: HIBP unreachable → password update still goes through", async () => {
    const { page, context, seen } = await openReset({ hibp: "down" });
    try {
      await submitNewPassword(page, BREACHED);
      await page.waitForURL(/\/login/, { timeout: 15_000 }); // success ⇒ signed out locally, redirected to /login
      assert.equal(seen.userPut.length, 1);
    } finally { await context.close(); }
  });
});
