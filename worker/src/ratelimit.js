// Wraps the Workers Rate Limiting binding. If the binding is absent (e.g. not
// available on the Free plan — in that case add a Cloudflare WAF rate-limiting
// rule on api.watchpapa.tv instead), this middleware is a no-op.

function clientIp(c) {
  return c.req.header("cf-connecting-ip") ?? "0.0.0.0";
}

export function rateLimit(bindingName, keyFn) {
  return async (c, next) => {
    const binding = c.env[bindingName];
    if (binding?.limit) {
      const key = keyFn ? keyFn(c) : clientIp(c);
      try {
        const { success } = await binding.limit({ key });
        if (!success) return c.json({ error: "Too many requests" }, 429);
      } catch {
        // fail open — never let the limiter take the API down
      }
    }
    await next();
  };
}

export const globalRateLimit = rateLimit("RL_GLOBAL", clientIp);
export const mutationRateLimit = rateLimit("RL_MUTATION", (c) => c.get("user")?.id ?? clientIp(c));
