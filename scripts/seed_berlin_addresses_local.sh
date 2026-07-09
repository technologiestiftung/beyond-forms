#!/usr/bin/env bash
# Seed Berlin address district lookup data from the official WFS JSON export.
#
# Usage:
#   ./scripts/seed_berlin_addresses_local.sh <path-to-adressen_berlin.json>
#
# Use this offical dataset as JSON: https://gdi.berlin.de/geonetwork/srv/ger/catalog.search#/metadata/634ab8ba-7694-333b-b95d-474d2aed0f7b

# Connects to the local Docker Postgres instance and streams the JSON data
# directly into the database without creating temporary files.

set -euo pipefail

FILE="${1:-${BERLIN_ADDRESSES_FILE:-}}"

if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  echo "Usage: $0 <path-to-adressen_berlin.json>"
  exit 1
fi

command -v jq >/dev/null 2>&1 || {
  echo "Error: jq is required" >&2
  exit 1
}

command -v psql >/dev/null 2>&1 || {
  echo "Error: psql is required" >&2
  exit 1
}

PGUSER="${POSTGRES_USER:-devuser}"
export PGPASSWORD="${POSTGRES_PASSWORD:-devpassword}"
PGDATABASE="${POSTGRES_DATABASE:-devdb}"
PGHOST="${POSTGRES_HOST:-localhost}"
PGPORT="${POSTGRES_PORT:-5432}"

DSN="postgresql://${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE}"

echo "Seeding local database at ${PGHOST}:${PGPORT}/${PGDATABASE}..."

(
  echo "TRUNCATE berlin_addresses RESTART IDENTITY;"
  echo "\COPY berlin_addresses (plz, street, hnr, bez_name) FROM STDIN WITH (FORMAT CSV);"
  jq -r '
    .features[] |
    .properties |
    select(.plz != null and .str_name != null and .hnr != null and .bez_name != null) |
    [
      (.plz | tostring | gsub("^\\s+|\\s+$"; "")),
      (.str_name | tostring | ascii_downcase | gsub("^\\s+|\\s+$"; "") | gsub("\\s+"; " ")),
      (
        (.hnr | tostring | ascii_downcase | gsub("\\s+"; "")) +
        (if .hnr_zusatz then (.hnr_zusatz | tostring | ascii_downcase | gsub("\\s+"; "")) else "" end)
      ),
      (.bez_name | tostring | gsub("^\\s+|\\s+$"; ""))
    ] | @csv
  ' "$FILE"
) | psql "$DSN" -v ON_ERROR_STOP=1

echo "Done!"
