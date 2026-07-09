#!/bin/bash
set -e

# Usage: ./grant_image_pull.sh [GKE_PROJECT_ID] [REGISTRY_PROJECT_ID] [CUSTOM_SA_EMAIL]

GKE_PROJECT_ID=${1:-"beyond-forms-staging"}
REGISTRY_PROJECT_ID=${2:-$(gcloud config get-value project)}
CUSTOM_SA=${3:-""}

echo "Configuring Image Pull Access..."
echo "GKE Project:      $GKE_PROJECT_ID"
echo "Registry Project: $REGISTRY_PROJECT_ID"

if [ -n "$CUSTOM_SA" ]; then
    SA_EMAIL="$CUSTOM_SA"
    echo "Using Custom Service Account: $SA_EMAIL"
else
    # Fetch Project Number to determine Default Compute SA
    echo "Fetching Project Number for $GKE_PROJECT_ID..."
    PROJECT_NUMBER=$(gcloud projects describe "$GKE_PROJECT_ID" --format="value(projectNumber)")
    SA_EMAIL="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
    echo "Assumed Default Compute SA: $SA_EMAIL"
    echo "NOTE: If your GKE cluster uses a custom service account for its nodes, please pass it as the 3rd argument."
fi

# Grant the permission
echo "Granting roles/artifactregistry.reader to $SA_EMAIL on $REGISTRY_PROJECT_ID..."
gcloud projects add-iam-policy-binding "$REGISTRY_PROJECT_ID" \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/artifactregistry.reader" \
    --condition=None

echo ""
echo "Success! Nodes in $GKE_PROJECT_ID (using $SA_EMAIL) can now pull images from $REGISTRY_PROJECT_ID."
