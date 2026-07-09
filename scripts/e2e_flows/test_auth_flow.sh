#!/bin/bash
# test_auth_flow.sh - Verifies the end-to-end authentication flow of the auth-service.
#
# This script performs the following steps for both Cookie and Header based auth:
# 1. Starts a login flow for a test phone number.
# 2. Completes the login flow.
# 3. Verifies the resulting RS256 JWT (OIDC ID Token).
#
# It relies on the auth-service being reachable at http://localhost:8003.

set -e

# Configuration
AUTH_SERVICE_URL="http://localhost:8003"
PHONE_NUMBER_1="+493023125123" # Berlin
PHONE_NUMBER_2="+496990009123" # Frankfurt
CODE="123456"

echo "==========================================="
echo "Testing Authentication Flows"
echo "==========================================="

###############################################################################
# FLOW 1: Cookie-based Authentication (Browser Pattern)
###############################################################################
echo -e "\n>>> FLOW 1: Cookie-based Authentication"

# Create a temporary file for cookies
COOKIE_FILE=$(mktemp)
trap 'rm -f "$COOKIE_FILE"' EXIT

echo "Step 1: Starting Login for $PHONE_NUMBER_1 (Initial session cookie)"
START_RES=$(curl -s -X POST "$AUTH_SERVICE_URL/login/start" \
  -H "Content-Type: application/json" \
  -d "{\"phone_number\": \"$PHONE_NUMBER_1\"}" \
  -c "$COOKIE_FILE")

echo "Response: $START_RES"

if [[ "$START_RES" == *"Test Account flow started"* ]]; then
    echo "✅ Success: Login flow initialized"
else
    echo "❌ Error: Unexpected start response"
    exit 1
fi

echo -e "\nStep 2: Finishing Login (Session cookie + SMS code)"
FINISH_RES=$(curl -s -X POST "$AUTH_SERVICE_URL/login/finish" \
  -H "Content-Type: application/json" \
  -d "{\"code\": \"$CODE\"}" \
  -b "$COOKIE_FILE" \
  -c "$COOKIE_FILE")

echo "Response: $FINISH_RES"

SUCCESS=$(echo "$FINISH_RES" | python3 -c "import sys, json; print(json.load(sys.stdin).get('success', False))")
if [ "$SUCCESS" == "True" ]; then
    echo "✅ Success: Login completed"
else
    echo "❌ Error: Login finish failed"
    exit 1
fi

echo -e "\nStep 3: Verifying Auth (Final JWT cookie)"
VERIFY_RES=$(curl -s "$AUTH_SERVICE_URL/verify_auth" -b "$COOKIE_FILE")

echo "Verification Response: $VERIFY_RES"

if [[ "$VERIFY_RES" == *"\"is_authenticated\":true"* ]] && [[ "$VERIFY_RES" == *"$PHONE_NUMBER_1"* ]]; then
    echo "✅ Success: Cookie-based auth verified for $PHONE_NUMBER_1"
else
    echo "❌ Error: Auth verification failed"
    exit 1
fi

###############################################################################
# FLOW 2: Header-based Authentication (Pure API Pattern)
###############################################################################
echo -e "\n>>> FLOW 2: Header-based Authentication"

echo "Step 1: Starting Login for $PHONE_NUMBER_2 (Extracting token from body)"
START_RES_HDR=$(curl -s -X POST "$AUTH_SERVICE_URL/login/start" \
  -H "Content-Type: application/json" \
  -d "{\"phone_number\": \"$PHONE_NUMBER_2\"}")

echo "Response: $START_RES_HDR"

TOKEN_START=$(echo "$START_RES_HDR" | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))")
FLOW_HINT=$(echo "$START_RES_HDR" | python3 -c "import sys, json; print(json.load(sys.stdin).get('flow', ''))")

if [ -n "$TOKEN_START" ] && [ "$TOKEN_START" != "None" ]; then
    echo "✅ Success: Received token in body ($FLOW_HINT)"
else
    echo "❌ Error: No token returned in start response body"
    exit 1
