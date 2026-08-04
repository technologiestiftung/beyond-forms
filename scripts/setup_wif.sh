#!/bin/bash
set -e

# Configuration
PROJECT_ID=$(gcloud config get-value project)
POOL_NAME="github-pool"
PROVIDER_NAME="github-provider"
SA_NAME="github-actions"
REPO="technologiestiftung/beyond-forms" # Adjust if your repo differs
REGION="europe-west3" # Adjust if needed, or prompt user

echo "Using Project: $PROJECT_ID"
echo "Repo: $REPO"

# 1. Enable Services
echo "Enabling required services..."
gcloud services enable iamcredentials.googleapis.com \
    artifactregistry.googleapis.com \
    iam.googleapis.com

# 2. Create Workload Identity Pool
if ! gcloud iam workload-identity-pools describe $POOL_NAME --location="global" &>/dev/null; then
    echo "Creating Workload Identity Pool..."
    gcloud iam workload-identity-pools create $POOL_NAME \
        --location="global" \
        --display-name="GitHub Actions Pool"
else
    echo "Pool $POOL_NAME already exists."
fi

# 3. Create Provider
if ! gcloud iam workload-identity-pools providers describe $PROVIDER_NAME --location="global" --workload-identity-pool=$POOL_NAME &>/dev/null; then
    echo "Creating Identity Provider..."
    gcloud iam workload-identity-pools providers create-oidc $PROVIDER_NAME \
        --location="global" \
        --workload-identity-pool=$POOL_NAME \
        --display-name="GitHub Actions Provider" \
        --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
        --attribute-condition="assertion.repository=='$REPO'" \
        --issuer-uri="https://token.actions.githubusercontent.com"
else
    echo "Provider $PROVIDER_NAME already exists."
fi

# 4. Create Service Account
if ! gcloud iam service-accounts describe "${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" &>/dev/null; then
    echo "Creating Service Account..."
    gcloud iam service-accounts create $SA_NAME \
        --display-name="GitHub Actions Service Account"
else
    echo "Service Account $SA_NAME already exists."
fi

SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# 5. Grant Permissions to Service Account (Artifact Registry Writer)
echo "Granting Artifact Registry permissions..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/artifactregistry.writer"

# 6. Bind Service Account to Workload Identity Pool
echo "Binding Service Account to Pool..."
gcloud iam service-accounts add-iam-policy-binding $SA_EMAIL \
    --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/projects/$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')/locations/global/workloadIdentityPools/$POOL_NAME/attribute.repository/$REPO"

# 7. Output Secrets for GitHub
POOL_ID=$(gcloud iam workload-identity-pools describe $POOL_NAME --location="global" --format='value(name)')
PROVIDER_ID="$POOL_ID/providers/$PROVIDER_NAME"

echo ""
echo "===================================================="
echo "SETUP COMPLETE!"
echo "===================================================="
echo "Please set the following Secrets in your GitHub Repository:"
echo ""
echo "GCP_WORKLOAD_IDENTITY_PROVIDER: $PROVIDER_ID"
echo "GCP_SERVICE_ACCOUNT: $SA_EMAIL"
echo ""
echo "And these Variables:"
echo "GCP_PROJECT_ID: $PROJECT_ID"
echo "GCP_REGION: $REGION"
echo "===================================================="
