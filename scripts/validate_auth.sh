#!/bin/bash

# validate_auth.sh - Validates the end-to-end authentication setup.
#
# This script performs comprehensive checks on certificates, service status,
# environment variables, and Authentik blueprints.
#
# NOTE: Docker Compose must be running ('docker compose up -d') for this
# script to perform live validation of containers and databases.

# Configuration
AUTH_DIR="auth"
CERTS_DIR="$AUTH_DIR/certs"
PRIVATE_KEY="$CERTS_DIR/priv/oidc_private.pem"
PUBLIC_CERT="$CERTS_DIR/pub/oidc_public.pem"
AUTH_SERVICE_ENV="services/auth-service/.env"
AUTH_ENV_TEMPLATE="auth/.env.template"
BLUEPRINT_FILE="auth/blueprints/oidc-provider.yaml"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🔐 Validating Authentication Setup...${NC}\n"

# 1. Certificate Presence
# Relevance: Authentik uses these for OIDC signing.
# Lack of certs will cause the blueprint to fail when loading.
echo -n "Checking OIDC signing keys... "
if [[ -f "$PRIVATE_KEY" && -f "$PUBLIC_CERT" ]]; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}MISSING${NC}"
    echo -e "${YELLOW}Fix: Run './scripts/bootstrap.sh' to generate signing keys.${NC}"
fi

# 2. Docker Volume Presence and Content (certs_vol)
# Relevance: Authentik needs the certs inside a volume to handle permissions properly.
# Without this, Authentik might go into a crash-loop.
echo -n "Checking 'certs_vol' volume content... "
VOLUME_NAME=$(docker volume ls -q | grep "certs_vol" | head -n 1)
if [[ -n "$VOLUME_NAME" ]] && docker run --rm -v "$VOLUME_NAME":/certs alpine ls /certs/pub/oidc_public.pem /certs/priv/oidc_private.pem > /dev/null 2>&1; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}ERROR${NC}"
    echo -e "${YELLOW}Fix: Ensure the 'init-data' service in 'auth/compose.yml' ran successfully to populate the volume.${NC}"
fi

# 3. Running Containers
# Relevance: Essential services must be running for authentication to work.
echo "Checking running containers..."
REQUIRED_SERVICES=("authentik-server" "authentik-worker" "auth-service")
RUNNING_SERVICES=$(docker compose ps --format '{{.Service}}' --filter "status=running")

for service in "${REQUIRED_SERVICES[@]}"; do
    echo -n "  $service: "
    if echo "$RUNNING_SERVICES" | grep -q "^$service$"; then
        echo -e "${GREEN}RUNNING${NC}"
    else
        echo -e "${RED}NOT RUNNING${NC}"
        echo -e "${YELLOW}Fix: Run 'docker compose up -d $service' or check logs with 'docker logs $(docker compose ps -q $service)'.${NC}"
    fi
done

# 4. Auth-Service Cert Mounting
# Relevance: Auth-service needs the public cert to verify OIDC tokens issued by Authentik.
echo -n "Checking public cert availability in 'auth-service' container... "
AUTH_SERVICE_CONTAINER=$(docker compose ps -q auth-service)
if [[ -n "$AUTH_SERVICE_CONTAINER" ]] && docker exec "$AUTH_SERVICE_CONTAINER" ls /app/auth/certs/pub/oidc_public.pem > /dev/null 2>&1; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}MISSING${NC}"
    echo -e "${YELLOW}Fix: Check the volume mount for 'auth-service' in 'compose.yaml'. It should mount './auth/certs/pub/oidc_public.pem'.${NC}"
fi

# 5. Authentik Cert Mounting (volume check)
# Relevance: Authentik server and worker must have both private and public keys for signing.
# These are synced from host by the 'init-data' service into 'certs_vol'.
echo "Checking cert availability in Authentik containers (via certs_vol)..."
for service in "authentik-server" "authentik-worker"; do
    echo -n "  $service: "
    CONTAINER=$(docker compose ps -q "$service")
    if [[ -n "$CONTAINER" ]] && docker exec "$CONTAINER" ls /certs/pub/oidc_public.pem > /dev/null 2>&1 && docker exec "$CONTAINER" ls /certs/priv/oidc_private.pem > /dev/null 2>&1; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}MISSING${NC}"
        echo -e "${YELLOW}Fix: Ensure the 'init-data' service in 'auth/compose.yml' ran successfully and 'certs_vol' is mounted.${NC}"
    fi
done

# 6. Environment Variables in auth-service
# Relevance: Auth-service must be configured with the correct OIDC credentials to communicate with Authentik.
echo "Checking 'auth-service' environment variables (live)..."
AUTH_SERVICE_CONTAINER=$(docker compose ps -q auth-service)
if [[ -z "$AUTH_SERVICE_CONTAINER" ]]; then
    echo -e "  ${RED}ERROR: auth-service container not found.${NC}"
else
    # Extract OIDC config from the running container
    ENV_ID=$(docker exec "$AUTH_SERVICE_CONTAINER" printenv OIDC_CLIENT_ID)
    ENV_SECRET=$(docker exec "$AUTH_SERVICE_CONTAINER" printenv OIDC_CLIENT_SECRET)

    # Extract expected values from blueprint
    BLUEPRINT_ID=$(grep "client_id:" "$BLUEPRINT_FILE" | awk '{print $2}')
    BLUEPRINT_SECRET=$(grep "client_secret:" "$BLUEPRINT_FILE" | awk '{print $2}')

    echo -n "  OIDC_CLIENT_ID ($ENV_ID): "
    if [[ "$ENV_ID" == "$BLUEPRINT_ID" ]]; then
        echo -e "${GREEN}MATCHES BLUEPRINT${NC}"
    else
        echo -e "${RED}MISMATCH${NC} (Expected: $BLUEPRINT_ID)"
        echo -e "  ${YELLOW}Fix: Update OIDC_CLIENT_ID in 'services/auth-service/.env' and restart.${NC}"
    fi

    echo -n "  OIDC_CLIENT_SECRET: "
    if [[ "$ENV_SECRET" == "$BLUEPRINT_SECRET" ]]; then
        echo -e "${GREEN}MATCHES BLUEPRINT${NC}"
    else
        echo -e "${RED}MISMATCH${NC} (Expected: $BLUEPRINT_SECRET)"
        echo -e "  ${YELLOW}Fix: Update OIDC_CLIENT_SECRET in 'services/auth-service/.env' and restart.${NC}"
    fi
