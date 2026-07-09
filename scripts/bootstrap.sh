#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🚀 Starting cross-team environment bootstrap...${NC}\n"

NETWORK_NAME="app-network"
if [ ! "$(docker network ls | grep $NETWORK_NAME)" ]; then
  echo -e "Creating Docker network: ${YELLOW}$NETWORK_NAME${NC}..."
  docker network create $NETWORK_NAME
else
  echo -e "Docker network ${YELLOW}$NETWORK_NAME${NC} already exists."
fi

echo -e "\nSetting up environment files..."

find . -name ".env.template" | while read -r template_file; do
    env_file="${template_file%.template}"

    if [ -f "$env_file" ]; then
        echo -e "Skipping: ${YELLOW}$env_file${NC} (already exists)"
    else
        cp "$template_file" "$env_file"
        echo -e "Created: ${GREEN}$env_file${NC}"
    fi
done

echo -e "\nSetting up OIDC signing keys..."
CERT_DIR="auth/certs"
OIDC_PRIVATE_KEY="$CERT_DIR/priv/oidc_private.pem"
OIDC_PUBLIC_CERT="$CERT_DIR/pub/oidc_public.pem"

if [ ! -d "$CERT_DIR/priv" ] || [ ! -d "$CERT_DIR/pub" ]; then
    mkdir -p "$CERT_DIR/priv"
    mkdir -p "$CERT_DIR/pub"
fi

if [ ! -f "$OIDC_PRIVATE_KEY" ] || [ ! -f "$OIDC_PUBLIC_CERT" ]; then
    echo -e "Generating OIDC signing keys in ${YELLOW}$CERT_DIR/${NC}..."
    openssl req -x509 -newkey rsa:2048 -keyout "$OIDC_PRIVATE_KEY" -out "$OIDC_PUBLIC_CERT" -days 3650 -nodes -subj "/CN=BeyondForms Dev"

    # Validate creation and integrity for newly created keys
    if [ -f "$OIDC_PRIVATE_KEY" ] && [ -f "$OIDC_PUBLIC_CERT" ] && \
       openssl x509 -in "$OIDC_PUBLIC_CERT" -noout && \
       openssl rsa -in "$OIDC_PRIVATE_KEY" -check -noout > /dev/null 2>&1; then
        echo -e "${GREEN}Created and validated: $OIDC_PRIVATE_KEY and $OIDC_PUBLIC_CERT${NC}"
    else
        echo -e "${RED}Error: Failed to create or validate OIDC signing keys.${NC}"
        exit 1
    fi
else
    echo -e "OIDC signing keys already exist in ${YELLOW}$CERT_DIR/${NC}."
fi

echo -e "\nChecking LLM configuration..."
if grep -q "LLM_ENDPOINT" .env 2>/dev/null; then
    echo -e "${GREEN}Ready!${NC} Remember to update your root .env with your LLM API keys or local endpoint."
else
    echo -e "${YELLOW}Note:${NC} No global LLM variables found in root .env. Ensure your service .envs are configured."
fi

echo -e "\n${BLUE} Bootstrap complete. You are ready to develop!${NC}"
echo -e "Next step: Run 'docker compose up -d' in the root or a specific service folder."
