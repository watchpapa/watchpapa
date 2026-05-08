#!/bin/bash
# Manual one-off seed script — replaces the seed-one-off GitHub Actions workflow.
# Usage: bash scripts/seed-manual.sh <script-name> [extra args]
#
# Examples:
#   bash scripts/seed-manual.sh popular-movies-today --limit=50
#   bash scripts/seed-manual.sh movie --id=550
#   bash scripts/seed-manual.sh changed-movies-24h --start-date=2026-01-01 --end-date=2026-01-07
#   bash scripts/seed-manual.sh update-popularity

set -a
source /var/www/watchpapa/.env
set +a

cd /var/www/watchpapa

SCRIPT="$1"
shift

if [ -z "$SCRIPT" ]; then
  echo "Usage: bash scripts/seed-manual.sh <script-name> [args]"
  echo ""
  echo "Available scripts:"
  echo "  genres, jobs"
  echo "  popular-movies-today, popular-shows-today, popular-people-today"
  echo "  top-rated-movies, top-rated-shows"
  echo "  changed-movies-24h, changed-shows-24h, changed-people-24h, changed-all-24h"
  echo "  update-popularity, update-popularity:movies, update-popularity:shows, update-popularity:people"
  echo "  movie, tv-show, person"
  exit 1
fi

echo "Running: npm run seed:tmdb:$SCRIPT -- $@"
npm run "seed:tmdb:$SCRIPT" -- "$@"
