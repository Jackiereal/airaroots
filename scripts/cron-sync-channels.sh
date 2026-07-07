#!/bin/sh
# Railway Cron Job — runs every 15 minutes
# Set up in Railway dashboard: New Service → Cron Job → paste this command
# Environment variables needed: APP_URL, CRON_SECRET
#
# Schedule: */15 * * * *
# Command:  sh /app/scripts/cron-sync-channels.sh

set -e

if [ -z "$APP_URL" ] || [ -z "$CRON_SECRET" ]; then
  echo "ERROR: APP_URL and CRON_SECRET must be set"
  exit 1
fi

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Triggering channel sync..."

response=$(curl -s -w "\n%{http_code}" \
  -X POST "${APP_URL}/api/cron/sync-channels" \
  -H "x-cron-secret: ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  --max-time 120)

http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | head -n -1)

echo "HTTP $http_code"
echo "$body"

if [ "$http_code" != "200" ]; then
  echo "ERROR: sync failed with HTTP $http_code"
  exit 1
fi

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Done."
