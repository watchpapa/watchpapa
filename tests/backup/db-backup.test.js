/**
 * Nightly DB backup — scripts/db-backup.sh + .github/workflows/db-backup.yml
 *
 * Supabase Pro's daily backups disappear on the Free plan, so a GitHub Action
 * dumps the database, encrypts it with `age`, and ships it to Cloudflare R2.
 * The pipeline lives in scripts/db-backup.sh so it can be tested here with no
 * GitHub and no R2.
 *
 * Contract under test (env in → files out):
 *   SUPABASE_DB_POOLER_URL  Postgres connection string (session pooler)
 *   AGE_PUBLIC_KEY          `age1…` recipient; the private key is never on the runner
 *   BACKUP_OUT_DIR          where to write watchpapa-YYYY-MM-DD.sql.gz.age (default .)
 *   MIN_BACKUP_BYTES        sanity floor for the *encrypted, gzipped* output (default 10000)
 *   PG_DUMP / PSQL          pg_dump / psql binaries (default on PATH; major must be >= the server's)
 *   The plaintext dump must never touch disk; failures leave NO files behind.
 *
 * Prerequisites (this suite fails loudly instead of skipping, so a green run means something):
 *   Docker running (postgres:17), `brew install age`, psql + pg_dump on PATH.
 *
 *   npm run test:backup
 */

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SCRIPT = join(ROOT, "scripts/db-backup.sh");
const WORKFLOW = join(ROOT, ".github/workflows/db-backup.yml");

const sh = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: "utf8", ...opts });
const have = (bin) => sh("sh", ["-c", `command -v ${bin}`]).status === 0;

