#!/bin/bash
# extract_to_mapping.sh - Extracts fields from a PDF and creates a minimal TOML mapping.
set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <path_to_pdf>"
    exit 1
fi

PDF_PATH="$1"
if [ ! -f "$PDF_PATH" ]; then
    echo "Error: File not found: $PDF_PATH"
    exit 1
fi

PDF_NAME=$(basename "$PDF_PATH")
MAPPING_NAME="${PDF_NAME%.*}.toml"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAPPING_DIR="$(dirname "$SCRIPT_DIR")/mappings"
MAPPING_PATH="$MAPPING_DIR/$MAPPING_NAME"

mkdir -p "$MAPPING_DIR"

echo "Calling forms-filling-service to extract fields from $PDF_PATH..."

# Encode PDF and send via pipe to curl to avoid "Argument list too long" errors
RESPONSE=$(base64 < "$PDF_PATH" | tr -d '\n' | jq -Rs '{pdf_base64: .}' | curl -s -X POST "http://localhost:8005/api/fields" \
  -H "Content-Type: application/json" \
  -d @-)

if [ $? -ne 0 ] || echo "$RESPONSE" | grep -q "detail"; then
    echo "Error connecting to service or processing PDF."
    echo "Response: $RESPONSE"
    exit 1
fi

# Generate TOML mapping
{
    echo "# Field Mapping for $PDF_NAME"
    echo "# Run 'uv run --package orchestration-middleware-service forms/scripts/validate_mappings.py' to verify substitutions."
    echo "# Expressions wrapped in {{ }} are treated as JEXL."
    echo "# See JEXL syntax: https://commons.apache.org/proper/commons-jexl/reference/syntax.html"
    echo ""

    echo "$RESPONSE" | jq -c '.fields[]' | while read -r field; do
        ID=$(echo "$field" | jq -r '.id')
        TYPE=$(echo "$field" | jq -r '.type')
        DESC_TOML=$(echo "$field" | jq '.description')
        OPTIONS_TOML=$(echo "$field" | jq '.options')
        LABELS_TOML=$(echo "$field" | jq -r '(.option_labels // {}) | to_entries | map("\"" + .key + "\" = " + (.value | tojson)) | join(", ")')
        NEARBY_LABEL_TOML=$(echo "$field" | jq '.nearby_label')
        IS_READ_ONLY=$(echo "$field" | jq -r '.read_only')
        DEFAULT_VALUE_TOML=$(echo "$field" | jq '.default_value')

        DEFAULT_VAL='""'
        if [ "$TYPE" == "checkbox" ]; then
            DEFAULT_VAL="false"
        fi

        echo "[\"$ID\"]"
        echo "type = \"$TYPE\""
        if [ "$DESC_TOML" != "null" ]; then
            echo "description = $DESC_TOML"
        fi
        if [ "$OPTIONS_TOML" != "null" ] && [ "$OPTIONS_TOML" != "[]" ]; then
            echo "options = $OPTIONS_TOML"
        fi
        if [ -n "$LABELS_TOML" ]; then
            # On-page text next to each option's checkbox, for PDFs whose internal
            # export values (e.g. Auswahl1, Auswahl2) carry no inherent meaning.
            # Read-only reference for whoever fills in `value` - not consumed at fill time.
            echo "option_labels = { $LABELS_TOML }"
        fi
        if [ "$NEARBY_LABEL_TOML" != "null" ]; then
            # Best-effort description fallback, only set when the field has no /TU
            # tooltip at all. Heuristic (read from nearby page text), not authoritative.
            echo "nearby_label = $NEARBY_LABEL_TOML"
        fi
        if [ "$IS_READ_ONLY" == "true" ]; then
            # The PDF itself marks this field non-editable - it's typically static
            # boilerplate (e.g. an authority's own letterhead address), not citizen data.
            echo "read_only = true"
        fi
        if [ "$DEFAULT_VALUE_TOML" != "null" ]; then
            # The PDF's own baked-in /V value (string fields only). An empty string
            # means the field ships genuinely blank - read_only alone doesn't tell you
            # whether a field holds real static content or was simply never filled.
            echo "default_value = $DEFAULT_VALUE_TOML"
        fi
        echo "value = $DEFAULT_VAL"
        echo ""
    done
} > "$MAPPING_PATH"

echo "Successfully created mapping: $MAPPING_PATH"
