#!/bin/bash
# Creates or updates the GCP and GitHub resources for .github/workflows/preview.yaml. Safe to re-run.
# Needs gcloud with admin rights on both projects and gh with admin rights on the repo.
set -euo pipefail

REPO="${REPO:-technologiestiftung/beyond-forms}"
POOL="github-pool"
SERVICE="bf-preview-wallet-frontend"
IMAGE_REPO="beyondforms-preview"

var() { gh variable get "$1" --repo "$REPO" "${@:2}"; }

REGION=$(var GCP_REGION)
DEPLOY_PROJECT=$(var GCP_DEPLOY_PROJECT_ID)
REGISTRY_PROJECT=$(var GCP_CIS_PROJECT_ID)
API_PROXY_URL=$(var API_PROXY_URL --env staging)
AUTH_PROXY_URL=$(var AUTH_PROXY_URL --env staging)
DEPLOYER="bf-preview-deployer@$DEPLOY_PROJECT.iam.gserviceaccount.com"
RUNTIME="bf-preview-runtime@$DEPLOY_PROJECT.iam.gserviceaccount.com"
# The GitHub Workload Identity pool lives in the registry project.
POOL_NAME=$(gcloud iam workload-identity-pools describe "$POOL" --location=global --project="$REGISTRY_PROJECT" --format='value(name)')
RUN_AGENT="service-$(gcloud projects describe "$DEPLOY_PROJECT" --format='value(projectNumber)')@serverless-robot-prod.iam.gserviceaccount.com"

echo "GitHub environment 'preview'..."
gh api --method PUT "repos/$REPO/environments/preview" > /dev/null
gh variable set API_PROXY_URL --repo "$REPO" --env preview --body "$API_PROXY_URL"
gh variable set AUTH_PROXY_URL --repo "$REPO" --env preview --body "$AUTH_PROXY_URL"

echo "Image repository $IMAGE_REPO..."
if ! gcloud artifacts repositories describe "$IMAGE_REPO" --location="$REGION" --project="$REGISTRY_PROJECT" &> /dev/null; then
  gcloud artifacts repositories create "$IMAGE_REPO" --repository-format=docker --location="$REGION" --project="$REGISTRY_PROJECT"
fi
POLICY=$(mktemp)
trap 'rm -f "$POLICY"' EXIT
echo '[{"name":"delete-after-30d","action":{"type":"Delete"},"condition":{"tagState":"any","olderThan":"30d"}}]' > "$POLICY"
gcloud artifacts repositories set-cleanup-policies "$IMAGE_REPO" --location="$REGION" --project="$REGISTRY_PROJECT" --policy="$POLICY" --no-dry-run > /dev/null

echo "Service accounts..."
for sa in "$DEPLOYER" "$RUNTIME"; do
  if ! gcloud iam service-accounts describe "$sa" --project="$DEPLOY_PROJECT" &> /dev/null; then
    gcloud iam service-accounts create "${sa%%@*}" --project="$DEPLOY_PROJECT"
  fi
done

echo "Permissions..."
gcloud artifacts repositories add-iam-policy-binding "$IMAGE_REPO" --location="$REGION" --project="$REGISTRY_PROJECT" \
  --member="serviceAccount:$DEPLOYER" --role=roles/artifactregistry.writer > /dev/null
gcloud artifacts repositories add-iam-policy-binding "$IMAGE_REPO" --location="$REGION" --project="$REGISTRY_PROJECT" \
  --member="serviceAccount:$RUN_AGENT" --role=roles/artifactregistry.reader > /dev/null
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME" --project="$DEPLOY_PROJECT" \
  --member="serviceAccount:$DEPLOYER" --role=roles/iam.serviceAccountUser > /dev/null
gcloud iam service-accounts add-iam-policy-binding "$DEPLOYER" --project="$DEPLOY_PROJECT" \
  --member="principal://iam.googleapis.com/$POOL_NAME/subject/repo:$REPO:environment:preview" \
  --role=roles/iam.workloadIdentityUser > /dev/null

echo "Cloud Run service $SERVICE..."
if ! gcloud run services describe "$SERVICE" --region="$REGION" --project="$DEPLOY_PROJECT" &> /dev/null; then
  gcloud run deploy "$SERVICE" --region="$REGION" --project="$DEPLOY_PROJECT" \
    --image="$REGION-docker.pkg.dev/$REGISTRY_PROJECT/beyondforms/wallet-frontend:latest" \
    --service-account="$RUNTIME" --no-invoker-iam-check --max-instances=2 \
    --set-env-vars="API_PROXY_URL=$API_PROXY_URL,AUTH_PROXY_URL=$AUTH_PROXY_URL" --quiet
fi
gcloud run services add-iam-policy-binding "$SERVICE" --region="$REGION" --project="$DEPLOY_PROJECT" \
  --member="serviceAccount:$DEPLOYER" --role=roles/run.developer > /dev/null

echo "Done."
