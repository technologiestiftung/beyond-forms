#!/usr/bin/env bash
# Seed Berlin address district lookup data from the official WFS JSON export.
#
# Usage:
#   CLOUD_SQL_INSTANCE=<instance> ./scripts/seed_berlin_addresses_cloud.sh <path-to-adressen_berlin.json>
#
# Use this offical dataset as JSON: https://gdi.berlin.de/geonetwork/srv/ger/catalog.search#/metadata/634ab8ba-7694-333b-b95d-474d2aed0f7b
#
# Connects to a GCP Cloud SQL instance using cloud-sql-proxy and streams the JSON data
# directly into the database without creating temporary files.

set -euo pipefail

FILE="${1:-${BERLIN_ADDRESSES_FILE:-}}"
INSTANCE="${CLOUD_SQL_INSTANCE:-}"
GCP_PROJECT="${GCP_PROJECT:-beyond-forms-staging}"

if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  echo "Usage: CLOUD_SQL_INSTANCE=<instance> $0 <path-to-adressen_berlin.json>"
  exit 1
fi

if [[ -z "$INSTANCE" ]]; then
  echo "Error: CLOUD_SQL_INSTANCE environment variable is required."
  echo "Format: project:region:instance-name"
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

command -v cloud-sql-proxy >/dev/null 2>&1 || {
  echo "Error: cloud-sql-proxy not found. Install: brew install cloud-sql-proxy" >&2
  exit 1
}

command -v gcloud >/dev/null 2>&1 || {
  echo "Error: gcloud is required" >&2
  exit 1
}

echo "Fetching database credentials from Secret Manager..."
PGUSER="$(gcloud secrets versions access latest --secret=AUTH_SERVICE_DB_USER --project="$GCP_PROJECT")"
export PGPASSWORD="$(gcloud secrets versions access latest --secret=AUTH_SERVICE_DB_PASSWORD --project="$GCP_PROJECT")"
PGDATABASE="${POSTGRES_DATABASE:-dev}"
PGHOST="127.0.0.1"
PGPORT="${POSTGRES_PORT:-5433}"

echo "Starting Cloud SQL Proxy on port $PGPORT..."
cloud-sql-proxy --port="$PGPORT" "$INSTANCE" &
PROXY_PID=$!

cleanup() {
  echo "Stopping Cloud SQL Proxy..."
  kill "$PROXY_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "Waiting for proxy to be ready..."
ready=0
for _ in $(seq 1 30); do
  if command -v nc >/dev/null 2>&1; then
    nc -z "$PGHOST" "$PGPORT" 2>/dev/null && ready=1 && break
  else
    if psql "postgresql://${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE}" -c "SELECT 1" >/dev/null 2>&1; then
      ready=1
      break
    fi
  fi
  sleep 0.5
done

if [[ "$ready" -ne 1 ]]; then
  echo "Error: Cloud SQL proxy did not become ready on port ${PGPORT}" >&2
  exit 1
fi

DSN="postgresql://${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE}"

echo "Seeding cloud database at ${PGHOST}:${PGPORT}/${PGDATABASE}..."

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
