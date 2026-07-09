#!/bin/bash
# test_pdf_export.sh - Verifies the end-to-end PDF form export workflow.
#
# This script performs the following steps:
# 1. Authenticates via the auth-service.
# 2. Populates user profile data.
# 3. Triggers a PDF export and verifies the binary output.
#
set -e

# Config
MIDDLEWARE_URL="http://localhost:8080"
AUTH_URL="http://localhost:8003"
FORM_TYPE="test_form"

# Use a random sequential test number (Berlin range)
TS=$(date +%s)
PHONE_NUMBER="+493023125$((TS % 1000))"
CODE="123456"

echo "--- BeyondForms E2E Form Export Test ---"

# 1. Step 1: Create User via Auth Service Login
echo "[1/4] Step 1: Creating/Logging in user via $AUTH_URL..."

# Start login flow
START_RES=$(curl -s -X POST "$AUTH_URL/login/start" \
  -H "Content-Type: application/json" \
  -d "{\"phone_number\": \"$PHONE_NUMBER\"}")

TOKEN_START=$(echo "$START_RES" | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))")
FLOW_HINT=$(echo "$START_RES" | python3 -c "import sys, json; print(json.load(sys.stdin).get('flow', ''))")

if [ -z "$TOKEN_START" ] || [ "$TOKEN_START" == "None" ]; then
    echo "FAILURE: Could not start login flow"
    echo "$START_RES"
    exit 1
fi

# Finish login flow (this triggers get_or_create_user in auth-service)
FINISH_RES=$(curl -s -X POST "$AUTH_URL/login/finish" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_START" \
  -H "X-BeyondForms-Auth-Flow: $FLOW_HINT" \
  -d "{\"code\": \"$CODE\"}")

TOKEN=$(echo "$FINISH_RES" | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))")

if [ -z "$TOKEN" ] || [ "$TOKEN" == "None" ]; then
    echo "FAILURE: Could not finish login flow"
    echo "$FINISH_RES"
    exit 1
fi

echo "User created and authenticated."

# 2. Step 2: Populate User Profile Data
echo "[2/4] Step 2: Populating User Data via /profile..."
PROFILE_RESPONSE=$(curl -s -X POST "$MIDDLEWARE_URL/profile" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Max",
    "last_name": "Mustermann",
    "validate_entire_form": false
  }')

echo "Profile Response: $PROFILE_RESPONSE"

# 3. Step 3: Export PDF
echo "[3/4] Step 3: Exporting PDF via /export/$FORM_TYPE..."
EXPORT_DIR=$(mktemp -d)
EXPORT_PATH="$EXPORT_DIR/export_test.pdf"

HTTP_STATUS=$(curl -s -o "$EXPORT_PATH" -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  "$MIDDLEWARE_URL/export/$FORM_TYPE")

if [ "$HTTP_STATUS" -eq 200 ]; then
    FILE_SIZE=$(stat -c%s "$EXPORT_PATH")
    echo "SUCCESS: Received 200 OK"
    echo "SUCCESS: Exported PDF saved to $EXPORT_PATH ($FILE_SIZE bytes)"

    # Verify PDF header
    if head -n 1 "$EXPORT_PATH" | grep -q "%PDF"; then
        echo "SUCCESS: File header verified as PDF"
        echo "VERIFICATION_PATH: $EXPORT_PATH"
    else
        echo "FAILURE: File header is not %PDF"
        exit 1
    fi
else
    echo "FAILURE: Received status code $HTTP_STATUS"
    cat "$EXPORT_PATH"
    exit 1
fi

echo "[4/4] Final Step: Verify script completed."
echo "--- E2E Test Completed Successfully ---"
