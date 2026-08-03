#!/bin/bash
# export_demo_pdfs.sh - Writes each persona's filled application PDF and all of its
# document blobs into demo/exports/<slug>/ for review.
#
#   ./scripts/export_demo_pdfs.sh              # all personas
#   ./scripts/export_demo_pdfs.sh helmut       # just one
#
# Assumes the personas are already seeded (./scripts/seed_demo_personas.sh).
# Everything it writes is regenerable — see demo/exports/README.md.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_URL="${API_URL:-http://localhost:8080}"
PERSONAS_DIR="$REPO_ROOT/demo/personas"
EXPORT_ROOT="$REPO_ROOT/demo/exports"
ONLY="${1:-}"

command -v jq >/dev/null || { echo "error: jq is required" >&2; exit 1; }
curl -sSf "$API_URL/health" >/dev/null 2>&1 || { echo "error: middleware not reachable at $API_URL" >&2; exit 1; }

failures=0

for file in "$PERSONAS_DIR"/*.json; do
  slug=$(jq -r '.slug' "$file")
  phone=$(jq -r '.phone_number' "$file")
  form_type=$(jq -r '.application.form_type' "$file")
  [ -n "$ONLY" ] && [ "$ONLY" != "$slug" ] && continue

  echo "=== $slug ==="
  out="$EXPORT_ROOT/$slug"
  mkdir -p "$out/documents"
  rm -f "$out"/*.pdf "$out"/documents/* 2>/dev/null

  token=$("$REPO_ROOT/scripts/demo_token.sh" "$phone") || { echo "  ✗ login failed"; failures=$((failures+1)); continue; }
  token="${token%$'\n'}"
  auth="Authorization: Bearer $token"

  # 1. The filled application PDF, via the signed URL the export endpoint returns.
  export_json=$(curl -sS "$API_URL/export/$form_type" -H "$auth")
  url=$(printf '%s' "$export_json" | jq -r '.signed_open_url // .signed_download_url // empty')
  if [ -n "$url" ]; then
    if curl -sSL "$url" -o "$out/$form_type.pdf" 2>/dev/null && [ -s "$out/$form_type.pdf" ]; then
      size=$(wc -c < "$out/$form_type.pdf" | tr -d ' ')
      echo "  ✓ $form_type.pdf ($size bytes)"
    else
      echo "  ✗ could not download the filled PDF"; failures=$((failures+1))
    fi
  else
    echo "  ✗ export returned no URL:"; printf '%s\n' "$export_json" | head -3
    failures=$((failures+1))
  fi

  # 2. Every document blob, named <status>_<slot>_<original name> so the state is
  #    obvious in a file listing.
  curl -sS "$API_URL/files" -H "$auth" \
    | jq -r '.[] | [.document_id, .document_type, .status, .object_name] | @tsv' \
    | while IFS=$'\t' read -r id slot status object_name; do
        human="${object_name#*_}"
        target="$out/documents/${status}_${slot}_${human}"
        code=$(curl -sS -o "$target" -w '%{http_code}' "$API_URL/api/v1/documents/$id/file" -H "$auth")
        if [ "$code" = "200" ]; then
          printf '      %-16s %-18s %s\n' "$status" "$slot" "$(basename "$target")"
        else
          rm -f "$target"
          printf '      %-16s %-18s HTTP %s\n' "$status" "$slot" "$code"
        fi
      done
done

echo
echo "Written to demo/exports/ — open the PDFs to review what each persona produces."
exit $((failures > 0 ? 1 : 0))
