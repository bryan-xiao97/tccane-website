#!/usr/bin/env bash
# Usage (local): SMOKE=1 BASE_URL=http://127.0.0.1:8788 ./scripts/smoke-interest.sh
set -euo pipefail
if [[ "${SMOKE:-}" != "1" ]]; then
  echo "Set SMOKE=1 to run. Start pages dev first with .dev.vars configured."
  exit 0
fi
BASE_URL="${BASE_URL:-http://127.0.0.1:8788}"
curl -sS -X POST "$BASE_URL/api/interest" \
  -H 'content-type: application/json' \
  -d '{"firstName":"Test","lastName":"User","email":"test-smoke@example.com","turnstileToken":"dev","company":""}' \
  | tee /tmp/interest-smoke.json
grep -q '"ok":true' /tmp/interest-smoke.json
echo "smoke ok"
