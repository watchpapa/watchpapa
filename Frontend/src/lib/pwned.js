// Breached-password check against HaveIBeenPwned's "Pwned Passwords" range API.
//
// Replaces Supabase's Pro-only "leaked password protection". k-anonymity: only
// the first 5 hex chars of the password's SHA-1 leave the browser; the match is
// done locally against the ~800 suffixes HIBP returns. The plaintext password
// and the full hash are never sent.
//
// Fails OPEN — a HIBP outage, timeout or odd response must never block a signup
// or password reset. Pure and dependency-injected (`fetch`) so it's unit-tested
// in plain node (tests/unit/pwned.test.js).

export const PWNED_MESSAGE = "This password has appeared in a known data breach. Please choose a different one.";

const RANGE_URL = "https://api.pwnedpasswords.com/range/";
const DEFAULT_TIMEOUT_MS = 3000;

// Upper-case hex SHA-1 of `text`.
export async function sha1Hex(text) {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

// Breach count for `suffix` in a range response ("SUFFIX:COUNT" lines), 0 if absent.
// With `Add-Padding: true` HIBP appends decoy rows whose count is 0 — those are
// never a hit, so counts <= 0 (and anything unparsable) are ignored.
export function parseRangeResponse(body, suffix) {
  const want = String(suffix).toUpperCase();
  let best = 0;
  for (const line of String(body ?? "").split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i < 0 || line.slice(0, i).trim().toUpperCase() !== want) continue;
    const n = Number.parseInt(line.slice(i + 1).trim(), 10);
    if (Number.isFinite(n) && n > best) best = n;
  }
  return best;
}

// How many times `password` appears in known breaches; 0 when clean OR when the
// check couldn't be completed for any reason (fail-open).
export async function pwnedCount(password, { fetch: fetchImpl, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (typeof password !== "string" || !password) return 0;
  const doFetch = fetchImpl === undefined ? globalThis.fetch : fetchImpl;
  if (typeof doFetch !== "function") return 0;

  let timer;
  try {
    const hash = await sha1Hex(password);
    const controller = new AbortController();

    const request = (async () => {
      const res = await doFetch(`${RANGE_URL}${hash.slice(0, 5)}`, {
        method: "GET",
        headers: { "Add-Padding": "true" },
        signal: controller.signal,
      });
      if (!res.ok) return 0;
      return parseRangeResponse(await res.text(), hash.slice(5));
    })().catch(() => 0);

    // Race a timer as well as aborting: a fetch that ignores the signal must not hang the form.
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => { controller.abort(); resolve(0); }, timeoutMs);
    });

    return await Promise.race([request, timeout]);
  } catch {
    return 0;
  } finally {
    clearTimeout(timer);
  }
}

export async function isPasswordPwned(password, opts) {
  return (await pwnedCount(password, opts)) > 0;
}

// User-facing error message if the password is breached, else null.
export async function pwnedPasswordError(password, opts) {
  return (await isPasswordPwned(password, opts)) ? PWNED_MESSAGE : null;
}
