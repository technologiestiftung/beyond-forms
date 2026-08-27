#!/bin/bash
# seed_demo_personas.sh - Ensure demo personas exist in the local compose stack.
#
#   ./scripts/seed_demo_personas.sh              # seed any persona that is missing
#   ./scripts/seed_demo_personas.sh helmut       # force-reset one
#
# Staging/prod do this on middleware startup when DEMO_SEED_ENABLED=true.
# This script is the local equivalent (docker compose exec into the container).

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PERSONAS_DIR="$REPO_ROOT/demo/personas"
ONLY="${1:-}"

if [ "$ONLY" = "-h" ] || [ "$ONLY" = "--help" ]; then
  sed -n '2,12p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  exit 0
fi

if [ -n "$ONLY" ]; then
  file="$PERSONAS_DIR/$ONLY.json"
  if [ ! -f "$file" ]; then
    echo "error: unknown persona $ONLY" >&2
    exit 1
  fi
  phone=$(python3 -c "import json; print(json.load(open('$file'))['phone_number'])")
  exec docker compose exec -T orchestration-middleware-service \
    python -m src.demo_cli "$phone" "$ONLY" --reset
fi

exec docker compose exec -T orchestration-middleware-service python -m src.demo_cli --ensure
