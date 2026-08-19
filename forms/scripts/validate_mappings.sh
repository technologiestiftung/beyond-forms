#!/bin/bash
# validate_mappings.sh - Validates template substitutions in mapping TOML files using actual JEXL evaluation.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAPPING_DIR="$(dirname "$SCRIPT_DIR")/mappings"
REPO_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
COLUMNS_FILE="$1"

# Allow callers to point at a Python that has pyjexl installed (e.g. a service venv).
PYTHON_BIN="${PYTHON_BIN:-python3}"

PYTHON_VALIDATOR=$(cat <<EOF
import sys
import tomllib
import re
from pyjexl import JEXL

sys.path.insert(0, "$SCRIPT_DIR/llm-eval")
from schema_context import build_schema_context, list_document_types, StrictDict, dummy_value

class PermissiveDict(dict):
    def __missing__(self, key):
        return PermissiveDict()
    def __getitem__(self, key):
        if key not in self:
            return PermissiveDict()
        return super().__getitem__(key)

def build_context(repo_root, columns_file):
    # Same filtered column set the LLM prompt sees (no internal/audit fields)
    user_columns = build_schema_context(repo_root, include_documents=False)
    documents = list_document_types(repo_root)

    if columns_file:
        # Explicit override: a flat name list with no type info, so dummy values fall
        # back to untyped strings for these (numeric-comparison false-rejects are
        # possible here, same as before this script derived types automatically).
        with open(columns_file) as f:
            names = [line.strip() for line in f if line.strip()]
        user_columns = {name: {"type": "String"} for name in names}

    ctx = StrictDict({name: dummy_value(info) for name, info in user_columns.items()})
    ctx["documents"] = {slug: PermissiveDict() for slug in documents}
    return ctx, user_columns, documents

def validate(toml_path, ctx):
    jexl = JEXL()
    errors = []
    try:
        with open(toml_path, "rb") as f:
            mapping = tomllib.load(f)

        for field_id, field_info in mapping.items():
            if isinstance(field_info, dict):
                value = field_info.get("value")
            else:
                value = field_info

            if not isinstance(value, str):
                continue

            # Extract all {{ ... }} blocks
            templates = re.findall(r"\{\{\s*(.*?)\s*\}\}", value, re.DOTALL)
            for expr in templates:
                try:
                    jexl.evaluate(expr, ctx)
                except Exception as e:
                    errors.append(f"  [ERROR] In field '{field_id}': Expression '{{{{ {expr} }}}}' failed: {e}")
    except Exception as e:
        errors.append(f"  [ERROR] Failed to parse TOML {toml_path}: {e}")

    return errors

if __name__ == "__main__":
    toml_file = sys.argv[1]
    repo_root = sys.argv[2]
    columns_file = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] else None

    ctx, user_columns, documents = build_context(repo_root, columns_file)
    errs = validate(toml_file, ctx)
    for err in errs:
        print(err)
    sys.exit(1 if errs else 0)
EOF
)

if [ -n "$COLUMNS_FILE" ] && [ ! -f "$COLUMNS_FILE" ]; then
    echo "Error: Columns file '$COLUMNS_FILE' not found."
    exit 1
fi

if [ -n "$COLUMNS_FILE" ]; then
    echo "Using explicit columns file: $COLUMNS_FILE (no type info - numeric comparisons may false-reject)"
else
    echo "Deriving Users columns and document types from models.py / document_types.py..."
    "$PYTHON_BIN" -c "
import sys
sys.path.insert(0, '$SCRIPT_DIR/llm-eval')
from schema_context import build_schema_context
ctx = build_schema_context('$REPO_ROOT', include_documents=True)
print(f\"Loaded {len(ctx['user_columns'])} Users columns and {len(ctx['documents'])} document types.\")
"
fi

ERRORS_FOUND=0

# Validate mappings
for toml_file in "$MAPPING_DIR"/*.toml; do
    [ -e "$toml_file" ] || continue

    echo "Validating $toml_file..."

    if ! "$PYTHON_BIN" -c "$PYTHON_VALIDATOR" "$toml_file" "$REPO_ROOT" "$COLUMNS_FILE"; then
        ERRORS_FOUND=1
    fi
done

if [ "$ERRORS_FOUND" -eq 0 ]; then
    echo -e "\nAll mappings validated successfully!"
else
    echo -e "\nValidation failed with errors."
    exit 1
fi
