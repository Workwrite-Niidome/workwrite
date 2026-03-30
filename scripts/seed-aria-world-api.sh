#!/bin/bash
# Seed Aria world data via API
# Usage: bash scripts/seed-aria-world-api.sh <token>

BASE="https://backend-production-db434.up.railway.app/api/v1"
TOKEN="$1"
WORK_ID="cmmz0tp5o000bmp018pbblq0h"

if [ -z "$TOKEN" ]; then
  echo "Usage: bash scripts/seed-aria-world-api.sh <auth_token>"
  exit 1
fi

echo "Testing connection..."
curl -s -m 5 -H "Authorization: Bearer $TOKEN" "$BASE/interactive-novel/$WORK_ID/build-status"
echo ""

echo "Seeding via enter endpoint (creates ReaderWorldState)..."
curl -s -m 10 -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  "$BASE/interactive-novel/$WORK_ID/enter" \
  -d '{"entryType":"explore"}'
echo ""
echo "Done. Check build-status:"
curl -s -m 5 -H "Authorization: Bearer $TOKEN" "$BASE/interactive-novel/$WORK_ID/build-status"
echo ""