fi

echo -e "\nStep 2: Finishing Login (Authorization & Flow headers)"
FINISH_RES_HDR=$(curl -s -X POST "$AUTH_SERVICE_URL/login/finish" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_START" \
  -H "X-BeyondForms-Auth-Flow: $FLOW_HINT" \
  -d "{\"code\": \"$CODE\"}")

echo "Response: $FINISH_RES_HDR"

TOKEN_FINAL=$(echo "$FINISH_RES_HDR" | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))")
if [ -n "$TOKEN_FINAL" ] && [ "$TOKEN_FINAL" != "None" ]; then
    echo "✅ Success: Received final JWT in body"
else
    echo "❌ Error: No token returned in finish response body"
    exit 1
fi

echo -e "\nStep 3: Verifying Auth (Bearer header)"
VERIFY_RES_HDR=$(curl -s "$AUTH_SERVICE_URL/verify_auth" \
  -H "Authorization: Bearer $TOKEN_FINAL")

echo "Verification Response: $VERIFY_RES_HDR"

if [[ "$VERIFY_RES_HDR" == *"\"is_authenticated\":true"* ]] && [[ "$VERIFY_RES_HDR" == *"$PHONE_NUMBER_2"* ]]; then
    echo "✅ Success: Header-based auth verified for $PHONE_NUMBER_2"
else
    echo "❌ Error: Auth verification failed"
    exit 1
fi

###############################################################################
# FLOW 3: Negative Testing (Invalid Tokens)
###############################################################################
echo -e "\n>>> FLOW 3: Negative Testing"

echo "Step 1: Verifying Auth with Invalid Token Header"
INVALID_HDR_RES=$(curl -s "$AUTH_SERVICE_URL/verify_auth" \
  -H "Authorization: Bearer definitely-not-a-valid-token")

echo "Response: $INVALID_HDR_RES"

if [[ "$INVALID_HDR_RES" == *"\"is_authenticated\":false"* ]]; then
    echo "✅ Success: Invalid token header correctly rejected"
else
    echo "❌ Error: Invalid token header was NOT rejected"
    exit 1
fi

echo -e "\nStep 2: Verifying Auth with Missing Authentication"
MISSING_RES=$(curl -s "$AUTH_SERVICE_URL/verify_auth")

echo "Response: $MISSING_RES"

if [[ "$MISSING_RES" == *"\"is_authenticated\":false"* ]]; then
    echo "✅ Success: Missing auth correctly handled"
else
    echo "❌ Error: Missing auth was NOT handled correctly"
    exit 1
fi

###############################################################################
# DB VALIDATION
###############################################################################
echo -e "\n>>> Final Validation: Database Consistency"

# Load DB credentials from auth-service .env
ENV_FILE="services/auth-service/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "Error: .env file not found at $ENV_FILE"
    exit 1
fi

# Extract DB config using grep/sed
DB_HOST=$(grep "^DB_HOST=" "$ENV_FILE" | cut -d'=' -f2 | tr -d '\r')
DB_USER=$(grep "^DB_USER=" "$ENV_FILE" | cut -d'=' -f2 | tr -d '\r')
DB_NAME=$(grep "^DB_NAME=" "$ENV_FILE" | cut -d'=' -f2 | tr -d '\r')

if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_NAME" ]; then
    echo "Error: Could not extract DB_HOST, DB_USER or DB_NAME from $ENV_FILE"
    exit 1
fi

# Query the database to check if both users exist
for PHONE in "$PHONE_NUMBER_1" "$PHONE_NUMBER_2"; do
    DB_CHECK=$(docker exec "$DB_HOST" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT phone_number FROM users WHERE phone_number = '$PHONE';" | xargs)
    if [ "$DB_CHECK" == "$PHONE" ]; then
        echo "✅ Success: User entry found in database for $PHONE"
    else
        echo "❌ Error: User entry NOT found in database for $PHONE"
        exit 1
    fi
done

echo -e "\n🎉 ALL TESTS PASSED SUCCESSFULLY!"
