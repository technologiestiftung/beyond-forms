#!/bin/bash
# validate_mappings.sh - Validates template substitutions in mapping TOML files using actual JEXL evaluation.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAPPING_DIR="$(dirname "$SCRIPT_DIR")/mappings"
COLUMNS_FILE="${1:-$SCRIPT_DIR/db_columns.txt}"

# Allow callers to point at a Python that has pyjexl installed (e.g. a service venv).
PYTHON_BIN="${PYTHON_BIN:-python3}"

if [ ! -f "$COLUMNS_FILE" ]; then
    echo "Error: Columns file '$COLUMNS_FILE' not found."
    echo "Please run '$SCRIPT_DIR/fetch_db_columns.sh' first or provide the path to a columns file."
    exit 1
fi

echo "Reading column names from $COLUMNS_FILE..."
DB_COLUMNS=$(cat "$COLUMNS_FILE" | grep -v '^$')

COLUMN_COUNT=$(echo "$DB_COLUMNS" | wc -l)
echo "Successfully loaded $COLUMN_COUNT columns."

# Prepare the Python validation script
PYTHON_VALIDATOR=$(cat <<EOF
import sys
import tomllib
import re
from pyjexl import JEXL

class StrictDict(dict):
    def __getitem__(self, key):
        if key not in self:
            raise NameError(f"Undefined identifier: {key}")
        return super().__getitem__(key)

class PermissiveDict(dict):
    def __missing__(self, key):
        return PermissiveDict()
    def __getitem__(self, key):
        if key not in self:
            return PermissiveDict()
        return super().__getitem__(key)

# Mirrors services/document-intelligence-service/src/app/domain/document_types.py.
# Keep in sync if new document types are added.
DOCUMENT_TYPES = [
    "income_declaration", "assets_declaration", "housing_costs_form",
    "bank_details", "household_declaration", "identity_document",
    "registration_certificate", "address_proof", "residence_permit",
    "recognition_decision", "asylum_stay_permit", "bank_statements",
    "wage_slips", "social_benefits_proof", "alimony_proof",
    "irregular_income_proof", "pension_notice", "private_pension_proof",
    "private_pension_yearly_information", "disability_decision",
    "savings_statements", "securities_statements", "life_insurance_contract",
    "property_ownership_proof", "rental_contract", "rent_increase_notice",
    "utility_cost_statement", "heating_costs_proof", "home_ownership_costs",
    "health_insurance_proof", "care_level_notice", "care_service_invoice",
    "care_home_contract", "care_facility_costs", "disability_id",
    "medical_reports", "special_diet_evidence", "pregnancy_certificate",
    "power_of_attorney", "legal_guardianship_papers", "marriage_certificate",
    "divorce_decree", "cooperation_agreement", "asylblg_application",
    "accommodation_assignment",
]

def validate(toml_path, columns):
    jexl = JEXL()
    # Fill context with dummy values for all valid columns
    ctx = StrictDict({col: "dummy" for col in columns})
    # Pre-fill the documents namespace so dotted paths like
    # documents.bank_statements.amount_rent parse without raising.
    ctx["documents"] = {t: PermissiveDict() for t in DOCUMENT_TYPES}

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
    cols = sys.argv[2].split(",")
    errs = validate(toml_file, cols)
    for err in errs:
        print(err)
    sys.exit(1 if errs else 0)
EOF
)

ERRORS_FOUND=0
COL_CSV=$(echo "$DB_COLUMNS" | paste -sd "," -)

# Validate mappings
for toml_file in "$MAPPING_DIR"/*.toml; do
    [ -e "$toml_file" ] || continue

    echo "Validating $toml_file..."

    # Run the embedded Python validator
    if ! "$PYTHON_BIN" -c "$PYTHON_VALIDATOR" "$toml_file" "$COL_CSV"; then
        ERRORS_FOUND=1
    fi
done

if [ "$ERRORS_FOUND" -eq 0 ]; then
    echo -e "\nAll mappings validated successfully!"
else
    echo -e "\nValidation failed with errors."
    echo -e "\nAvailable columns (from $COLUMNS_FILE):"
    echo "$DB_COLUMNS" | sed 's/^/  - /'
    exit 1
fi
