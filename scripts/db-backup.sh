#!/usr/bin/env bash
# Nightly Supabase backup: dump → gzip → age-encrypt → watchpapa-YYYY-MM-DD.sql.gz.age
#
# Supabase's Pro daily backups don't exist on the Free plan, so
# .github/workflows/db-backup.yml runs this and uploads the result to Cloudflare R2.
# Tested by tests/backup/db-backup.test.js (real Postgres 17 + a restore drill).
#
# Env:
#   SUPABASE_DB_POOLER_URL  postgres connection string — use the SESSION POOLER (IPv4);
#                           the direct host is IPv6-only and GitHub runners have no IPv6
#   AGE_PUBLIC_KEY          `age1…` recipient. The private key is NOT on the runner
#                           (keep it offline — without it backups are unreadable)
#   BACKUP_OUT_DIR          output directory (default .)
#   MIN_BACKUP_BYTES        refuse a gzipped+encrypted result smaller than this (default 10000)
#   PG_DUMP                 pg_dump binary, major version must be >= the server's (default pg_dump)
#
# What is backed up (restore into a fresh Supabase project, which already has the
# auth/storage tables and roles — schema DDL for `public` is also in
# Backend/src/db/migrations):
#   1. DATA ONLY: auth.users, auth.identities, auth.audit_log_entries,
#      storage.buckets, storage.objects   (sessions/refresh tokens/migration
#      bookkeeping are deliberately excluded — users just sign in again)
#   2. FULL `public` schema (DDL + data + RLS policies + functions + triggers + GRANT/REVOKE)
# Storage OBJECTS (avatar files) are not in a database dump; only their metadata is.
#
# Safety: the plaintext dump is only ever piped (never written to disk); the output
# is created as a hidden temp file and moved into place only after every check
# passes, so a failed run leaves nothing behind. No `set -x`, the URL is never echoed.
set -euo pipefail

die() { echo "db-backup: $*" >&2; exit 1; }

[[ -n "${AGE_PUBLIC_KEY:-}" ]] || die "AGE_PUBLIC_KEY is not set (refusing to produce an unencrypted backup)"
[[ "$AGE_PUBLIC_KEY" =~ ^age1[0-9a-z]+$ ]] || die "AGE_PUBLIC_KEY must be an age public key (age1…)"
[[ -n "${SUPABASE_DB_POOLER_URL:-}" ]] || die "SUPABASE_DB_POOLER_URL is not set"

OUT_DIR="${BACKUP_OUT_DIR:-.}"
MIN_BYTES="${MIN_BACKUP_BYTES:-10000}"
PG_DUMP="${PG_DUMP:-pg_dump}"
[[ "$MIN_BYTES" =~ ^[0-9]+$ ]] || die "MIN_BACKUP_BYTES must be a number"

for bin in "$PG_DUMP" age gzip; do
  command -v "$bin" >/dev/null 2>&1 || die "required tool not found: $bin"
done

mkdir -p "$OUT_DIR"
name="watchpapa-$(date -u +%F).sql.gz.age"
tmp="$(mktemp "$OUT_DIR/.watchpapa-backup.XXXXXX")"   # only ever holds ciphertext
trap 'rm -f "$tmp"' EXIT

# --no-owner: owners are Supabase-internal roles. Privileges are KEPT for the `public`
# dump — the migrations' REVOKE/GRANTs (e.g. audit_events) are part of the security
# model and must survive a restore. (Data-only dumps carry no privileges anyway.)

# Chained with && (NOT `set -e`: errexit is silently ignored inside a subshell that is
# part of an `||` list, which is exactly where this sits). A failure in the first dump
# skips the second and fails the subshell, and `pipefail` fails the whole pipeline.
# The sed drops `CREATE SCHEMA public;` — a fresh Supabase project already has that
# schema, so leaving it in would make the restore error out.
(
  "$PG_DUMP" "$SUPABASE_DB_POOLER_URL" --no-owner --data-only --strict-names \
    -t auth.users -t auth.identities -t auth.audit_log_entries \
    -t storage.buckets -t storage.objects \
  && "$PG_DUMP" "$SUPABASE_DB_POOLER_URL" --no-owner --schema=public
) | sed '/^CREATE SCHEMA public;$/d' | gzip -9 | age -r "$AGE_PUBLIC_KEY" > "$tmp" || die "dump/encrypt failed"

size="$(wc -c < "$tmp" | tr -d ' ')"
if (( size < MIN_BYTES )); then
  die "result is only ${size} bytes — suspiciously too small (MIN_BACKUP_BYTES=${MIN_BYTES}); not keeping it"
fi

mv -f "$tmp" "$OUT_DIR/$name"
trap - EXIT
echo "db-backup: wrote $name (${size} bytes)"
