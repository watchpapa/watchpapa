/**
 * Shared TMDB HTTP pacing: sliding window (default 35 req/s vs TMDB 40/s cap)
 * plus bounded retries on 429/503. Use for every themoviedb.org request from scripts.
 */

const WINDOW_MS = 1000;
const MAX_REQUESTS_PER_WINDOW = 35;
const MAX_RATE_LIMIT_RETRIES = 8;

const requestTimestamps = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pruneTimestamps(cutoff) {
  while (requestTimestamps.length > 0 && requestTimestamps[0] < cutoff) {
    requestTimestamps.shift();
  }
}

let acquireChain = Promise.resolve();

function acquireTmdbSlot() {
  const run = acquireChain.then(async () => {
    for (;;) {
      const now = Date.now();
      pruneTimestamps(now - WINDOW_MS);
      if (requestTimestamps.length < MAX_REQUESTS_PER_WINDOW) {
        requestTimestamps.push(now);
        return;
      }
      const waitMs = requestTimestamps[0] + WINDOW_MS - now + 1;
      await sleep(Math.max(0, waitMs));
    }
  });
  acquireChain = run.catch(() => {});
  return run;
}

function parseRetryAfterMs(response) {
  const ra = response.headers.get("retry-after");
  if (!ra) return null;
  const sec = Number(ra);
  if (Number.isFinite(sec) && sec >= 0) return sec * 1000;
  const t = Date.parse(ra);
  if (Number.isFinite(t)) return Math.max(0, t - Date.now());
  return null;
}

/**
 * @param {RequestInfo | URL} url
 * @param {RequestInit} [init]
 * @returns {Promise<Response>}
 */
export async function tmdbRateLimitedFetch(url, init) {
  let rateLimitAttempt = 0;
  for (;;) {
    await acquireTmdbSlot();
    const response = await fetch(url, init);
    if (response.status !== 429 && response.status !== 503) {
      return response;
    }
    if (rateLimitAttempt >= MAX_RATE_LIMIT_RETRIES) {
      return response;
    }
    rateLimitAttempt += 1;
    await response.text().catch(() => {});
    const headerMs = parseRetryAfterMs(response);
    const backoffMs =
      headerMs ?? Math.min(60_000, 1000 * 2 ** rateLimitAttempt);
    await sleep(backoffMs);
  }
}
