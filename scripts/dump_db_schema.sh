#!/usr/bin/env bash
# Generates reference copies of the database schema from the local dev Postgres
# container. Requires it to be running and Docker + npx available.
#
# Produces:
#   libs/db-schema/index.ts     - TypeScript types
set -e

DB_CONTAINER="postgres"
DB_URL="postgresql://devuser:devpassword@localhost:5432/devdb"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="$SCRIPT_DIR/../libs/db-schema"

if ! docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
    echo "Error: '$DB_CONTAINER' container is not running. Start it with 'docker compose up -d postgres'."
    exit 1
fi

mkdir -p "$OUT_DIR"

echo "Generating TypeScript types..."
npx -y supabase gen types typescript --db-url "$DB_URL" > "$OUT_DIR/index.ts"

echo "Schema reference written to $OUT_DIR"
