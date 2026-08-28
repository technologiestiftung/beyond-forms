# Document Intelligence Service

An automated document processing service built with **FastAPI** and **LiteLLM**. It provides high-speed document classification and schema-based entity extraction using Vision Language Models (VLMs) like **Gemini 3.5 Flash**.

## 🚀 Quick Start

### 1. Environment Setup

Create a `.env.local` file in the project root:

```bash
LLM_RETRIES=<maximum retries for llm calls if resource exhausted>
```

If the variable `LLM_RETRIES` is not set, it defaults to 3.

### 2. Installation & Run

```bash
pip install -r requirements.txt
python app/main.py
```

_The service runs on `http://localhost:8001`._

---

## 🛠 Core Functionality

### 1. Document Classification

Uses an optimized prompting approach for efficient classification.

- **Mechanism:** Maps document types to single-character labels (A, B, C...).
- **Confidence:** No longer relies on logprobs; uses direct LLM scoring or alternative methods as required.

### 2. Entity Extraction

Uses Pydantic models to enforce strict schema extraction.

- **Dynamic Prompts:** Automatically generates instructions based on Pydantic `Field` descriptions.
- **Validation:** Extracted JSON is validated against the registry models before returning.

---

## 📂 Document Registry

The service supports a wide range of German social and financial documents defined in `app/domain/document_types.py`.

| Category      | Examples                                                            |
| :------------ | :------------------------------------------------------------------ |
| **Financial** | `income_declaration`, `assets_declaration`, `wage_slips`            |
| **Identity**  | `identity_document`, `residence_permit`, `registration_certificate` |
| **Housing**   | `rental_contract`, `utility_cost_statement`, `housing_costs_form`   |
| **Health**    | `health_insurance_proof`, `disability_id`, `care_level_notice`      |

---

## 📡 API Endpoints

### `POST /classify`

The primary entry point for processing files.

- **Form Data:**
  - `file`: Binary file (PDF, PNG, JPEG).
  - `model`: (Optional) Default: `vertex_ai/gemini-3.7-flash`.
  - `entity-extraction`: (Boolean) Whether to extract fields after classification.

- **Response:**

```json
{
  "status": "success",
  "data": {
    "filename": "id_card.jpg",
    "classified_document": {
      "document_type": "identity_document",
      "confidence": 0.98,
      "candidate_rankings": [...]
    },
    "extraction_result": {
      "given_names": "Max",
      "last_name": "Mustermann",
      "nationality": "DEU"
    }
  }
}
```

### `GET /get-available-document-types`

Returns a list of all registered document slugs.

### `GET /get-document-type-definition/{slug}`

Returns the JSON Schema for a specific document type.

---

## 🧪 Extensions

- **Adding New Documents:** Define a new class in `document_types.py` using the `@register_document("slug")` decorator. To add a new document type, simply inherit from `BaseDocument` and add your fields with descriptive `Field(...)` helpers—the LLM will automatically use those descriptions as extraction instructions.
- **Error Handling:** All errors are wrapped in a standard JSON envelope via `api_response` in `app/utils/web.py`.

---

## 🧪 Things to Consider for the Future

- **Shared Resources:** The definition of `document_types` will have to be accessible for the rules-engine and the document intelligence service. However, in the document-intelligence service all fields need to be optional (to avoid failure if one field can not be extracted). In the rules engine, only fields that really are optional in terms of business logic should be marked as optional. We will need to think about a way to 1) share the definitions and 2) distinguish between business logic `Optionals` and the `Optional` required for extraction.
- **Document Types:** still need to be updated to reflect the fields that we need to extract once the requirements are finalized.

---
