#!/usr/bin/env bash
# Usage: upsert-pr-comment.sh <body>
# Edits the workflow's own PR comment containing $COMMENT_MARKER, or creates it.
# Requires GH_TOKEN, GITHUB_REPOSITORY, PR_NUMBER and COMMENT_MARKER.
set -euo pipefail

BODY="$1"

COMMENT_ID=$(gh api "repos/$GITHUB_REPOSITORY/issues/$PR_NUMBER/comments" --paginate \
  --jq ".[] | select(.user.login == \"github-actions[bot]\" and (.body | contains(\"$COMMENT_MARKER\"))) | .id" | sed -n '1p')

if [ -n "$COMMENT_ID" ]; then
  gh api --method PATCH "repos/$GITHUB_REPOSITORY/issues/comments/$COMMENT_ID" -f body="$BODY" > /dev/null
else
  gh api --method POST "repos/$GITHUB_REPOSITORY/issues/$PR_NUMBER/comments" -f body="$BODY" > /dev/null
fi
