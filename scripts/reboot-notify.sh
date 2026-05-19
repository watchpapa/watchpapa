#!/bin/bash
set -a
source /var/www/watchpapa/.env
set +a

SMTP_PORT="${SMTP_PORT:-587}"
SMTP_FROM="${SMTP_FROM:-$SMTP_USERNAME}"
TO="alert@watchpapa.tv"
HOSTNAME=$(hostname)
BOOT_TIME=$(uptime -s)
SUBJECT="[watchpapa] Server rebooted: $HOSTNAME"
BODY="Server $HOSTNAME restarted.\n\nBoot time: $BOOT_TIME\nUptime: $(uptime -p)"

curl --silent --ssl-reqd \
  --url "smtp://$SMTP_SERVER:$SMTP_PORT" \
  --user "$SMTP_USERNAME:$SMTP_PASSWORD" \
  --mail-from "$SMTP_FROM" \
  --mail-rcpt "$TO" \
  --upload-file <(printf "From: %s\r\nTo: %s\r\nSubject: %s\r\n\r\n%b\r\n" \
    "$SMTP_FROM" "$TO" "$SUBJECT" "$BODY")
