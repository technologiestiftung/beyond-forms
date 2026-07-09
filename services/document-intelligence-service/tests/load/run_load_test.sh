#!/usr/bin/env bash
# ==============================================================================
# BeyondForms Document Intelligence Service Load Test Runner
# Runs a headless Locust test targeting the /classify endpoint.
# ==============================================================================

set -euo pipefail

# Resolve script directory for absolute path resilience
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Input parameter: URL endpoint
RAW_HOST="${1:-http://localhost:8001}"

# Clean the host parameter: strip trailing slashes and /classify suffix if present
TARGET_HOST="${RAW_HOST%/}"
if [[ "$TARGET_HOST" == */classify ]]; then
    TARGET_HOST="${TARGET_HOST%/classify}"
fi

RUN_TIME="${2:-1m}"
USERS="${3:-10}"
SPAWN_RATE="${4:-2}"
REPORT_DIR="/tmp/beyondforms-doc-intel-reports"

mkdir -p "$REPORT_DIR"

echo "=============================================================================="
echo "🚀 Starting Document Intelligence Service Load Test"
echo "🌐 Raw Input Endpoint: $RAW_HOST"
echo "🌐 Resolved Base Host: $TARGET_HOST"
echo "👥 Concurrent Users: $USERS | Spawn Rate: $SPAWN_RATE/sec | Duration: $RUN_TIME"
echo "=============================================================================="

# Check for uv package manager
if ! command -v uv &> /dev/null; then
    echo "⚠️  uv tool not found. Falling back to standard pip..."
    PIP_CMD="pip"
else
    PIP_CMD="uv pip"
fi

# Verify locust installation
if ! python3 -c "import locust" &> /dev/null; then
    echo "📦 Installing Locust load generator dependency..."
    if [ "$PIP_CMD" = "uv pip" ]; then
        uv pip install locust
    else
        pip install locust
    fi
fi

# Determine execution prefix
if command -v uv &> /dev/null; then
    RUN_PREFIX="uv run"
else
    RUN_PREFIX=""
fi

# Run Locust in Headless Mode
echo "🔥 Swarming target system... Running for $RUN_TIME..."
set +e # Allow command failure to parse and return exit codes gracefully

$RUN_PREFIX python3 -m locust \
    -f "$SCRIPT_DIR/locustfile.py" \
    --headless \
    -u "$USERS" \
    -r "$SPAWN_RATE" \
    --run-time "$RUN_TIME" \
    --host "$TARGET_HOST" \
    --html "$REPORT_DIR/report.html" \
    --csv "$REPORT_DIR/metrics" \
    --exit-code-on-error 1 \
    --only-summary

LOCUST_EXIT_CODE=$?
set -e

echo "=============================================================================="
echo "📊 Performance Report Generated at: $REPORT_DIR/report.html"
echo "📝 Raw Responses Appended to:        $REPORT_DIR/raw_responses.jsonl"
if [ "$LOCUST_EXIT_CODE" -eq 0 ]; then
    echo "🟢 Load test completed successfully with zero failures."
else
    echo "❌ Load test completed with failures/errors (Exit Code: $LOCUST_EXIT_CODE)."
fi
echo "=============================================================================="

exit "$LOCUST_EXIT_CODE"
