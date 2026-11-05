#!/usr/bin/env bash
# Usage: remove-preview.sh <pr-number>
# Removes the pr-<number> tag and its revisions from the preview service.
# Requires SERVICE, PROJECT, REGION and gcloud logged in as the preview deploy identity.
set -euo pipefail

TAG="pr-$1"
GCP=(--project "$PROJECT" --region "$REGION")

SERVICE_JSON=$(gcloud run services describe "$SERVICE" "${GCP[@]}" --format=json)
TAGGED=$(jq --arg tag "$TAG" '[.spec.traffic[]? | select(.tag == $tag)] | length' <<< "$SERVICE_JSON")
if [ "$TAGGED" != 0 ]; then
  # All PRs update the same Cloud Run service, so a concurrent deploy can make an update fail.
  for n in 1 2 3 4; do
    gcloud run services update-traffic "$SERVICE" "${GCP[@]}" --remove-tags "$TAG" --quiet && break
    [ "$n" = 4 ] && exit 1
    echo "::warning::Attempt $n failed, retrying in $((n * 15))s"
    sleep $((n * 15))
  done
fi

gcloud run revisions list --service "$SERVICE" "${GCP[@]}" --format='value(metadata.name)' \
  | { grep -- "-$TAG-" || true; } \
  | while read -r rev; do
      gcloud run revisions delete "$rev" "${GCP[@]}" --quiet \
        || echo "::warning::Could not delete preview revision $rev"
    done
