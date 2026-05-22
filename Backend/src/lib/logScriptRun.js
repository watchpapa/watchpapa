// Used by:
// - Backend/src/routes/inject.js
// - Backend/src/routes/resolve.js
// - Backend/src/routes/admin/resync.js
import sequelize from "../db/database.js";

// Writes a script_logs row with timing and result status.
export async function logScriptRun({ scriptName, status, batchSize = null, errorCode = null, errorDetail = null, startedAt }) {
  const finishedAt = new Date();
  const runtime =
    startedAt != null
      ? Math.max(0, (finishedAt.getTime() - new Date(startedAt).getTime()) / 1000)
      : null;
  try {
    await sequelize.query(
      `INSERT INTO public.script_logs
         (script_name, status, batch_size, error_code, error_detail, started_at, finished_at, runtime)
       VALUES
         (:scriptName, :status, :batchSize, :errorCode, :errorDetail, :startedAt, :finishedAt, :runtime)`,
      {
        replacements: {
          scriptName,
          status,
          batchSize: batchSize ?? null,
          errorCode: errorCode ?? null,
          errorDetail: errorDetail ?? null,
          startedAt: startedAt ?? null,
          finishedAt,
          runtime,
        },
      }
    );
  } catch (logError) {
    console.error("Failed to write script_logs row:", logError.message);
  }
}