// ── static checks on the workflow (no docker needed) ─────────────────────────
describe("db-backup.yml (static)", () => {
  const yml = existsSync(WORKFLOW) ? readFileSync(WORKFLOW, "utf8") : "";

  test("exists", () => assert.ok(yml.length > 0, `${WORKFLOW} is missing`));
  test("runs on a daily schedule AND can be dispatched by hand", () => {
    assert.match(yml, /schedule:\s*\n\s*-\s*cron:\s*["']?\d+ \d+ \* \* \*["']?/);
    assert.match(yml, /workflow_dispatch:/);
  });
  test("installs postgresql-client-17 (must match the server major) and age", () => {
    assert.match(yml, /postgresql-client-17/);
    assert.match(yml, /\bage\b/);
  });
  test("delegates to scripts/db-backup.sh instead of inlining the pipeline", () => {
    assert.match(yml, /scripts\/db-backup\.sh/);
    assert.doesNotMatch(yml, /^\s*(?:sudo\s+)?pg_dump\b/m, "pg_dump belongs in the script, where it is tested");
  });
  test("uses exactly the documented secrets", () => {
    for (const s of ["SUPABASE_DB_POOLER_URL", "AGE_PUBLIC_KEY", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]) {
      assert.match(yml, new RegExp(`secrets\\.${s}\\b`), `missing secrets.${s}`);
    }
    const used = [...yml.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((m) => m[1]);
    const allowed = new Set(["SUPABASE_DB_POOLER_URL", "AGE_PUBLIC_KEY", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]);
    for (const u of used) assert.ok(allowed.has(u), `unexpected secret ${u}`);
  });
  test("uploads to R2 through its S3 endpoint", () => {
    assert.match(yml, /r2\.cloudflarestorage\.com/);
    assert.match(yml, /aws s3 cp/);
  });
  test("passes the pg 17 psql to the script alongside pg_dump", () => {
    assert.match(yml, /PSQL:\s*\/usr\/lib\/postgresql\/17\/bin\/psql/);
  });
  test("least privilege + never echoes secrets", () => {
    assert.match(yml, /permissions:\s*\n\s*contents:\s*read/);
    assert.doesNotMatch(yml, /echo[^\n]*\$\{\{\s*secrets\./);
    assert.doesNotMatch(yml, /set -x/);
  });
  test("a failed run is visible (no `continue-on-error`, no `|| true`)", () => {
    assert.doesNotMatch(yml, /continue-on-error:\s*true/);
    assert.doesNotMatch(yml, /\|\|\s*true/);
  });
  test("actionlint passes", (t) => {
    if (!yml) return assert.fail("workflow missing");
    if (!have("docker") || sh("docker", ["info"]).status !== 0) return t.skip("docker not running — actionlint skipped (the full suite below requires docker anyway)");
    const r = sh("docker", ["run", "--rm", "-v", `${WORKFLOW}:/w/db-backup.yml:ro`, "rhysd/actionlint:latest", "-color=false", "/w/db-backup.yml"]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
  });
});

// ── the script ───────────────────────────────────────────────────────────────
describe("scripts/db-backup.sh", () => {
  let work;
  let keys; // { pub, privFile }
  const containers = [];

  const run = (env, outDir) =>
    sh("bash", [SCRIPT], {
      env: { PATH: process.env.PATH, HOME: process.env.HOME, BACKUP_OUT_DIR: outDir, ...env },
      cwd: work,
    });
  const outDir = (name) => { const d = join(work, name); sh("mkdir", ["-p", d]); return d; };

  before(() => {
    const missing = [];
    for (const b of ["age", "age-keygen", "pg_dump", "psql", "docker", "gzip"]) if (!have(b)) missing.push(b);
    if (sh("docker", ["info"]).status !== 0) missing.push("a RUNNING docker daemon (start Docker Desktop)");
    assert.deepEqual(missing, [], `Prerequisites missing: ${missing.join(", ")}.  brew install age; start Docker Desktop.`);

    assert.ok(existsSync(SCRIPT), `${SCRIPT} does not exist yet`);
    work = mkdtempSync(join(tmpdir(), "wp-backup-test-"));
    const privFile = join(work, "age-key.txt");
    const gen = sh("age-keygen", ["-o", privFile]);
    assert.equal(gen.status, 0, gen.stderr);
    const pub = /public key: (age1[0-9a-z]+)/i.exec(gen.stderr + gen.stdout)?.[1];
    assert.ok(pub, "could not read the age public key");
    keys = { pub, privFile };
  });

  after(() => {
    for (const id of containers) sh("docker", ["rm", "-f", id]);
    if (work) rmSync(work, { recursive: true, force: true });
  });

  // ---- postgres helpers ----
  function startPg() {
    const r = sh("docker", ["run", "-d", "--rm", "-e", "POSTGRES_PASSWORD=pw", "-p", "127.0.0.1::5432", "postgres:17"]);
    assert.equal(r.status, 0, r.stderr);
    const id = r.stdout.trim();
    containers.push(id);
    const port = /:(\d+)\s*$/m.exec(sh("docker", ["port", id, "5432/tcp"]).stdout)?.[1];
    assert.ok(port, "no mapped port");
    const url = `postgresql://postgres:pw@127.0.0.1:${port}/postgres`;
    for (let i = 0; i < 120; i++) {
      // pg_isready can say "yes" during the image's init restart; require a real query twice.
      if (sh("psql", [url, "-tAc", "select 1"]).stdout.trim() === "1") { if (i > 0 || true) { sh("sleep", ["1"]); if (sh("psql", [url, "-tAc", "select 1"]).stdout.trim() === "1") return url; } }
      sh("sleep", ["0.5"]);
    }
    throw new Error("postgres container did not become ready");
  }
  const psql = (url, sql) => {
    const r = sh("psql", [url, "-v", "ON_ERROR_STOP=1", "-tAc", sql]);
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
  const psqlFile = (url, sql) => {
    const r = sh("psql", [url, "-v", "ON_ERROR_STOP=1", "-q"], { input: sql });
    assert.equal(r.status, 0, r.stderr);
  };

  // What a *fresh Supabase project* looks like: roles, auth + storage tables, auth.uid().
  const FRESH_PROJECT = `
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
    GRANT USAGE ON SCHEMA public TO anon, authenticated;
    CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO anon, authenticated;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, encrypted_password text, raw_user_meta_data jsonb, created_at timestamptz DEFAULT now());
    CREATE TABLE auth.identities (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, provider text, identity_data jsonb);
    CREATE TABLE auth.audit_log_entries (id uuid PRIMARY KEY, payload jsonb, created_at timestamptz DEFAULT now());
    CREATE TABLE auth.schema_migrations (version text PRIMARY KEY);
    CREATE TABLE auth.refresh_tokens (id bigserial PRIMARY KEY, token text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean);
    CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text REFERENCES storage.buckets(id), name text);
    CREATE TABLE storage.migrations (id int PRIMARY KEY, name text);
  `;

  const APP_SCHEMA = `
    CREATE EXTENSION pg_trgm WITH SCHEMA public;
    CREATE EXTENSION unaccent WITH SCHEMA public;
    CREATE TABLE public.profile (id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, username text UNIQUE, role int NOT NULL DEFAULT 0);
    ALTER TABLE public.profile ENABLE ROW LEVEL SECURITY;
    CREATE POLICY profile_own ON public.profile FOR SELECT TO authenticated USING (id = auth.uid());
    GRANT SELECT ON public.profile TO authenticated;
    CREATE INDEX profile_username_trgm ON public.profile USING gin (username public.gin_trgm_ops);
    CREATE TABLE public.user_rating (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, profile_id uuid REFERENCES public.profile(id), tmdb_id int NOT NULL, value int NOT NULL);
    GRANT SELECT, INSERT ON public.user_rating TO authenticated;
    REVOKE ALL ON public.user_rating FROM PUBLIC;
    CREATE FUNCTION public.touch_rating() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN NEW; END $$;
    CREATE TRIGGER user_rating_touch BEFORE INSERT ON public.user_rating FOR EACH ROW EXECUTE FUNCTION public.touch_rating();
  `;

  const SEED = `
    INSERT INTO auth.users (id, email, encrypted_password, raw_user_meta_data) VALUES
      ('11111111-1111-1111-1111-111111111111','alice.backup-test@example.com','$2a$10$ALICEhashPLAINTEXTmarkerAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA','{"username":"alice"}'),
      ('22222222-2222-2222-2222-222222222222','bob.backup-test@example.com','$2a$10$BOBhashPLAINTEXTmarkerBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB','{"username":"bob"}'),
      ('33333333-3333-3333-3333-333333333333','carol.backup-test@example.com',NULL,'{"username":"carol"}');
    INSERT INTO auth.identities (user_id, provider, identity_data) VALUES
      ('11111111-1111-1111-1111-111111111111','email','{"sub":"alice"}'),
      ('33333333-3333-3333-3333-333333333333','google','{"sub":"carol-google"}');
    INSERT INTO auth.audit_log_entries (id, payload) VALUES (gen_random_uuid(), '{"action":"login"}');
    INSERT INTO auth.schema_migrations VALUES ('20240101000000');
    INSERT INTO auth.refresh_tokens (token) VALUES ('SECRET-REFRESH-TOKEN-MUST-NOT-BE-BACKED-UP');
    INSERT INTO storage.buckets VALUES ('avatars','avatars',true);
    INSERT INTO storage.objects (bucket_id, name) VALUES ('avatars','11111111-1111-1111-1111-111111111111/a.jpg');
    INSERT INTO storage.migrations VALUES (1,'init');
    INSERT INTO public.profile VALUES
      ('11111111-1111-1111-1111-111111111111','alice',0),('22222222-2222-2222-2222-222222222222','bob',4),('33333333-3333-3333-3333-333333333333','carol',0);
    INSERT INTO public.user_rating (profile_id, tmdb_id, value) VALUES
      ('11111111-1111-1111-1111-111111111111',603,9),('11111111-1111-1111-1111-111111111111',680,8),('22222222-2222-2222-2222-222222222222',603,7);
  `;

  const DATA_TABLES = [
    "auth.users", "auth.identities", "auth.audit_log_entries", "storage.buckets", "storage.objects",
    "public.profile", "public.user_rating",
  ];
  const NOT_BACKED_UP = ["auth.schema_migrations", "auth.refresh_tokens", "storage.migrations"];
  const catalog = (url) => psql(url, `
    SELECT (SELECT count(*) FROM pg_policies WHERE schemaname='public') || '/' ||
           (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal) || '/' ||
           (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public') || '/' ||
           (SELECT count(*) FROM pg_indexes WHERE schemaname='public') || '/' ||
           (SELECT coalesce(string_agg(extname, ',' ORDER BY extname), '') FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE n.nspname='public')`);

  const env = (url, extra = {}) => ({ SUPABASE_DB_POOLER_URL: url, AGE_PUBLIC_KEY: keys.pub, MIN_BACKUP_BYTES: "500", ...extra });
  const filesIn = (d) => readdirSync(d);

  // ---- no-database failure modes ----
  describe("fails fast and leaves nothing behind", () => {
    test("missing AGE_PUBLIC_KEY → non-zero; the dump is never attempted unencrypted", () => {
      const out = outDir("nokey");
      const r = run({ SUPABASE_DB_POOLER_URL: "postgresql://u:p@127.0.0.1:1/db" }, out);
      assert.notEqual(r.status, 0);
      assert.match(r.stderr, /AGE_PUBLIC_KEY/);
      assert.deepEqual(filesIn(out), []);
    });

    test("malformed AGE_PUBLIC_KEY → non-zero before touching the database", () => {
      const out = outDir("badkey");
      const r = run({ SUPABASE_DB_POOLER_URL: "postgresql://u:p@127.0.0.1:1/db", AGE_PUBLIC_KEY: "not-an-age-key" }, out);
      assert.notEqual(r.status, 0);
      assert.deepEqual(filesIn(out), []);
    });

    test("missing SUPABASE_DB_POOLER_URL → non-zero", () => {
      const out = outDir("nourl");
      const r = run({ AGE_PUBLIC_KEY: keys.pub }, out);
      assert.notEqual(r.status, 0);
      assert.match(r.stderr, /SUPABASE_DB_POOLER_URL/);
      assert.deepEqual(filesIn(out), []);
    });

    test("unreachable database → non-zero, no output file, and the password never appears in output", () => {
      const out = outDir("unreachable");
      const r = run(env("postgresql://postgres:sup3rS3cretPw@127.0.0.1:1/postgres"), out);
      assert.notEqual(r.status, 0);
      assert.ok(!(r.stdout + r.stderr).includes("sup3rS3cretPw"), "password leaked into logs");
      assert.deepEqual(filesIn(out), []);
    });
  });

  // ---- full pipeline against a real Postgres 17 ----
  describe("pipeline against Postgres 17", () => {
    let srcUrl;
    let backupFile;

    test("produces an age-encrypted, gzipped, dated dump", () => {
      srcUrl = startPg();
      psqlFile(srcUrl, FRESH_PROJECT + APP_SCHEMA + SEED);

      const out = outDir("ok");
      const r = run(env(srcUrl), out);
      assert.equal(r.status, 0, r.stdout + r.stderr);
      const files = filesIn(out);
      assert.equal(files.length, 1, `expected exactly one file, got ${JSON.stringify(files)}`);
      assert.match(files[0], /^watchpapa-\d{4}-\d{2}-\d{2}\.sql\.gz\.age$/);
      backupFile = join(out, files[0]);
      assert.ok(statSync(backupFile).size > 500);
      assert.match(readFileSync(backupFile).subarray(0, 40).toString("latin1"), /^age-encryption\.org\/v1/);
    });

    test("ciphertext contains none of the seeded plaintext (emails, hashes, usernames)", () => {
      const bytes = readFileSync(backupFile).toString("latin1");
      for (const needle of ["alice.backup-test@example.com", "PLAINTEXTmarker", "CREATE TABLE", "auth.users", "SECRET-REFRESH"]) {
        assert.ok(!bytes.includes(needle), `plaintext "${needle}" visible in the encrypted file`);
      }
    });

    test("cannot be decrypted without the private key; can with it", () => {
      const wrong = sh("age-keygen", ["-o", join(work, "other-key.txt")]);
      assert.equal(wrong.status, 0);
      const bad = sh("age", ["-d", "-i", join(work, "other-key.txt"), backupFile]);
      assert.notEqual(bad.status, 0);
      const good = sh("age", ["-d", "-i", keys.privFile, backupFile], { encoding: "buffer" });
      assert.equal(good.status, 0);
      assert.ok(good.stdout.length > 0);
    });

    test("dump selection: users/identities/audit/storage metadata + full public; NOT sessions/tokens/migration bookkeeping", () => {
      const dec = sh("sh", ["-c", `age -d -i '${keys.privFile}' '${backupFile}' | gunzip`]);
      assert.equal(dec.status, 0, dec.stderr);
      const sql = dec.stdout;
      assert.match(sql, /alice\.backup-test@example\.com/);
      assert.match(sql, /CREATE TABLE public\.profile/);
      assert.match(sql, /CREATE POLICY profile_own/);
      for (const bad of ["SECRET-REFRESH-TOKEN-MUST-NOT-BE-BACKED-UP", "20240101000000"]) {
        assert.ok(!sql.includes(bad), `"${bad}" must not be in the backup`);
      }
      assert.ok(!/OWNER TO/.test(sql), "must be --no-owner");
      assert.match(sql, /GRANT SELECT ON TABLE public\.profile TO authenticated/, "table privileges must be backed up");
    });

    test("RESTORE DRILL: restores into a fresh Supabase-shaped project with identical data", () => {
      const fresh = startPg();
      psqlFile(fresh, FRESH_PROJECT);

      const restore = sh("sh", ["-c", `age -d -i '${keys.privFile}' '${backupFile}' | gunzip | psql '${fresh}' -v ON_ERROR_STOP=1 -q`]);
      assert.equal(restore.status, 0, restore.stderr);

      for (const t of DATA_TABLES) {
        assert.equal(psql(fresh, `select count(*) from ${t}`), psql(srcUrl, `select count(*) from ${t}`), `row count differs for ${t}`);
      }
      assert.equal(psql(fresh, "select count(*) from auth.users"), "3");
      for (const t of NOT_BACKED_UP) assert.equal(psql(fresh, `select count(*) from ${t}`), "0", `${t} should not have been restored`);

      // password hashes + emails byte-identical
      const q = "select md5(string_agg(id::text||'|'||coalesce(email,'')||'|'||coalesce(encrypted_password,''), ',' order by id)) from auth.users";
      assert.equal(psql(fresh, q), psql(srcUrl, q));
      const r = "select md5(string_agg(profile_id::text||tmdb_id||':'||value, ',' order by id)) from public.user_rating";
      assert.equal(psql(fresh, r), psql(srcUrl, r));

      // schema objects came across: policies / triggers / functions
      assert.equal(catalog(fresh), catalog(srcUrl));
      // regression: pg_dump --schema=public silently skips extensions, which dropped the
      // pg_trgm/unaccent functions and every trigram index on a real restore
      assert.match(catalog(fresh), /pg_trgm,plpgsql|pg_trgm,unaccent/);
      assert.equal(psql(fresh, "select count(*) from pg_indexes where indexname='profile_username_trgm'"), "1");

      // GRANT/REVOKE state restored identically (not just via Supabase default privileges)
      const grants = "select string_agg(grantee||':'||table_name||':'||privilege_type, ',' order by grantee, table_name, privilege_type) from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated')";
      assert.equal(psql(fresh, grants), psql(srcUrl, grants));
      assert.match(psql(fresh, grants), /authenticated:profile:SELECT/);
      assert.equal(psql(fresh, "select has_table_privilege('anon','public.user_rating','SELECT')"), "f");

      // and RLS still behaves: alice sees only her own profile row
      const rls = sh("psql", [fresh, "-tA", "-v", "ON_ERROR_STOP=1"], {
        input: `BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true); SELECT count(*) FROM public.profile; ROLLBACK;`,
      });
      assert.match(rls.stdout, /^1$/m);
    });

    test("a sanity floor rejects a suspiciously small backup and leaves no file", () => {
      const out = outDir("tiny");
      const r = run(env(srcUrl, { MIN_BACKUP_BYTES: "100000000" }), out);
      assert.notEqual(r.status, 0);
      assert.match(r.stderr, /too small|suspicious|MIN_BACKUP_BYTES/i);
      assert.deepEqual(filesIn(out), []);
    });

    test("a database with no app schema fails instead of writing an empty 'success'", () => {
      const empty = startPg();
      const out = outDir("empty");
      const r = run(env(empty, { MIN_BACKUP_BYTES: "1" }), out);
      assert.notEqual(r.status, 0);
      assert.deepEqual(filesIn(out), []);
    });

    test("never writes the plaintext dump to disk (no stray .sql / .gz / .partial after success or failure)", () => {
      for (const d of ["ok", "tiny", "empty", "unreachable"]) {
        const leftovers = filesIn(join(work, d)).filter((f) => !f.endsWith(".age"));
        assert.deepEqual(leftovers, [], `${d}: ${leftovers}`);
      }
      const stray = readdirSync(work).filter((f) => /\.(sql|gz|dump|partial)$/.test(f));
      assert.deepEqual(stray, []);
    });

    test("running twice on the same day overwrites the file instead of failing or duplicating", () => {
      const out = outDir("twice");
      assert.equal(run(env(srcUrl), out).status, 0);
      assert.equal(run(env(srcUrl), out).status, 0);
      assert.equal(filesIn(out).length, 1);
    });
  });
});
