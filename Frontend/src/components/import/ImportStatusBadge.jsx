import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../lib/api.js";
import { readStoredImportJob, clearStoredImportJob, ACTIVE_STATUSES } from "../../lib/importJob.js";

const POLL_MS = 5000;
const DONE_DISPLAY_MS = 8000;

// Small persistent pill showing a background CSV import's progress from
// anywhere in the app (not just /import) — see Frontend/src/lib/importJob.js
// for how the job id survives navigation/reloads, and worker/src/cron.js for
// the job itself. Mounted once in AppLayout.jsx. Self-hides when there's
// nothing to show.
function ImportStatusBadge({ session }) {
  const uid = session?.user?.id ?? null;
  const [jobId, setJobId] = useState(null);
  const [job, setJob] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!uid) return;
    const stored = readStoredImportJob();
    if (stored?.uid === uid && stored.jobId) setJobId(stored.jobId);
  }, [uid]);

  useEffect(() => {
    if (jobId == null || !session) return undefined;
    let alive = true;
    let doneTimer = null;

    const tick = async () => {
      try {
        const data = await apiFetch(`/api/import/jobs/${jobId}`, { session });
        if (!alive) return;
        setJob(data);
        if (!ACTIVE_STATUSES.has(data.status)) {
          clearStoredImportJob();
          doneTimer = setTimeout(() => { if (alive) setJobId(null); }, DONE_DISPLAY_MS);
        }
      } catch {
        /* transient network error — keep polling */
      }
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => { alive = false; clearInterval(id); if (doneTimer) clearTimeout(doneTimer); };
  }, [jobId, session]);

  if (!jobId || !job || dismissed) return null;

  const active = ACTIVE_STATUSES.has(job.status);
  const label = active
    ? `Importing… ${job.done}/${job.total}`
    : job.status === "done"
      ? "Import complete ✓"
      : job.status === "failed"
        ? "Import failed"
        : null;
  if (!label) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-[#2a3570]/60 bg-[#0d0f1e]/95 px-4 py-2 text-xs font-medium text-[#c0c0e8] shadow-lg backdrop-blur">
      <Link to="/import" className="hover:text-white">{label}</Link>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="text-[#5a5a78] hover:text-white"
      >
        ✕
      </button>
    </div>
  );
}

export default ImportStatusBadge;
