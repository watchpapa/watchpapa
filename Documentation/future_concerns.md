# Future Concerns

## TMDB Rate Limiter Scope (Per-Process)

The one gap: it's still per-process.

The `requestTimestamps` array and `acquireChain` are module-level singletons, so they have the same boundary as the dedup map — they only work within a single Node process.

If you ever run multiple web server instances behind a load balancer, each process gets its own 35 req/s budget, and together they could exceed TMDB's limit.

For a single-server deployment this is a non-issue.
