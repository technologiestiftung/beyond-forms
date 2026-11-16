#!/bin/sh
set -e

# Only local Compose sets this; Cloud Run migrates through the separate migrate job.
if [ "$RUN_MIGRATIONS" = "true" ]; then
    alembic upgrade head
fi

exec "$@"
