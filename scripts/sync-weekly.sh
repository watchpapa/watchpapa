#!/bin/bash
set -a
source /var/www/watchpapa/.env
set +a

cd /var/www/watchpapa

LOG="/var/log/watchpapa/sync-weekly.log"
mkdir -p /var/log/watchpapa

START=$(date -d '7 days ago' +%Y-%m-%d)
END=$(date +%Y-%m-%d)

echo "" >> "$LOG"
echo "=== Weekly sync started: $(date -u '+%Y-%m-%d %H:%M:%S UTC') ===" >> "$LOG"
echo "Date range: $START to $END" >> "$LOG"

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

run_step "Refresh changed movies" "npm run seed:tmdb:changed-movies-24h -- --start-date=$START --end-date=$END"
run_step "Refresh changed shows"  "npm run seed:tmdb:changed-shows-24h -- --start-date=$START --end-date=$END"
run_step "Refresh changed people" "npm run seed:tmdb:changed-people-24h -- --start-date=$START --end-date=$END"

if [ -n "$FAILED" ]; then
  echo "=== FAILURES ===" >> "$LOG"
  printf "%b\n" "$FAILED" >> "$LOG"

  BODY="Weekly TMDB Sync failed in one or more steps.\n\nFailed steps:$FAILED\n\nSee log: $LOG"
  curl -s --ssl-reqd \
    --url "smtps://${SMTP_SERVER}:${SMTP_PORT:-465}" \
    --user "${SMTP_USERNAME}:${SMTP_PASSWORD}" \
    --mail-from "${SMTP_FROM:-$SMTP_USERNAME}" \
    --mail-rcpt "alert@watchpapa.tv" \
    --upload-file - <<EOF
From: ${SMTP_FROM:-$SMTP_USERNAME}
To: alert@watchpapa.tv
Subject: [watchpapa] Weekly TMDB Sync failure

$(printf "%b" "$BODY")
EOF
fi

echo "=== Weekly sync finished: $(date -u '+%Y-%m-%d %H:%M:%S UTC') ===" >> "$LOG"
