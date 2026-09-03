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

### Generating Mapping Values (archived)

> **`forms/scripts/llm-eval/` is archived.** It is kept for the benchmark record behind the
> two mappings it drafted, and nothing live imports from it .

It filled a boilerplate's blank `value` fields with LLM-drafted JEXL (see
`forms/scripts/llm-eval/README.md` for how the model and prompt were chosen). Every
generated line was a guess, not a verified fact about the database, so its output always
needed human review.

### Validating Mappings

Ensure every `{{ }}` reference resolves — `users` columns and `associated_persons` attributes are derived live from `models.py`, the derived context keys (`today`, `age`, `household_members`, `partner`, …) from `schema_context.py`.

```bash
uv run --package orchestration-middleware-service forms/scripts/validate_mappings.py
```

### Decrypting a PDF

Some source PDFs (e.g. exports from official portals) are encrypted with an empty user password, which blocks tools like `extract_to_mapping.sh` and `pikepdf`/`pdfrw` from opening them. This strips the encryption in place, assuming an empty user password.

```bash
./forms/scripts/decrypt_pdf.sh forms/pdfs/my_new_form.pdf
```

## Technical Details

- **ID Normalization**: PDF field IDs are prefixed with the page number (e.g., `p1_`) and normalized to lowercase with underscores.
- **Type Safety**: The orchestration service automatically converts "True"/"False" string results from expressions into strict booleans before sending them to the filling service, ensuring checkboxes work correctly.
- **Person Context**: `associated_persons` (everyone, in `sort_order`), `household_members` (only those with `lives_in_household`, matching a form's Person 1..8 slots), `household_members_count`, and `partner` (spouse/partner as a single object, regardless of whether they live in the household). Also `today`, `age`, `is_adult` and `has_reached_retirement_age`.
- **Data Context**: Resolution uses a merged JEXL context built from the Postgres `Users` columns, the user's most recently updated `user_applications` row for the requested `form_type` (its `form_data` JSONB), and the latest verified `user_documents.raw_data` per document type (exposed as the `documents` namespace). On top-level key collision, `Users` columns take precedence over `form_data`; the `documents` namespace is isolated. Mappings can reference any of these interchangeably (e.g. `{{ first_name }}` from the profile, `{{ cost_of_rent }}` from `form_data`, `{{ documents.bank_statements.amount_rent }}` from OCR).

## Document Data Namespace

OCR-extracted fields from uploaded documents are exposed under the `documents` namespace as `documents.<type>.<field>`. The full list of `<type>` identifiers matches the `document_type` strings registered in `libs/document-schemas/src/beyondforms/document_schemas/document_types.py` (e.g. `bank_statements`, `wage_slips`, `pension_notice`, `marriage_certificate`, `housing_costs_form`, `health_insurance_proof`, `savings_statements`, `securities_statements`, …).

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

1. Add a `@register_document("my_doc_type")` class in `libs/document-schemas/src/beyondforms/document_schemas/document_types.py` with the OCR fields.
2. Reference `documents.my_doc_type.<field>` from a TOML mapping. `forms/scripts/validate_mappings.py` picks up the new type automatically (it derives the list live from `document_types.py` — no file to keep in sync by hand anymore).

### Known limitation: unlabeled radio/choice options

Some source PDFs give their radio button widgets meaningless export values (`Auswahl1`, `Auswahl2`, …) with no tooltip anywhere — on the field or on individual widgets — that says what each option actually means. There's currently no automated way to resolve these (it would require extracting the page text positioned near each widget, which the field-extraction pipeline doesn't do).
