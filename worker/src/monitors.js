import { getSqlFromEnv } from "./db.js";
import { sendAlert, alreadyAlerted, cfGraphql } from "./alerts.js";
import { findNoisyAgents, buildAlertText, shouldRunGuard } from "./trafficGuard.js";

// Alert-only monitors, called from the Worker's `scheduled` handler on every 10th
// minute (see CONTEXT.md "Alerts"). All post to the Discord/Slack webhook
// (ALERT_WEBHOOK_URL) and no-op until their secrets exist:
//   • traffic spike  — one User-Agent over TRAFFIC_ALERT_THRESHOLD in 15 min
//   • quota warning  — estimated Workers/Pages requests today vs the Free 100k/day
//   • API errors     — ≥ ERROR_ALERT_THRESHOLD 5xx from api.watchpapa.tv in 15 min
//   • new signups    — registrations in the last 10 min (username + provider only, no email)
// The three analytics monitors share ONE GraphQL subrequest (the cron tick also
// runs the import job under the Free plan's 50-subrequest cap).

export const shouldRunMonitors = shouldRunGuard;

const FREE_DAILY_LIMIT = 100_000;
const DEFAULT_QUOTA_LEVELS = [50_000, 80_000];

function posInt(raw, fallback) {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function quotaLevels(raw) {
  const parsed = String(raw ?? "")
    .split(",")
    .map((x) => Number.parseInt(x, 10))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  return parsed.length ? parsed : DEFAULT_QUOTA_LEVELS;
}

// Billed-request estimate for the UTC day so far: every request to the Worker
// (api host) + HTML page loads that hit the Pages Function (assets are excluded
// by _routes.json) + the 1/min cron. Adaptive analytics are sampled → approximate.
export function estimateQuotaUse({ api, html, now }) {
  const d = new Date(now);
  const minutesToday = d.getUTCHours() * 60 + d.getUTCMinutes();
  return (api ?? 0) + (html ?? 0) + minutesToday;
}

export function highestLevelReached(used, levels) {
  return [...levels].reverse().find((l) => used >= l) ?? null;
}

export function buildQuotaText(used, level) {
  const pct = Math.round((used / FREE_DAILY_LIMIT) * 100);
  return `📈 watchpapa request quota: ~${used.toLocaleString("en-US")} of ${FREE_DAILY_LIMIT.toLocaleString("en-US")} today (${pct}%, crossed ${level.toLocaleString("en-US")}). Estimate from zone analytics, resets 00:00 UTC. Check Security → Analytics grouped by user agent for the source.`;
}

export function buildErrorText(groups, threshold) {
  const total = groups.reduce((n, g) => n + (g.count ?? 0), 0);
  const by = groups.map((g) => `${g.dimensions?.edgeResponseStatus}: ${g.count}`).join(", ");
  return `🔥 api.watchpapa.tv returned ${total} 5xx responses in the last 15 min (≥${threshold}) — ${by}. Likely TMDB/Supabase trouble or a Worker error: run \`wrangler tail watchpapa-api\`.`;
}

export function buildSignupText(rows) {
  const total = rows[0]?.total;
  const count = rows[0]?.window_count ?? rows.length;
  const lines = rows.map((r) => `• ${r.username ?? "(username not chosen yet)"} via ${r.provider ?? "unknown"}`);
  const more = count > rows.length ? `\n…and ${count - rows.length} more` : "";
  return `🎉 ${count} new watchpapa registration${count === 1 ? "" : "s"}:\n${lines.join("\n")}${more}\nTotal users: ${total}`;
}

function analyticsQuery(env, now) {
  const until = new Date(now).toISOString();
  const since = new Date(now - 15 * 60_000).toISOString();
  const dayStart = new Date(Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate())).toISOString();
  const z = `zoneTag:"${env.CF_ZONE_ID}"`;
  const win = `datetime_geq:"${since}",datetime_leq:"${until}"`;
  const day = `datetime_geq:"${dayStart}",datetime_leq:"${until}"`;
  return `{viewer{zones(filter:{${z}}){
    agents: httpRequestsAdaptiveGroups(limit:5,orderBy:[count_DESC],filter:{${win},edgeResponseStatus_neq:403}){count dimensions{userAgent}}
    apiToday: httpRequestsAdaptiveGroups(limit:1,filter:{${day},clientRequestHTTPHost:"api.watchpapa.tv",edgeResponseStatus_neq:403}){count}
    htmlToday: httpRequestsAdaptiveGroups(limit:1,filter:{${day},clientRequestHTTPHost:"watchpapa.tv",edgeResponseContentTypeName:"html",edgeResponseStatus_neq:403}){count}
    errors: httpRequestsAdaptiveGroups(limit:10,filter:{${win},clientRequestHTTPHost:"api.watchpapa.tv",edgeResponseStatus_geq:500}){count dimensions{edgeResponseStatus}}
  }}}`;
}

