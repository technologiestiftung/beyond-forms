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
RESPONSE=$(base64 -w 0 "$PDF_PATH" | jq -Rs '{pdf_base64: .}' | curl -s -X POST "http://localhost:8005/api/fields" \
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
    echo "# Run './forms/scripts/validate_mappings.sh' to verify substitutions."
    echo "# Expressions wrapped in {{ }} are treated as JEXL."
    echo "# See JEXL syntax: https://commons.apache.org/proper/commons-jexl/reference/syntax.html"
    echo ""

    echo "$RESPONSE" | jq -c '.fields[]' | while read -r field; do
        ID=$(echo "$field" | jq -r '.id')
        TYPE=$(echo "$field" | jq -r '.type')
        DESC_TOML=$(echo "$field" | jq '.description')
        OPTIONS_TOML=$(echo "$field" | jq '.options')

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
        echo "value = $DEFAULT_VAL"
        echo ""
    done
} > "$MAPPING_PATH"

echo "Successfully created mapping: $MAPPING_PATH"
