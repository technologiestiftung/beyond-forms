#!/bin/bash

NETWORK_NAME="app-network"
SUBNET="192.168.10.0/24"
GATEWAY="192.168.10.1"

if docker network inspect $NETWORK_NAME >/dev/null 2>&1; then
    echo "Network $NETWORK_NAME already exists."
    # Optional: Check if it matches the desired subnet
    EXISTING_SUBNET=$(docker network inspect $NETWORK_NAME -f '{{(index .IPAM.Config 0).Subnet}}')
    if [ "$EXISTING_SUBNET" != "$SUBNET" ]; then
        echo "WARNING: Existing network has subnet $EXISTING_SUBNET, expected $SUBNET."
        echo "You may want to remove it: docker network rm $NETWORK_NAME"
    fi
else
    echo "Creating network $NETWORK_NAME with subnet $SUBNET and gateway $GATEWAY..."
    docker network create --subnet=$SUBNET --gateway=$GATEWAY $NETWORK_NAME
    echo "Network created successfully."
fi

echo ""
echo "NOTE: If you are running on Linux, your firewall might block container-to-host traffic."
echo "If you cannot access host services, verify your firewall settings."
echo "Auto-fix (Debian/UFW): sudo ufw allow in on br-\$(docker network inspect \$NETWORK_NAME -f '{{.Id}}' | cut -c 1-12) to any port 8000"
