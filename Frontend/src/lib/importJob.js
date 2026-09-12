// Shared between ImportPage.jsx (starts/polls the job it kicked off) and
// ImportStatusBadge.jsx (polls whatever job is in flight from any page) so an
// import survives navigating away or closing the tab — the job itself runs in
// the Worker/cron (see worker/src/cron.js), this is just how the browser
// finds it again.
export const IMPORT_JOB_STORAGE_KEY = "wp_import_job";

export function readStoredImportJob() {
  try {
    const raw = localStorage.getItem(IMPORT_JOB_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeStoredImportJob(jobId, uid) {
  try {
    localStorage.setItem(IMPORT_JOB_STORAGE_KEY, JSON.stringify({ jobId, uid }));
  } catch {
    /* best-effort */
  }
}

export function clearStoredImportJob() {
  try {
    localStorage.removeItem(IMPORT_JOB_STORAGE_KEY);
  } catch {
    /* best-effort */
  }
}

export const ACTIVE_STATUSES = new Set(["pending", "resolving", "committing"]);
