#!/bin/bash
set -a
source /var/www/watchpapa/.env
set +a

HOSTNAME=$(hostname)
BOOT_TIME=$(uptime -s)

curl --silent --fail \
  --url "https://api.resend.com/emails" \
  -H "Authorization: Bearer $SMTP_PASSWORD" \
  -H "Content-Type: application/json" \
  -d "{
    \"from\": \"wpp-workflows@watchpapa.tv\",
    \"to\": [\"alert@watchpapa.tv\"],
    \"subject\": \"WATCHPAPA server rebooted: $HOSTNAME\",
    \"text\": \"Server $HOSTNAME restarted.\n\nBoot time: $BOOT_TIME\nUptime: $(uptime -p)\"
  }"
