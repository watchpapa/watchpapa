import { useEffect, useRef, useState } from "react";
import { adminFetch } from "../../features/admin/adminFetch.js";

const POLL_MS = 3000;

export default function QueuePage() {
  const [queue, setQueue] = useState(null);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const intervalRef = useRef(null);

  const load = async () => {
    try {
      const data = await adminFetch("/api/admin/stats/queue");
      setQueue(data);
      setError(null);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e.message ?? "Failed to load queue");
    }
  };

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, POLL_MS);
    return () => clearInterval(intervalRef.current);
  }, []);

  const movieJobs = queue?.jobs.filter((j) => j.startsWith("movie:")) ?? [];
  const otherJobs = queue?.jobs.filter((j) => !j.startsWith("movie:")) ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Injection Queue</h1>
          <p className="mt-0.5 text-xs text-[#6868b8]">
            Live view of in-process ingest jobs — polls every {POLL_MS / 1000}s. Resets on server restart.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-[#4a4a8a]">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${
            queue === null
              ? "bg-[#1a1f3a] text-[#4a4a8a]"
              : queue.count > 0
              ? "bg-emerald-900/40 text-emerald-400"
              : "bg-[#1a1f3a] text-[#5a5a8a]"
          }`}>
            {queue === null ? "…" : `${queue.count} running`}
          </span>
        </div>
      </div>

      {queue === null && !error ? (
        <p className="text-sm text-[#6868b8]">Loading…</p>
      ) : error ? (
        <p className="text-sm text-rose-400">{error}</p>
      ) : queue.count === 0 ? (
        <div className="rounded-2xl border border-[#1e244a] bg-[#0e1128] px-6 py-10 text-center">
          <p className="text-sm text-[#5a5a8a]">No active ingest jobs right now.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {movieJobs.length > 0 && (
            <div className="rounded-2xl border border-[#1e244a] bg-[#0e1128] p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#4a4a8a]">
                Movies <span className="ml-1 text-[#6868b8]">{movieJobs.length}</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {movieJobs.map((job) => {
                  const tmdbId = job.replace("movie:", "");
                  return (
                    <span
                      key={job}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#1a1f3a] px-2.5 py-1 font-mono text-[11px] text-[#8080c0]"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {tmdbId}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {otherJobs.length > 0 && (
            <div className="rounded-2xl border border-[#1e244a] bg-[#0e1128] p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#4a4a8a]">
                Other <span className="ml-1 text-[#6868b8]">{otherJobs.length}</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {otherJobs.map((job) => (
                  <span
                    key={job}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#1a1f3a] px-2.5 py-1 font-mono text-[11px] text-[#8080c0]"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
                    {job}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
