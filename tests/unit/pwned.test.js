/**
 * Breached-password (HaveIBeenPwned) check — Frontend/src/lib/pwned.js
 *
 * Replaces Supabase's Pro-only "leaked password protection". Pure logic, `fetch`
 * is injected, so these run with no network, no DOM and no Supabase.
 *
 *   npm run test:unit
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  PWNED_MESSAGE,
  isPasswordPwned,
  parseRangeResponse,
  pwnedCount,
  pwnedPasswordError,
  sha1Hex,
} from "../../Frontend/src/lib/pwned.js";

// SHA-1("password") — the canonical HIBP example.
const PASSWORD_SHA1 = "5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8";
const PREFIX = PASSWORD_SHA1.slice(0, 5); // 5BAA6
const SUFFIX = PASSWORD_SHA1.slice(5); //    1E4C9B93F3F0682250B6CF8331B7EE68FD8

// Build a fake fetch that records every call and replies with `body`.
function fakeFetch(body, { status = 200 } = {}) {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return new Response(body, { status });
  };
  fn.calls = calls;
  return fn;
}

// A range response that contains the "password" suffix with a big count.
const HIT_BODY = [
  "0018A45C4D1DEF81644B54AB7F969B88D65:1",
  `${SUFFIX}:10434004`,
  "011053FD0102E94D6AE2F8B83D76FAF94F6:1",
].join("\r\n");

const MISS_BODY = [
  "0018A45C4D1DEF81644B54AB7F969B88D65:1",
  "011053FD0102E94D6AE2F8B83D76FAF94F6:7",
].join("\r\n");

describe("sha1Hex", () => {
  test("matches the known SHA-1 vector, upper-case hex", async () => {
    assert.equal(await sha1Hex("password"), PASSWORD_SHA1);
  });

  test("is 40 hex chars for any input, incl. empty and unicode", async () => {
    for (const input of ["", "pässwörd-日本語-🔐", "a".repeat(5000)]) {
      assert.match(await sha1Hex(input), /^[0-9A-F]{40}$/);
    }
  });

  test("known empty-string vector", async () => {
    assert.equal(await sha1Hex(""), "DA39A3EE5E6B4B0D3255BFEF95601890AFD80709");
  });
});

describe("parseRangeResponse", () => {
  test("returns the count for a matching suffix", () => {
    assert.equal(parseRangeResponse(HIT_BODY, SUFFIX), 10434004);
  });

  test("returns 0 when the suffix is absent", () => {
    assert.equal(parseRangeResponse(MISS_BODY, SUFFIX), 0);
  });

  test("matches case-insensitively", () => {
    assert.equal(parseRangeResponse(HIT_BODY.toLowerCase(), SUFFIX), 10434004);
    assert.equal(parseRangeResponse(HIT_BODY, SUFFIX.toLowerCase()), 10434004);
  });

  test("handles both CRLF and LF line endings", () => {
    assert.equal(parseRangeResponse(HIT_BODY.replaceAll("\r\n", "\n"), SUFFIX), 10434004);
  });

  test("IGNORES padding rows (count 0) — a padded decoy must not flag a password", () => {
    // With `Add-Padding: true` HIBP appends fake suffixes with a count of 0.
    // If our own suffix shows up as padding it is NOT a breach hit.
    const padded = `${MISS_BODY}\r\n${SUFFIX}:0\r\n`;
    assert.equal(parseRangeResponse(padded, SUFFIX), 0);
  });

  test("empty / garbage bodies never throw and report no hit", () => {
    for (const body of ["", "\r\n\r\n", "not a range response", ":::", `${SUFFIX}`, `${SUFFIX}:abc`]) {
      assert.equal(parseRangeResponse(body, SUFFIX), 0, JSON.stringify(body));
    }
  });
});

describe("pwnedCount / isPasswordPwned — request shape (k-anonymity)", () => {
  test("sends ONLY the 5-char prefix, to the range endpoint", async () => {
    const fetch = fakeFetch(HIT_BODY);
    await pwnedCount("password", { fetch });
    assert.equal(fetch.calls.length, 1);
    assert.equal(fetch.calls[0].url, `https://api.pwnedpasswords.com/range/${PREFIX}`);
  });

  test("the plaintext, the full hash and the hash suffix never leave the client", async () => {
    const fetch = fakeFetch(MISS_BODY);
    await pwnedCount("password", { fetch });
    const { url, init } = fetch.calls[0];
    // Everything that leaves the client except the (constant) host name, which itself contains "password".
    const { pathname, search } = new URL(url);
    const everything = JSON.stringify({ pathname, search, init: { ...init, signal: undefined } }).toUpperCase();
    assert.ok(!everything.includes("PASSWORD"), "plaintext leaked");
    assert.ok(!everything.includes(PASSWORD_SHA1), "full hash leaked");
    assert.ok(!everything.includes(SUFFIX), "hash suffix leaked");
    assert.equal(init.body, undefined, "must be a body-less GET");
    assert.ok((init.method ?? "GET").toUpperCase() === "GET");
  });

  test("asks HIBP to pad the response (Add-Padding: true)", async () => {
    const fetch = fakeFetch(MISS_BODY);
    await pwnedCount("password", { fetch });
    const headers = new Headers(fetch.calls[0].init.headers);
    assert.equal(headers.get("add-padding"), "true");
  });

  test("passes an AbortSignal so a hung request can be cancelled", async () => {
    const fetch = fakeFetch(MISS_BODY);
    await pwnedCount("password", { fetch });
    assert.ok(fetch.calls[0].init.signal instanceof AbortSignal);
  });

  test("empty password: no request, not pwned", async () => {
    const fetch = fakeFetch(HIT_BODY);
    assert.equal(await isPasswordPwned("", { fetch }), false);
    assert.equal(await isPasswordPwned(undefined, { fetch }), false);
    assert.equal(fetch.calls.length, 0);
  });
});

describe("pwnedCount / isPasswordPwned — results", () => {
  test("breached password → count + true", async () => {
    const fetch = fakeFetch(HIT_BODY);
    assert.equal(await pwnedCount("password", { fetch }), 10434004);
    assert.equal(await isPasswordPwned("password", { fetch }), true);
  });

  test("clean password → 0 + false", async () => {
    const fetch = fakeFetch(MISS_BODY);
    assert.equal(await pwnedCount("password", { fetch }), 0);
    assert.equal(await isPasswordPwned("password", { fetch }), false);
  });
});

describe("fail-open — HIBP trouble must never block a signup", () => {
  test("network error", async () => {
    const fetch = async () => { throw new TypeError("Failed to fetch"); };
    assert.equal(await isPasswordPwned("password", { fetch }), false);
    assert.equal(await pwnedPasswordError("password", { fetch }), null);
  });

  for (const status of [429, 500, 503, 404]) {
    test(`HTTP ${status}`, async () => {
      // Body even contains a "hit" — a non-2xx response must still be ignored.
      const fetch = fakeFetch(HIT_BODY, { status });
      assert.equal(await isPasswordPwned("password", { fetch }), false);
    });
  }

  test("malformed 200 body", async () => {
    const fetch = fakeFetch("<html>captive portal</html>");
    assert.equal(await isPasswordPwned("password", { fetch }), false);
  });

  test("fetch that honours the abort signal → resolves false at the timeout", async () => {
    const fetch = (_url, { signal }) =>
      new Promise((_, reject) => signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))));
    const t0 = Date.now();
    assert.equal(await isPasswordPwned("password", { fetch, timeoutMs: 60 }), false);
    assert.ok(Date.now() - t0 < 1000, "should return promptly after the timeout");
  });

  test("fetch that IGNORES the abort signal and never settles → still resolves false", async () => {
    const fetch = () => new Promise(() => {});
    const t0 = Date.now();
    assert.equal(await isPasswordPwned("password", { fetch, timeoutMs: 60 }), false);
    assert.ok(Date.now() - t0 < 1000);
  });

  test("never throws even if sha1 input is weird", async () => {
    const fetch = fakeFetch(MISS_BODY);
    await assert.doesNotReject(() => isPasswordPwned(12345, { fetch }));
    await assert.doesNotReject(() => isPasswordPwned(null, { fetch }));
  });

  test("an explicit null fetch (no fetch available) skips the check instead of crashing", async () => {
    assert.equal(await isPasswordPwned("password", { fetch: null, timeoutMs: 50 }), false);
  });
});

describe("pwnedPasswordError", () => {
  test("returns the user-facing message on a hit", async () => {
    const fetch = fakeFetch(HIT_BODY);
    assert.equal(await pwnedPasswordError("password", { fetch }), PWNED_MESSAGE);
  });

  test("returns null for a clean password", async () => {
    const fetch = fakeFetch(MISS_BODY);
    assert.equal(await pwnedPasswordError("password", { fetch }), null);
  });

  test("message tells the user what to do and mentions a data breach", () => {
    assert.match(PWNED_MESSAGE, /data breach/i);
    assert.match(PWNED_MESSAGE, /different/i);
  });
});

// Optional contract test against the real service. Skips quietly when offline
// (CI sandboxes, airplane mode) so it can never make the suite flaky.
describe("live HIBP contract (skips when offline)", () => {
  test("'password' is breached, a random 40-char string is not", async (t) => {
    try {
      const res = await fetch("https://api.pwnedpasswords.com/range/00000", { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return t.skip(`HIBP returned ${res.status}`);
    } catch {
      return t.skip("HIBP unreachable");
    }
    assert.ok((await pwnedCount("password")) > 1_000_000);
    const random = Array.from(crypto.getRandomValues(new Uint8Array(20)), (b) => b.toString(16).padStart(2, "0")).join("");
    assert.equal(await pwnedCount(`${random}-Zq!9`), 0);
  });
});
