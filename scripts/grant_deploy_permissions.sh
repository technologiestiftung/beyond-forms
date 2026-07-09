#!/bin/bash
set -e

# Configuration
# The Service Account that needs permission (from your Artifact Registry/CI project)
# Default assumes the current project is the CI project, or you can set SA_EMAIL directly.
CI_PROJECT_ID=$(gcloud config get-value project)
SA_NAME="github-actions"
SA_EMAIL="${SA_NAME}@${CI_PROJECT_ID}.iam.gserviceaccount.com"

# The Target Project where GKE is running
TARGET_PROJECT_ID="beyond-forms-staging"

# Allow overrides via arguments
if [ "$1" ]; then
    SA_EMAIL=$1
fi
if [ "$2" ]; then
    TARGET_PROJECT_ID=$2
fi

echo "Granting permissions..."
echo "Service Account: $SA_EMAIL"
echo "Target Project:  $TARGET_PROJECT_ID"
echo "Role:            roles/container.developer"

# Verify TARGET_PROJECT_ID exists
if ! gcloud projects describe "$TARGET_PROJECT_ID" &>/dev/null; then
    echo "Error: Target project '$TARGET_PROJECT_ID' not found or you don't have access."
    exit 1
fi

# Grant the permission
gcloud projects add-iam-policy-binding "$TARGET_PROJECT_ID" \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/container.developer" \
    --condition=None

echo ""
echo "Success! $SA_EMAIL can now deploy to GKE clusters in $TARGET_PROJECT_ID."
