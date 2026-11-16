# Rules Engine Service

Service for single field and form validation.

## Tech Stack

- **Framework**: FastAPI (Python 3.13)
- **Form Validation**: `Pydantic` (for build-in field and post validation logic)
- **Dependency Management**: `poetry` (ToDo: to be moved to `uv`)
- **Infrastructure**: Google Cloud Run, Cloud Storage

## General Logic & Domain Model

The service introduces the concept of a `field` and a `form`. Both exist as instance of a `BaseRegistry` allowing the
user to register available forms and field that will be loaded and made available by the service on startup.

Each form is a Pydantic class which can have attributes that are either standard Python types (`str`, `float`, `byte`,.)
or the type of a defined and registered `field`. These fields are Pydantic `Annotated` type definitions that each come
with one or more field validator functions.

More complex validation logic that depends on the value of different fields can be implemented through Pydantic's `model_validator` or other post-validation methods.

One can flexibly add or remove validator functions to each field.

### Adding New Definitions

- `field`: when adding a new field, it has to be explicitly registered in the `field` register. Search the code for the tag
  `@add_new_field` for an example of a new field type definition and registration.
- `validator`: you can add custom field type validators to `src/app/validators`. Search the code for the tag `@add_new_validator` for an example.
- `form`: define a normal Pydantic class with the decorator `@register_form("<name_of_the_form>")`. Search the code for the tag `@add_new_form` for an example.

## API Endpoints

### System

- `GET health`: health check returning 200 if service is up

### Discovery

- `GET /get-available-forms` Returns a list of all registered form keys available for validation.

- `GET /get-form-definition/{form_name}` Retrieves the JSON Schema for a specific form registered under {form_name}.

- `GET /get-available-field-types` Returns a list of all standalone field types (e.g., custom regex types, specialized strings) available in the registry.

- `GET /get-field-type-definition/{field_name}` Retrieves the JSON Schema for a specific field type registered under {field_name}.

### Validation

- `POST /validate-form` Validates a full form payload.
  - Query Params: `validate_entire_form` (bool), default: `true`. If false, the engine ignores "missing field" errors, allowing for partial validation of drafts.
  - Body: FormRequestBody containing the `form_type` and `form_content`.
  - Returns: Validated data on success; detailed error list and missing field count on failure.

- `POST /validate-field` Validates a single value against a specific registered field type.
  - Body: `FieldTypeRequest` containing the `field_type` and the `field_value` to check.
  - Returns: The validated value or a 422 error with specific validation constraints.

### Error Handling

The API returns a standardized response format for all errors:

- **422 Unprocessable Entity**: Validation failures (returns a list of field paths and error messages).
- **404 Not Found**: Requested form or field type is not in the registry.
- **500 Internal Server Error**: Unexpected system exceptions.

## Deployment

### Cloud Run

To deploy the service to Google Cloud Run, run the following command from the rules-engine service root.

```bash
gcloud builds submit --config infrastructure/cloudbuild.yaml --region=europe-west10 .
```

## Development

### Run Locally

```bash
poetry run uvicorn src.api.main:app --host 0.0.0.0 --port 8080
```

OR

```bash
cd services/rules-engine/src
uv run fastapi dev --port 8004
```
