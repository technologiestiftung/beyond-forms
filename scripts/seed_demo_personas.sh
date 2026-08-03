#!/bin/bash
# seed_demo_personas.sh - Materialises every demo persona into a working account.
#
#   ./scripts/seed_demo_personas.sh              # all personas
#   ./scripts/seed_demo_personas.sh helmut       # just one
#   ./scripts/seed_demo_personas.sh --no-reset   # keep whatever is already there
#
# For each persona: log in on its drama number (no SMS involved), then POST the persona
# to the middleware, which writes the profile, the application and pre-verified documents
# — skipping the Gemini document pipeline entirely.
#
# Prerequisites:
#   docker compose up -d
#   DEMO_SEED_ENABLED=true in services/orchestration-middleware-service/.env
#   gcloud auth application-default login   (there is no local GCS emulator; document
#                                            blobs go to the real dev bucket)

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_URL="${API_URL:-http://localhost:8080}"
PERSONAS_DIR="$REPO_ROOT/demo/personas"
RESET=true
ONLY=""

for arg in "$@"; do
  case "$arg" in
    --no-reset) RESET=false ;;
    -h|--help)
      sed -n '2,18p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    -*) echo "error: unknown option $arg" >&2; exit 64 ;;
    *) ONLY="$arg" ;;
  esac
done

command -v jq >/dev/null || { echo "error: jq is required" >&2; exit 1; }

if ! curl -sSf "$API_URL/health" >/dev/null 2>&1; then
  echo "error: middleware not reachable at $API_URL — is docker compose up?" >&2
  exit 1
fi

failures=0
summary=()

for file in "$PERSONAS_DIR"/*.json; do
  slug=$(jq -r '.slug' "$file")
  phone=$(jq -r '.phone_number' "$file")
  title=$(jq -r '.title' "$file")

  if [ -n "$ONLY" ] && [ "$ONLY" != "$slug" ]; then
    continue
  fi

  echo "==============================================================="
  echo "$title"
  echo "  slug=$slug  phone=$phone"

  if ! token=$("$REPO_ROOT/scripts/demo_token.sh" "$phone"); then
    echo "  ✗ could not mint a token" >&2
    failures=$((failures + 1))
    summary+=("$slug|$phone|LOGIN FAILED|-|-")
    continue
  fi
  token="${token%$'\n'}"

  response=$(curl -sS -X POST "$API_URL/api/v1/demo/seed" \
    -H "Authorization: Bearer $token" \
    -H 'Content-Type: application/json' \
    -d "{\"persona\": \"$slug\", \"reset\": $RESET}")

  if ! printf '%s' "$response" | jq -e '.persona' >/dev/null 2>&1; then
    echo "  ✗ seeding failed:" >&2
    printf '%s\n' "$response" | jq . >&2 2>/dev/null || printf '%s\n' "$response" >&2
    failures=$((failures + 1))
    summary+=("$slug|$phone|SEED FAILED|-|-")
    continue
  fi

  docs=$(printf '%s' "$response" | jq -r '.documents | length')
  verified=$(printf '%s' "$response" | jq -r '[.documents[] | select(.status=="verified")] | length')
  # Not `.is_submittable // "unknown"`: jq's `//` treats `false` as empty, so a correctly
  # non-submittable persona would be reported as "unknown".
  submittable=$(printf '%s' "$response" | jq -r \
    'if .submittability.checked then (.submittability.is_submittable | tostring) else "unknown" end')
  app_id=$(printf '%s' "$response" | jq -r '.application_id')

  printf '  ✓ %s documents (%s verified), submittable=%s\n' "$docs" "$verified" "$submittable"
  printf '%s' "$response" | jq -r '.documents[] | "      \(.status | ascii_upcase)  \(.document_type)  \(.asset_source)"'
  echo "  application_id=$app_id"
  echo "  token=$token"

  summary+=("$slug|$phone|$verified/$docs verified|$submittable|$token")
done

echo
echo "==============================================================="
printf '%-9s %-16s %-18s %-12s %s\n' "PERSONA" "PHONE" "DOCUMENTS" "SUBMITTABLE" "TOKEN (short-lived)"
for row in "${summary[@]}"; do
  IFS='|' read -r slug phone docs submittable token <<< "$row"
  printf '%-9s %-16s %-18s %-12s %s\n' "$slug" "$phone" "$docs" "$submittable" "${token:0:32}…"
done
echo
echo "Re-mint a token any time with: ./scripts/demo_token.sh <phone>"
echo "Personas and API recipes:      demo/README.md"

exit $((failures > 0 ? 1 : 0))
