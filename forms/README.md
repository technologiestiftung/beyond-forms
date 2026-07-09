# BeyondForms - Form Filling & Mappings

This directory contains resources for automating the population of PDF form templates using data from the BeyondForms ecosystem.

## Directory Structure

- `pdfs/`: Fillable PDF form templates (e.g., `grundsicherung.pdf`).
- `mappings/`: TOML files defining the logic for mapping database fields to PDF fields.
- `scripts/`: Bash utilities for automation and validation.

## Mapping Format (.toml)

Mappings are stored in TOML files where the keys are the **normalized PDF field IDs** (e.g., `p1_first_name`) and the values define the injection logic. Dynamic expressions wrapped in `{{ }}` use **JEXL syntax**.

See [JEXL Syntax Reference](https://commons.apache.org/proper/commons-jexl/reference/syntax.html) for more details.

### 1. Template Substitutions

Use `{{ column_name }}` to inject data directly from the `Users` table or the application's JSON `form_data`.

```toml
"p1_full_name" = "{{ first_name }} {{ last_name }}"
"p1_cost_of_rent" = "{{ cost_of_rent }}"
```

### 2. Conditional Expressions

Create dynamic booleans for checkboxes using comparison operators (`==`, `!=`).

```toml
"p1_is_resident" = "{{ is_resident_in_germany == 'True' }}"
```

### 3. Ternary Operators

Select specific strings based on a condition—ideal for mapping internal enums to PDF choice/radio options.

```toml
"p1_salutation" = "{{ legal_gender == 'Male' ? 'Herr' : 'Frau' }}"
```

### 4. Static Values

Hardcode values that don't change per user.

```toml
"p1_office_name" = "Berlin-Mitte"
```

## Workflow Utilities

All scripts are located in `forms/scripts/` and should be run from the project root.

### Extracting Field IDs

Generate a boilerplate mapping for a new PDF. This script extracts field names, types, descriptions, and dropdown options as comments.

```bash
./forms/scripts/extract_to_mapping.sh forms/pdfs/my_new_form.pdf
```

### Validating Mappings

Ensure all `{{ column_name }}` substitutions refer to valid columns in the database. If it fails, it will list all available columns.

```bash
./forms/scripts/validate_mappings.sh
```

## Technical Details

- **ID Normalization**: PDF field IDs are prefixed with the page number (e.g., `p1_`) and normalized to lowercase with underscores.
- **Type Safety**: The orchestration service automatically converts "True"/"False" string results from expressions into strict booleans before sending them to the filling service, ensuring checkboxes work correctly.
- **Data Context**: Resolution uses a merged JEXL context built from the Postgres `Users` columns, the user's most recently updated `user_applications` row for the requested `form_type` (its `form_data` JSONB), and the latest verified `user_documents.raw_data` per document type (exposed as the `documents` namespace). On top-level key collision, `Users` columns take precedence over `form_data`; the `documents` namespace is isolated. Mappings can reference any of these interchangeably (e.g. `{{ first_name }}` from the profile, `{{ cost_of_rent }}` from `form_data`, `{{ documents.bank_statements.amount_rent }}` from OCR).

## Document Data Namespace

OCR-extracted fields from uploaded documents are exposed under the `documents` namespace as `documents.<type>.<field>`. The full list of `<type>` identifiers matches the `document_type` strings registered in `services/document-intelligence-service/src/app/domain/document_types.py` (e.g. `bank_statements`, `wage_slips`, `pension_notice`, `marriage_certificate`, `housing_costs_form`, `health_insurance_proof`, `savings_statements`, `securities_statements`, …).

### Rules

- Only documents with status `VERIFIED` contribute to the namespace. Documents still in `processing`, `ready_for_review`, `failed`, etc. are ignored.
- If multiple verified documents of the same `document_type` exist, only the most recently updated one is used.
- The `documents` namespace is always present in the JEXL context (as an empty object if no verified documents exist), so `documents.bank_statements.amount_rent` evaluates to `''` rather than erroring when the document is absent.
- Because pyjexl 0.3 has no safe-nav operator, use defensive ternaries for nullable paths:

```toml
value = "{{ documents.bank_statements ? documents.bank_statements.amount_rent : '' }}"
```

### Example

```toml
# Pulls the rent from a verified housing-costs form, falling back to a bank
# statement's OCR'd rent amount, and finally to the user's profile column.
"p3_miete_insgesamt" = "{{ documents.housing_costs_form ? documents.housing_costs_form.base_rent : documents.bank_statements ? documents.bank_statements.amount_rent : rent_total }}"

# Pulls the partner's name from a verified marriage certificate.
"p1_personenziffer_2_name" = "{{ documents.marriage_certificate ? documents.marriage_certificate.partner_name : '' }}"
```

### Adding a new document type binding

1. Add a `@register_document("my_doc_type")` class in `services/document-intelligence-service/src/app/domain/document_types.py` with the OCR fields.
2. Append `"my_doc_type"` to the `DOCUMENT_TYPES` list in `forms/scripts/validate_mappings.sh` so the validator pre-fills the namespace.
3. Reference `documents.my_doc_type.<field>` from a TOML mapping.
