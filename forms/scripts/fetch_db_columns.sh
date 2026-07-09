#!/bin/bash
# fetch_db_columns.sh - Fetches database columns and saves them to a file for validation.
set -e

# Configuration
DB_HOST="postgres"
DB_USER="devuser"
DB_NAME="devdb"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_FILE="${1:-$SCRIPT_DIR/db_columns.txt}"

echo "Fetching column names from the 'users' table in PostgreSQL..."

# Get columns and store in a variable (one per line, trimmed)
# Using DB_COLUMNS to avoid conflict with shell builtin COLUMNS
DB_COLUMNS=$(docker exec "$DB_HOST" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'users';" | sed 's/ //g' | tr -d '\r' | grep -v '^$')

if [ -z "$DB_COLUMNS" ]; then
    echo "Error: Failed to retrieve database columns. Make sure the postgres container is running."
    exit 1
fi

echo "$DB_COLUMNS" > "$OUTPUT_FILE"

COLUMN_COUNT=$(echo "$DB_COLUMNS" | wc -l)
echo "Successfully saved $COLUMN_COUNT columns to $OUTPUT_FILE."
