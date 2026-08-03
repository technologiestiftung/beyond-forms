#!/bin/bash
# demo_token.sh - Mints a fresh RS256 JWT for a BeyondForms demo/test account.
#
#   ./scripts/demo_token.sh +493023125102        # one token, on stdout
#   ./scripts/demo_token.sh --all                # a table of all demo personas
#   TOKEN=$(./scripts/demo_token.sh +493023125102)
#
# Test accounts use Bundesnetzagentur "drama numbers", which bypass the SMS one-time
# password, so this is just two unauthenticated calls to auth-service. There is
# deliberately no long-lived static token: Authentik ID tokens are short-lived, and
# re-running this is cheaper and safer than holding a credential that does not expire.
#
# Requires auth-service to be reachable (docker compose up -d).

set -euo pipefail

AUTH_SERVICE_URL="${AUTH_SERVICE_URL:-http://localhost:8003}"
PERSONAS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/demo/personas"
# Any value works: the drama-number path never verifies the code.
CODE="${CODE:-123456}"

usage() {
  cat >&2 <<EOF
Usage: $(basename "$0") <phone_number> | --all

  <phone_number>  A drama number, e.g. +493023125102
  --all           Print a phone/persona/token table for every persona in demo/personas/

Environment:
  AUTH_SERVICE_URL  default http://localhost:8003
EOF
  exit 64
}

mint_token() {
  local phone="$1" start_res token_start flow finish_res token

  start_res=$(curl -sS -X POST "$AUTH_SERVICE_URL/login/start" \
    -H 'Content-Type: application/json' \
    -d "{\"phone_number\": \"$phone\"}")

  token_start=$(printf '%s' "$start_res" | jq -r '.token // empty')
  flow=$(printf '%s' "$start_res" | jq -r '.flow // empty')

  if [ -z "$token_start" ]; then
    echo "error: login/start returned no session token for $phone" >&2
    printf '%s\n' "$start_res" >&2
    return 1
  fi

  finish_res=$(curl -sS -X POST "$AUTH_SERVICE_URL/login/finish" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $token_start" \
    -H "X-BeyondForms-Auth-Flow: $flow" \
    -d "{\"code\": \"$CODE\"}")

  token=$(printf '%s' "$finish_res" | jq -r '.token // empty')
  if [ -z "$token" ]; then
    echo "error: login/finish returned no JWT for $phone" >&2
    printf '%s\n' "$finish_res" >&2
    return 1
  fi

  printf '%s' "$token"
}

command -v jq >/dev/null || { echo "error: jq is required" >&2; exit 1; }
[ $# -eq 1 ] || usage

if [ "$1" = "--all" ]; then
  [ -d "$PERSONAS_DIR" ] || { echo "error: $PERSONAS_DIR not found" >&2; exit 1; }
  printf '%-18s %-10s %s\n' "PHONE" "PERSONA" "TOKEN"
  for file in "$PERSONAS_DIR"/*.json; do
    slug=$(jq -r '.slug' "$file")
    phone=$(jq -r '.phone_number' "$file")
    if token=$(mint_token "$phone"); then
      printf '%-18s %-10s %s\n' "$phone" "$slug" "$token"
    else
      printf '%-18s %-10s %s\n' "$phone" "$slug" "<FAILED>"
    fi
  done
  exit 0
fi

case "$1" in
  -h|--help) usage ;;
esac

mint_token "$1"
echo
