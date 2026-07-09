#!/usr/bin/env bash
# ==============================================================================
# BeyondForms Automated Performance Verification & Headless Load Test Runner
# Enforces strict 95th percentile latency and error rate budgets for staging CI.
# ==============================================================================

set -euo pipefail

# Resolve script directory for absolute path resilience
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

TARGET_HOST="${1:-http://localhost:8080}"
RUN_TIME="3m"
USERS=20
SPAWN_RATE=5
REPORT_DIR="/tmp/beyondforms-load-reports"


mkdir -p "$REPORT_DIR"

echo "=============================================================================="
echo "🚀 Starting BeyondForms Headless Load Test against $TARGET_HOST"
echo "👥 Concurrent Users: $USERS | Spawn Rate: $SPAWN_RATE/sec | Duration: $RUN_TIME"
echo "=============================================================================="

# Check for uv
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
        uv pip install locust websocket-client
    else
        pip install locust websocket-client
    fi
fi

# Run Locust in Headless Mode
# Generates full HTML reports and CSV metrics, exiting with 1 if any HTTP errors occur
echo "🔥 Swarming target system... Running for $RUN_TIME..."
set +e # Allow command failure to parse metrics ourselves

if command -v uv &> /dev/null; then
    RUN_PREFIX="uv run"
else
    RUN_PREFIX=""
fi

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
echo "=============================================================================="

# Parse the CSV stats to enforce custom performance thresholds
# Metrics files: metrics_stats.csv
STATS_CSV="$REPORT_DIR/metrics_stats.csv"

if [ -f "$STATS_CSV" ]; then
    echo "⚖️  Verifying Performance Budgets..."

    # Extract 95th percentile latency for PDF generation (GET /export/antrag_grundsicherung)
    EXPORT_95TH=$(grep -i "GET /export/" "$STATS_CSV" | awk -F',' '{print $19}' | sed 's/"//g' || echo "0")
    # Extract total error count and request count to calculate exact error rate
    TOTAL_STATS=$(tail -n 1 "$STATS_CSV")
    TOTAL_REQS=$(echo "$TOTAL_STATS" | awk -F',' '{print $3}' | sed 's/"//g')
    TOTAL_FAILS=$(echo "$TOTAL_STATS" | awk -F',' '{print $4}' | sed 's/"//g')

    if [ -z "$TOTAL_REQS" ] || [ "$TOTAL_REQS" -eq 0 ]; then
        echo "❌ Critical Error: Load test executed 0 requests. Check connectivity to $TARGET_HOST."
        exit 2
    fi

    ERROR_RATE=$(( (TOTAL_FAILS * 100) / TOTAL_REQS ))

    echo "  - GET /export/antrag_grundsicherung 95% Latency: ${EXPORT_95TH}ms (Limit: 5000ms)"
    echo "  - Total Requests: $TOTAL_REQS"
    echo "  - Total Failures: $TOTAL_FAILS (Error Rate: $ERROR_RATE%, Limit: 1%)"

    # 1. Enforce error rate budget (<= 1%)
    if [ "$ERROR_RATE" -gt 1 ]; then
        echo "❌ Performance Budget Violated: Total error rate is $ERROR_RATE%, exceeding the 1% threshold!"
        exit 3
    fi

    # 2. Enforce 95% PDF generation latency budget (<= 5s)
    # Export 95th is returned in milliseconds
    if [ -n "$EXPORT_95TH" ] && [ "$(echo "$EXPORT_95TH > 5000" | bc -l 2>/dev/null || echo "0")" -eq 1 ]; then
        echo "❌ Performance Budget Violated: 95th percentile latency for PDF export is ${EXPORT_95TH}ms, exceeding 5.0s!"
        exit 4
    fi

    echo "🟢 Performance verification SUCCESSFUL. All budgets met."
else
    echo "⚠️  Warning: Statistics CSV not found. Relying on Locust default exit status..."
    if [ "$LOCUST_EXIT_CODE" -ne 0 ]; then
        echo "❌ Load test failed due to request exceptions (Exit Code: $LOCUST_EXIT_CODE)."
        exit "$LOCUST_EXIT_CODE"
    fi
fi

exit 0
