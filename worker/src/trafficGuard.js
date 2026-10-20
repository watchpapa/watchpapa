// Pure helpers for the crawler-flood alert (see CONTEXT.md, ShapBot/ExaSearchBot
// incidents): pick User-Agents over the threshold from zone-analytics groups and
// word the Discord message. The runner lives in src/monitors.js.

const WINDOW_MIN = 15;

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
