import dotenv from "dotenv";
import sequelize from "../db/database.js";

dotenv.config();

const TMDB_JOBS_URL = "https://api.themoviedb.org/3/configuration/jobs";

function getApiKey() {
  const apiKey = process.env.TMDB_API_KEY_SECRET;

  if (!apiKey) {
    throw new Error(
      "Missing TMDB_API_KEY_SECRET in environment. Add it to your .env file."
    );
  }

  return apiKey;
}

async function ensureTable() {
  // Validate required normalized tables exist in the current schema.
  const [departmentTable] = await sequelize.query(`
    SELECT to_regclass('public.department') AS table_name;
  `);
  const [jobTable] = await sequelize.query(`
    SELECT to_regclass('public.job') AS table_name;
  `);

  if (!departmentTable?.[0]?.table_name || !jobTable?.[0]?.table_name) {
    throw new Error(
      "Required tables missing: expected public.department and public.job."
    );
  }
}

async function fetchTmdbJobs(apiKey) {
  const url = new URL(TMDB_JOBS_URL);
  url.searchParams.set("api_key", apiKey);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `TMDB request failed: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const payload = await response.json();
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload.jobs)) {
    return payload.jobs;
  }
  throw new Error(
    "Unexpected TMDB response: expected an array of department job groups."
  );
}

function renderProgressBar(current, total, width = 30) {
  const safeTotal = total > 0 ? total : 1;
  const ratio = Math.min(current / safeTotal, 1);
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  const percent = Math.round(ratio * 100);
  return `[${"#".repeat(filled)}${"-".repeat(empty)}] ${percent}%`;
}

function logProgress(processedDepartments, totalDepartments, processedJobs, totalJobs) {
  const overallDone = processedDepartments + processedJobs;
  const overallTotal = totalDepartments + totalJobs;
  const overallProgress = renderProgressBar(overallDone, overallTotal);
  const line =
    `Ingest ${overallProgress} | ` +
    `Departments ${processedDepartments}/${totalDepartments} | ` +
    `Jobs ${processedJobs}/${totalJobs}`;

  process.stdout.write(`\r${line}`);
}

async function saveJobs(jobsByDepartment, transaction) {
  let insertedDepartments = 0;
  let insertedJobs = 0;
  let processedDepartments = 0;
  let processedJobs = 0;
  const totalDepartments = jobsByDepartment.length;
  const totalJobs = jobsByDepartment.reduce((sum, item) => {
    if (!item?.department || !Array.isArray(item?.jobs)) return sum;
    return sum + item.jobs.filter(Boolean).length;
  }, 0);

  logProgress(processedDepartments, totalDepartments, processedJobs, totalJobs);

  for (const item of jobsByDepartment) {
    const department = item?.department;
    const jobs = item?.jobs;

    if (!department || !Array.isArray(jobs)) {
      processedDepartments += 1;
      logProgress(processedDepartments, totalDepartments, processedJobs, totalJobs);
      continue;
    }

    const [departmentRows] = await sequelize.query(
      `
        SELECT id
        FROM department
        WHERE name = :name
        LIMIT 1;
      `,
      {
        replacements: { name: department },
        transaction,
      }
    );

    let departmentId = departmentRows?.[0]?.id;
    if (!departmentId) {
      const [departmentInsertResult] = await sequelize.query(
        `
          INSERT INTO department (name)
          VALUES (:name)
          RETURNING id;
        `,
        {
          replacements: { name: department },
          transaction,
        }
      );

      departmentId = departmentInsertResult?.[0]?.id;
      if (departmentId) {
        insertedDepartments += 1;
      }
    }

    if (!departmentId) {
      processedDepartments += 1;
      processedJobs += jobs.filter(Boolean).length;
      logProgress(processedDepartments, totalDepartments, processedJobs, totalJobs);
      continue;
    }

    for (const job of jobs) {
      if (!job) continue;

      const [existingJobRows] = await sequelize.query(
        `
          SELECT id
          FROM job
          WHERE name = :name AND department_id = :departmentId
          LIMIT 1;
        `,
        {
          replacements: { name: job, departmentId },
          transaction,
        }
      );

      if (!existingJobRows?.[0]?.id) {
        const [result] = await sequelize.query(
          `
            INSERT INTO job (name, department_id)
            VALUES (:name, :departmentId)
            RETURNING id;
          `,
          {
            replacements: { name: job, departmentId },
            transaction,
          }
        );

        if (Array.isArray(result) && result.length > 0) {
          insertedJobs += 1;
        }
      }

      processedJobs += 1;
      logProgress(processedDepartments, totalDepartments, processedJobs, totalJobs);
    }

    processedDepartments += 1;
    logProgress(processedDepartments, totalDepartments, processedJobs, totalJobs);
  }

  process.stdout.write("\n");
  return { insertedDepartments, insertedJobs };
}

async function seedTmdbJobs() {
  const apiKey = getApiKey();

  try {
    await sequelize.authenticate();
    await ensureTable();

    const jobsByDepartment = await fetchTmdbJobs(apiKey);
    const transaction = await sequelize.transaction();

    try {
      const { insertedDepartments, insertedJobs } = await saveJobs(
        jobsByDepartment,
        transaction
      );
      await transaction.commit();

      console.log(
        `TMDB jobs sync complete. New departments: ${insertedDepartments}, new jobs: ${insertedJobs}`
      );
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } finally {
    await sequelize.close();
  }
}

seedTmdbJobs().catch((error) => {
  console.error("Failed to sync TMDB jobs:", error.message);
  process.exit(1);
});
