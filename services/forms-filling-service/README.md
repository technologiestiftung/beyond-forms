# Forms Filling Service

Service for exhaustive extraction of fillable fields from PDF documents and generating robustly populated PDFs. Designed for high compatibility across professional PDF viewers and standard web clients.

## API Specification

The service implements a **Pure JSON** API protocol using **Base64** for binary data transport.

### Endpoints

#### 1. List PDF Fields

`POST /api/fields`

Performs an exhaustive scan of the PDF (physical page widgets + logical AcroForm tree) to discover all fillable fields.

**Request (`FieldsRequest`):**

- `pdf_base64`: Base64 encoded PDF document string.

**Response (`FieldsResponse`):**

- `fields`: List of `FormField` metadata objects:
  - `id`: Unique deterministic identifier (`p{page}_{name}`).
  - `name`: Full hierarchical logical name (e.g., `Employer.Address.ZipCode`).
  - `page`: The primary physical page number for the field.
  - `type`: `string`, `checkbox`, `radio`, `choice` (dropdown), `signature`, or `unknown`.
  - `options`: List of valid selection values (returned for `radio` and `choice` fields).
  - `read_only`: Boolean indicating if the field is protected in the PDF.
  - `multiline`: Boolean indicating if the field supports line breaks.

#### 2. Fill PDF Form

`POST /api/fill`

Populates a PDF form using provided values with strict type and existence validation.

**Request (`FillRequest`):**

- `pdf_base64`: Base64 encoded PDF document string.
- `field_values`: Map of field identifiers to values.
  - **Key Matching**: Supports both logical AcroForm `name` and normalized `id` (e.g., `p1_first_name`).
  - **Checkboxes**: Accepts `bool` or string literals `"true"`/`"false"` (case-insensitive).
  - **Radio/Choice**: Must be `str` and match one of the defined `options`.
  - **Strings**: Must be `str`.
- `ignore_read_only`: (Optional) Boolean to bypass ReadOnly protection (default: `false`).

**Response:**

- Binary PDF file (`application/pdf`) with updated values and appearances.

## Technical Architecture

- **Unified Discovery**: Shared internal engine (`discover_fields`) ensures 100% consistency between discovery metadata and population targeting.
- **Hierarchical Integrity**: Resolves and targets the logical root of every field, ensuring values are correctly inherited by all associated physical widgets (multi-widget fields).
- **Visual Robustness**:
  - **Buttons**: Updates appearance states (`/AS`) while preserving original appearance streams (`/AP`) to ensure checkmarks and radio dots are rendered correctly.
  - **Text**: Automatically handles PDF string encoding and forces viewer-side regeneration of text appearances.
- **Strict Validation**: Rejects requests containing unknown field names or invalid data types with descriptive `400 Bad Request` errors.

## Development & Testing

### Installation & Execution

The service is managed using `Docker Compose` and `uv` for dependency management.

```bash
# Start the service (API on port 8005)
docker compose up -d

# Run the complete test suite (15+ tests)
docker compose run --rm forms-filling-service /bin/bash -c "pip install .[dev] && export PYTHONPATH=. && pytest tests/"

# Format and lint code
docker compose run --rm forms-filling-service /bin/bash -c "pip install ruff && ruff format src/ tests/ scripts/ && ruff check --fix src/ tests/ scripts/"
```

### Utility Scripts

Located in `scripts/`:

- `generate_pdf_for_testing.py`: Creates a comprehensive synthetic test document covering all supported field types.
- `list_pdf_fields.py`: CLI client to extract metadata from a local PDF.
- `fill_pdf.py`: CLI client to fill a local PDF with sample data.

## Data Models

Defined in `src/models/api_models.py` using Pydantic V2 for strict runtime validation of all API payloads.
