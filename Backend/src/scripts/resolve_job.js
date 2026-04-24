import sequelize from "../db/database.js";

function normalizeName(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

export async function findOrCreateDepartmentId(rawName, transaction) {
  const name = normalizeName(rawName);
  if (!name) return null;

  const [rows] = await sequelize.query(
    `
      SELECT id
      FROM department
      WHERE LOWER(name) = LOWER(:name)
      LIMIT 1;
    `,
    { replacements: { name }, transaction }
  );

  const existingId = rows?.[0]?.id ?? null;
  if (existingId) return existingId;

  const [inserted] = await sequelize.query(
    `
      INSERT INTO department (name)
      VALUES (:name)
      RETURNING id;
    `,
    { replacements: { name }, transaction }
  );

  return inserted?.[0]?.id ?? null;
}

// Resolve a job id by name across all departments (case-insensitive), falling
// back to department-based disambiguation only when duplicates exist, and
// creating a new job in the supplied department when no global match is found.
export async function resolveOrCreateJobId(
  rawJobName,
  rawDepartmentName,
  jobCache,
  transaction
) {
  const jobName = normalizeName(rawJobName);
  const departmentName = normalizeName(rawDepartmentName);
  if (!jobName) return null;

  const jobLower = jobName.toLowerCase();
  const deptLower = departmentName.toLowerCase();
  const ambigKey = `${jobLower}||${deptLower}`;

  if (jobCache?.has(jobLower)) return jobCache.get(jobLower);
  if (jobCache?.has(ambigKey)) return jobCache.get(ambigKey);

  const [rows] = await sequelize.query(
    `
      SELECT j.id AS job_id, d.name AS department_name
      FROM job j
      JOIN department d ON d.id = j.department_id
      WHERE LOWER(j.name) = LOWER(:jobName);
    `,
    { replacements: { jobName }, transaction }
  );
  const matches = Array.isArray(rows) ? rows : [];

  if (matches.length === 1) {
    const jobId = matches[0].job_id ?? null;
    if (jobCache && jobId != null) jobCache.set(jobLower, jobId);
    return jobId;
  }

  if (matches.length > 1) {
    const picked = deptLower
      ? matches.find(
          (row) => (row.department_name ?? "").toLowerCase() === deptLower
        )
      : null;
    const jobId = picked?.job_id ?? null;
    if (jobCache) jobCache.set(ambigKey, jobId);
    return jobId;
  }

  if (!departmentName) return null;

  const departmentId = await findOrCreateDepartmentId(departmentName, transaction);
  if (!departmentId) return null;

  const [insertRows] = await sequelize.query(
    `
      INSERT INTO job (name, department_id)
      VALUES (:jobName, :departmentId)
      RETURNING id;
    `,
    { replacements: { jobName, departmentId }, transaction }
  );

  const jobId = insertRows?.[0]?.id ?? null;
  if (jobCache && jobId != null) jobCache.set(jobLower, jobId);
  return jobId;
}
