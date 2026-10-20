// Shared plumbing for the Discord/Slack alert monitors (src/monitors.js).

// `content` = Discord, `text` = Slack; each ignores the other's field.
export async function sendAlert(env, text) {
  if (!env.ALERT_WEBHOOK_URL) return;
  await fetch(env.ALERT_WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content: text, text }),
  });
}

// Best-effort de-dupe (Cache API is per-colo): true if `key` was already alerted
// within `ttlSeconds`; otherwise records it and returns false.
export async function alreadyAlerted(key, ttlSeconds = 3600) {
  const cache = caches.default;
  const req = new Request(`https://alerts.invalid/${encodeURIComponent(key)}`);
  if (await cache.match(req)) return true;
  await cache.put(req, new Response("1", { headers: { "cache-control": `max-age=${ttlSeconds}` } }));
  return false;
}

export async function cfGraphql(env, query) {
  const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: { authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`analytics HTTP ${res.status}`);
  const body = await res.json();
  if (body.errors?.length) throw new Error(`analytics: ${body.errors[0].message}`);
  return body.data;
}
