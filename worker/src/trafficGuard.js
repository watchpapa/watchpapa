// Quick-alert guard against crawler floods (see CONTEXT.md, ShapBot/ExaSearchBot
// incidents). Runs from the once-a-minute Cron Trigger, but only every 10th
// minute: asks Cloudflare's zone analytics which User-Agents sent the most
// requests in the last 15 minutes (ignoring ones the WAF already blocked with
// 403) and posts to a Discord/Slack webhook when one passes the threshold.
// Alert-only — blocking stays a manual WAF edit. No-ops until both secrets
// (CF_ANALYTICS_TOKEN, ALERT_WEBHOOK_URL) are set.

const WINDOW_MIN = 15;
const ALERT_COOLDOWN_S = 3600;

export function shouldRunGuard(scheduledTime) {
  return new Date(scheduledTime).getUTCMinutes() % 10 === 0;
}

export function findNoisyAgents(groups, threshold) {
  return (groups ?? [])
    .map((g) => ({ ua: g.dimensions?.userAgent ?? "", count: g.count ?? 0 }))
    .filter((g) => g.count >= threshold)
    .sort((a, b) => b.count - a.count);
}

export function buildAlertText(agents, { threshold }) {
  const lines = agents.map((a) => `• ${a.count} requests in ${WINDOW_MIN} min — ${a.ua.slice(0, 120) || "(empty user agent)"}`);
  const ua = agents[0].ua;
  const botName = ua.match(/[A-Za-z][A-Za-z0-9_-]*Bot[A-Za-z0-9_-]*|crawler[\w.-]*/i)?.[0];
  const expr = !ua ? '(http.user_agent eq "")' : `(http.user_agent contains "${botName ?? ua.slice(0, 40)}")`;
  return [
    `⚠️ watchpapa traffic spike (≥${threshold} unblocked requests / ${WINDOW_MIN} min from one user agent):`,
    ...lines,
    `If it isn't a crawler you want (Googlebot/Bing are fine), add it in Cloudflare → watchpapa.tv → Security → Security rules, e.g.:`,
    expr,
  ].join("\n");
}

async function fetchTopAgents(env, since, until) {
  const query = `{viewer{zones(filter:{zoneTag:"${env.CF_ZONE_ID}"}){httpRequestsAdaptiveGroups(limit:5,orderBy:[count_DESC],filter:{datetime_geq:"${since}",datetime_leq:"${until}",edgeResponseStatus_neq:403}){count dimensions{userAgent}}}}}`;
  const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: { authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`analytics HTTP ${res.status}`);
  const body = await res.json();
  if (body.errors?.length) throw new Error(`analytics: ${body.errors[0].message}`);
  return body.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups ?? [];
}

// Best-effort de-dupe (Cache API is per-colo): same alert at most once an hour.
async function alreadyAlerted(key) {
  const cache = caches.default;
  const req = new Request(`https://traffic-guard.invalid/${encodeURIComponent(key)}`);
  if (await cache.match(req)) return true;
  await cache.put(req, new Response("1", { headers: { "cache-control": `max-age=${ALERT_COOLDOWN_S}` } }));
  return false;
}

export async function runTrafficGuard(env, now = Date.now()) {
  if (!env.CF_ANALYTICS_TOKEN || !env.ALERT_WEBHOOK_URL || !env.CF_ZONE_ID) return;
  const threshold = Number.parseInt(env.TRAFFIC_ALERT_THRESHOLD, 10) || 1500;
  try {
    const until = new Date(now).toISOString();
    const since = new Date(now - WINDOW_MIN * 60_000).toISOString();
    const noisy = findNoisyAgents(await fetchTopAgents(env, since, until), threshold);
    if (!noisy.length || (await alreadyAlerted(noisy[0].ua))) return;
    const text = buildAlertText(noisy, { threshold });
    // `content` = Discord, `text` = Slack; each ignores the other's field.
    await fetch(env.ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: text, text }),
    });
  } catch (e) {
    console.error("[TRAFFIC_GUARD]", e?.message);
  }
}