fi

# 7. Service Accessibility
# Relevance: Authentik must be reachable via the network.
echo -n "Checking Authentik Server accessibility (http://localhost:9000)... "
if curl -s --head http://localhost:9000 | head -n 1 | grep -q "200\|302"; then
    echo -e "${GREEN}REACHABLE${NC}"
else
    echo -e "${RED}UNREACHABLE${NC}"
    echo -e "${YELLOW}Fix: Ensure 'authentik-server' is running and port 9000 is mapped correctly.${NC}"
fi

# 8. Blueprint Application Status
# Relevance: Blueprints configure the OIDC provider, flows, and applications.
# If they fail to apply, the authentication logic will be missing or broken.
echo "Checking Authentik blueprint application status..."
DB_CONTAINER=$(docker compose ps -q authentik-postgresql)
if [[ -z "$DB_CONTAINER" ]]; then
    echo -e "  ${RED}ERROR: authentik-postgresql container not found.${NC}"
else
    # Check for our custom blueprints
    BLUEPRINTS=("custom/oidc-provider.yaml" "custom/passwordless-sms-enrollment.yaml" "custom/passwordless-sms-login.yaml" "custom/username-password-enrollment.yaml")

    for bp in "${BLUEPRINTS[@]}"; do
        echo -n "  $bp: "
        STATUS=$(docker exec "$DB_CONTAINER" psql -U authentik -d authentik -t -c "SELECT status FROM authentik_blueprints_blueprintinstance WHERE name = '$bp';" | xargs)

        if [[ "$STATUS" == "successful" ]]; then
            echo -e "${GREEN}SUCCESSFUL${NC}"
        elif [[ -z "$STATUS" ]]; then
            echo -e "${RED}NOT FOUND${NC}"
            echo -e "    ${YELLOW}Fix: Ensure the blueprint file exists in 'auth/blueprints/' and is correctly mounted.${NC}"
        else
            echo -e "${RED}FAILED${NC} (Status: $STATUS)"
            echo -e "    ${YELLOW}Fix: Check 'authentik-worker' logs for blueprint application errors.${NC}"
        fi
    done
fi

# 9. Twilio Credentials (SMS Support)
# Relevance: Twilio is required for passwordless SMS enrollment and login.
# Without valid credentials, real users won't be able to receive verification codes.
echo -n "Checking Twilio SMS credentials... "
AUTHENTIK_CONTAINER=$(docker compose ps -q authentik-server)
if [[ -n "$AUTHENTIK_CONTAINER" ]]; then
    TWILIO_SID=$(docker exec "$AUTHENTIK_CONTAINER" printenv AUTHENTIK_SMS__PROVIDERS__TWILIO__ACCOUNT_SID 2>/dev/null)
    TWILIO_TOKEN=$(docker exec "$AUTHENTIK_CONTAINER" printenv AUTHENTIK_SMS__PROVIDERS__TWILIO__AUTH_TOKEN 2>/dev/null)

    # Extract template values for comparison
    TEMPLATE_SID=$(grep "AUTHENTIK_SMS__PROVIDERS__TWILIO__ACCOUNT_SID=" "$AUTH_ENV_TEMPLATE" | cut -d'=' -f2)
    TEMPLATE_TOKEN=$(grep "AUTHENTIK_SMS__PROVIDERS__TWILIO__AUTH_TOKEN=" "$AUTH_ENV_TEMPLATE" | cut -d'=' -f2)

    if [[ -n "$TWILIO_SID" && "$TWILIO_SID" != "$TEMPLATE_SID" && -n "$TWILIO_TOKEN" && "$TWILIO_TOKEN" != "$TEMPLATE_TOKEN" ]]; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${YELLOW}WARNING${NC}"
        echo -e "    ${YELLOW}Warning: AUTHENTIK_SMS__PROVIDERS__TWILIO__ACCOUNT_SID/AUTH_TOKEN are using default template values or are unset.${NC}"
        echo -e "    ${YELLOW}Real accounts cannot be created as there's no SMS support.${NC}"
    fi
else
    echo -e "${RED}ERROR: authentik-server container not found.${NC}"
fi

# 10. Functional End-to-End Auth Flow
# Relevance: This performs a real login flow to ensure all components (Authentik,
# auth-service, database) work together to issue and verify tokens.
echo -e "\nRunning functional end-to-end auth flow test..."
if [[ -f "./scripts/e2e_flows/test_auth_flow.sh" ]]; then
    if ./scripts/e2e_flows/test_auth_flow.sh; then
        echo -e "\n${GREEN}✅ Functional test passed!${NC}"
    else
        echo -e "\n${RED}❌ Functional test failed!${NC}"
        echo -e "${YELLOW}Fix: Review the errors above and check service logs.${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}Warning: ./scripts/e2e_flows/test_auth_flow.sh not found, skipping.${NC}"
fi


echo -e "\n${BLUE}Validation complete!${NC}"
