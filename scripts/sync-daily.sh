#!/bin/bash
set -a
source /var/www/watchpapa/.env
set +a

cd /var/www/watchpapa

LOG="/var/log/watchpapa/sync-daily.log"
mkdir -p /var/log/watchpapa

echo "" >> "$LOG"
echo "=== Daily sync started: $(date -u '+%Y-%m-%d %H:%M:%S UTC') ===" >> "$LOG"

FAILED=""

run_step() {
  local name="$1"
  local cmd="$2"
  echo "-> $name" >> "$LOG"
  if eval "$cmd" >> "$LOG" 2>&1; then
    echo "   OK" >> "$LOG"
  else
    echo "   FAILED" >> "$LOG"
    FAILED="$FAILED\n- $name"
  fi
}

run_step "Inject 100 popular movies"  "npm run seed:tmdb:popular-movies-today -- --limit=100"
run_step "Inject 100 popular shows"   "npm run seed:tmdb:popular-shows-today -- --limit=100"
run_step "Inject 100 popular people"  "npm run seed:tmdb:popular-people-today -- --limit=100"
run_step "Inject 100 top rated movies" "npm run seed:tmdb:top-rated-movies -- --limit=100"
run_step "Inject 100 top rated shows"  "npm run seed:tmdb:top-rated-shows -- --limit=100"
run_step "Update popularity scores"    "npm run seed:tmdb:update-popularity"

if [ -n "$FAILED" ]; then
  echo "=== FAILURES ===" >> "$LOG"
  printf "%b\n" "$FAILED" >> "$LOG"

  BODY="Daily TMDB Sync failed in one or more steps.\n\nFailed steps:$FAILED\n\nSee log: $LOG"
  curl -s --ssl-reqd \
    --url "smtps://${SMTP_SERVER}:${SMTP_PORT:-465}" \
    --user "${SMTP_USERNAME}:${SMTP_PASSWORD}" \
    --mail-from "${SMTP_FROM:-$SMTP_USERNAME}" \
    --mail-rcpt "alert@watchpapa.tv" \
    --upload-file - <<EOF
From: ${SMTP_FROM:-$SMTP_USERNAME}
To: alert@watchpapa.tv
Subject: [watchpapa] Daily TMDB Sync failure

$(printf "%b" "$BODY")
EOF
fi

echo "=== Daily sync finished: $(date -u '+%Y-%m-%d %H:%M:%S UTC') ===" >> "$LOG"
