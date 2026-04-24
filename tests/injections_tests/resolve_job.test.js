import test from "node:test";
import assert from "node:assert/strict";

import sequelize from "../../Backend/src/db/database.js";
import {
  resolveOrCreateJobId,
  findOrCreateDepartmentId,
} from "../../Backend/src/scripts/resolve_job.js";
import { withPatchedMethod } from "./helpers/patch.js";

function matchesJobLookup(sql) {
  return (
    sql.includes("FROM job j") &&
    sql.includes("JOIN department d") &&
    sql.includes("LOWER(j.name) = LOWER(:jobName)")
  );
}

function matchesDeptSelect(sql) {
  return (
    sql.includes("FROM department") &&
    sql.includes("LOWER(name) = LOWER(:name)")
  );
}

function matchesDeptInsert(sql) {
  return sql.includes("INSERT INTO department");
}

function matchesJobInsert(sql) {
  return sql.includes("INSERT INTO job");
}

test("resolveOrCreateJobId returns unique global match regardless of department", async () => {
  const fakeTx = { id: "tx" };
  const calls = [];

  await withPatchedMethod(
    sequelize,
    "query",
    async (sql, options) => {
      calls.push({ sql, options });
      if (matchesJobLookup(sql)) {
        return [[{ job_id: 77, department_name: "Sound" }]];
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
    async () => {
      const cache = new Map();
      const jobId = await resolveOrCreateJobId(
        "Sound Recordist",
        "Crew",
        cache,
        fakeTx
      );
      assert.equal(jobId, 77);
      assert.equal(cache.get("sound recordist"), 77);
      assert.equal(calls.length, 1);
    }
  );
});

test("resolveOrCreateJobId matches case-insensitively when DB name differs in casing", async () => {
  await withPatchedMethod(
    sequelize,
    "query",
    async (sql) => {
      if (matchesJobLookup(sql)) {
        return [[{ job_id: 88, department_name: "Sound" }]];
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
    async () => {
      const cache = new Map();
      const jobId = await resolveOrCreateJobId(
        "Sound mixer",
        "Sound",
        cache,
        { id: "tx" }
      );
      assert.equal(jobId, 88);
    }
  );
});

test("resolveOrCreateJobId disambiguates duplicate jobs by department (case-insensitive)", async () => {
  await withPatchedMethod(
    sequelize,
    "query",
    async (sql) => {
      if (matchesJobLookup(sql)) {
        return [
          [
            { job_id: 11, department_name: "Crew" },
            { job_id: 22, department_name: "Production" },
            { job_id: 33, department_name: "Sound" },
          ],
        ];
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
    async () => {
      const cache = new Map();
      const jobId = await resolveOrCreateJobId("Other", "sound", cache, {
        id: "tx",
      });
      assert.equal(jobId, 33);
      assert.equal(cache.get("other||sound"), 33);
    }
  );
});

test("resolveOrCreateJobId returns null for ambiguous duplicates with no matching department", async () => {
  await withPatchedMethod(
    sequelize,
    "query",
    async (sql) => {
      if (matchesJobLookup(sql)) {
        return [
          [
            { job_id: 11, department_name: "Crew" },
            { job_id: 22, department_name: "Production" },
          ],
        ];
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
    async () => {
      const cache = new Map();
      const jobId = await resolveOrCreateJobId(
        "Other",
        "NonExistent",
        cache,
        { id: "tx" }
      );
      assert.equal(jobId, null);
      assert.equal(cache.get("other||nonexistent"), null);
    }
  );
});

test("resolveOrCreateJobId creates department and job when missing globally", async () => {
  const steps = [];
  await withPatchedMethod(
    sequelize,
    "query",
    async (sql) => {
      if (matchesJobLookup(sql)) {
        steps.push("job_lookup");
        return [[]];
      }
      if (matchesDeptSelect(sql)) {
        steps.push("dept_select");
        return [[]];
      }
      if (matchesDeptInsert(sql)) {
        steps.push("dept_insert");
        return [[{ id: 500 }]];
      }
      if (matchesJobInsert(sql)) {
        steps.push("job_insert");
        return [[{ id: 900 }]];
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
    async () => {
      const cache = new Map();
      const jobId = await resolveOrCreateJobId(
        "Mood Supervisor",
        "Vibes",
        cache,
        { id: "tx" }
      );
      assert.equal(jobId, 900);
      assert.equal(cache.get("mood supervisor"), 900);
      assert.deepEqual(steps, [
        "job_lookup",
        "dept_select",
        "dept_insert",
        "job_insert",
      ]);
    }
  );
});

test("resolveOrCreateJobId reuses an existing department when creating a new job", async () => {
  const steps = [];
  await withPatchedMethod(
    sequelize,
    "query",
    async (sql) => {
      if (matchesJobLookup(sql)) {
        steps.push("job_lookup");
        return [[]];
      }
      if (matchesDeptSelect(sql)) {
        steps.push("dept_select");
        return [[{ id: 501 }]];
      }
      if (matchesDeptInsert(sql)) {
        steps.push("dept_insert");
        throw new Error("Should not insert department when one exists");
      }
      if (matchesJobInsert(sql)) {
        steps.push("job_insert");
        return [[{ id: 901 }]];
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
    async () => {
      const cache = new Map();
      const jobId = await resolveOrCreateJobId(
        "New Role",
        "Production",
        cache,
        { id: "tx" }
      );
      assert.equal(jobId, 901);
      assert.deepEqual(steps, ["job_lookup", "dept_select", "job_insert"]);
    }
  );
});

test("resolveOrCreateJobId caches unique matches and avoids repeat DB queries", async () => {
  let queryCount = 0;
  await withPatchedMethod(
    sequelize,
    "query",
    async (sql) => {
      queryCount += 1;
      if (matchesJobLookup(sql)) {
        return [[{ job_id: 42, department_name: "Sound" }]];
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
    async () => {
      const cache = new Map();
      const first = await resolveOrCreateJobId("Sound Mixer", "Sound", cache, {
        id: "tx",
      });
      const second = await resolveOrCreateJobId(
        "sound mixer",
        "SomethingElse",
        cache,
        { id: "tx" }
      );
      assert.equal(first, 42);
      assert.equal(second, 42);
      assert.equal(queryCount, 1);
    }
  );
});

test("resolveOrCreateJobId returns null when no match and no department is provided", async () => {
  await withPatchedMethod(
    sequelize,
    "query",
    async (sql) => {
      if (matchesJobLookup(sql)) return [[]];
      throw new Error(`Unexpected query: ${sql}`);
    },
    async () => {
      const jobId = await resolveOrCreateJobId(
        "Unlisted Role",
        "",
        new Map(),
        { id: "tx" }
      );
      assert.equal(jobId, null);
    }
  );
});

test("findOrCreateDepartmentId returns existing id case-insensitively", async () => {
  let inserted = false;
  await withPatchedMethod(
    sequelize,
    "query",
    async (sql) => {
      if (matchesDeptSelect(sql)) return [[{ id: 777 }]];
      if (matchesDeptInsert(sql)) {
        inserted = true;
        return [[{ id: 999 }]];
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
    async () => {
      const id = await findOrCreateDepartmentId("acting", { id: "tx" });
      assert.equal(id, 777);
      assert.equal(inserted, false);
    }
  );
});

test("findOrCreateDepartmentId inserts when no match exists", async () => {
  await withPatchedMethod(
    sequelize,
    "query",
    async (sql) => {
      if (matchesDeptSelect(sql)) return [[]];
      if (matchesDeptInsert(sql)) return [[{ id: 999 }]];
      throw new Error(`Unexpected query: ${sql}`);
    },
    async () => {
      const id = await findOrCreateDepartmentId("New Dept", { id: "tx" });
      assert.equal(id, 999);
    }
  );
});
