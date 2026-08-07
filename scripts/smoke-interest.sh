#!/usr/bin/env bash
# Usage (local): SMOKE=1 BASE_URL=http://127.0.0.1:8788 ./scripts/smoke-interest.sh
set -euo pipefail
if [[ "${SMOKE:-}" != "1" ]]; then
  echo "Set SMOKE=1 to run. Start pages dev first with .dev.vars configured."
  exit 0
fi
BASE_URL="${BASE_URL:-http://127.0.0.1:8788}"
smoke_output="$(mktemp -t tccane-interest-smoke.XXXXXX)"
trap 'rm -f "$smoke_output"' EXIT
curl -sS -X POST "$BASE_URL/api/interest" \
  -H 'content-type: application/json' \
  -d '{"firstName":"Integration","lastName":"Check","email":"integration-check@example.invalid","turnstileToken":"dev","company":""}' \
  > "$smoke_output"
grep -Eq '"status":"(recorded|accepted)"' "$smoke_output"
echo "smoke ok"