async function runAnalyticsMonitors(env, now) {
  if (!env.CF_ANALYTICS_TOKEN || !env.CF_ZONE_ID) return;
  const zone = (await cfGraphql(env, analyticsQuery(env, now)))?.viewer?.zones?.[0];
  if (!zone) return;

  const trafficThreshold = posInt(env.TRAFFIC_ALERT_THRESHOLD, 1500);
  const noisy = findNoisyAgents(zone.agents, trafficThreshold);
  if (noisy.length && !(await alreadyAlerted(`agent:${noisy[0].ua}`))) {
    await sendAlert(env, buildAlertText(noisy, { threshold: trafficThreshold }));
  }

  const used = estimateQuotaUse({ api: zone.apiToday?.[0]?.count, html: zone.htmlToday?.[0]?.count, now });
  const level = highestLevelReached(used, quotaLevels(env.QUOTA_ALERT_LEVELS));
  const day = new Date(now).toISOString().slice(0, 10);
  if (level && !(await alreadyAlerted(`quota:${day}:${level}`, 86_400))) {
    await sendAlert(env, buildQuotaText(used, level));
  }

  const errorThreshold = posInt(env.ERROR_ALERT_THRESHOLD, 15);
  const errors = zone.errors ?? [];
  if (errors.reduce((n, g) => n + (g.count ?? 0), 0) >= errorThreshold && !(await alreadyAlerted("api-errors"))) {
    await sendAlert(env, buildErrorText(errors, errorThreshold));
  }
}

// Deterministic, non-overlapping 10-minute windows keyed to the cron's scheduled
// time → no cursor to store; a skipped tick just skips that window's alert.
async function runSignupMonitor(env, now) {
  if (!env.HYPERDRIVE) return;
  const until = new Date(Math.floor(now / 60_000) * 60_000);
  const since = new Date(until.getTime() - 10 * 60_000);
  const sql = getSqlFromEnv(env);
  try {
    const rows = await sql`
      SELECT u.created_at, p.username, u.raw_app_meta_data->>'provider' AS provider,
             count(*) OVER () AS window_count,
             (SELECT count(*) FROM auth.users) AS total
      FROM auth.users u
      LEFT JOIN public.profile p ON p.id = u.id
      WHERE u.created_at >= ${since.toISOString()}::timestamptz
        AND u.created_at <  ${until.toISOString()}::timestamptz
      ORDER BY u.created_at
      LIMIT 10`;
    if (rows.length) await sendAlert(env, buildSignupText(rows));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export async function runMonitors(env, now = Date.now()) {
  if (!env.ALERT_WEBHOOK_URL) return;
  const results = await Promise.allSettled([runAnalyticsMonitors(env, now), runSignupMonitor(env, now)]);
  for (const r of results) if (r.status === "rejected") console.error("[MONITORS]", r.reason?.message);
}
