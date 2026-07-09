from pydantic import BaseModel
from typing import Type, get_type_hints, get_args, Literal, Any
from decimal import Decimal
from datetime import date

ENTITY_EXTRACTION_PROMPT = """
# Objective
Act as a precise Entity Extraction Engine. Convert OCR text into structured data by identifying and capturing only the defined entities with absolute fidelity to the source.

# Execution Instructions
* **Literal Extraction:** Copy values exactly as they appear in the text.
* **Source Adherence:** Base all extractions exclusively on the provided document content.
* **Missing Data Protocol:** Assign a `null` value to any entity absent from the document or where you are uncertain if the extraction is correct.

# Processing Steps
1.  **Scan:** Review the entire OCR text for keywords related to the Entity Definitions.
2.  **Verify:** Cross-reference found values against the document context to ensure correct mapping.
3.  **Format:** Map the verified values to the required JSON structure.

# Entity Definitions
"""


def get_field_instruction(field_type: Any) -> str:
    """Determines the extraction instruction based on the Python type."""
    origin = getattr(field_type, "__origin__", None)

    if origin is Literal:
        allowed_options = ", ".join([f"{value}" for value in get_args(field_type)])
        return f"Select the most accurate value from the following options: [{allowed_options}]."

    if field_type is date:
        return "Extract the date and convert it to ISO format (YYYY-MM-DD)."

    if field_type is bool:
        return "Determine the truth of this attribute based on the document content. Assign true or false."

    if field_type in (Decimal, float, int):
        return "Extract the precise numerical value. Maintain all decimal precision."

    return "Extract the literal string value exactly as it appears in the text. If the field looks like a date, then convert to ISO format (YYYY-MM-DD)"


def generate_entity_extraction_prompt_tail(document_class: Type[BaseModel]) -> str:
    document_description = getattr(document_class, "description", "the provided document")

    prompt_sections = [
        "# Target Document Type",
        f"The document is identified as: {document_class.__name__}",
        f"Context: {document_description}",
        "",
        "# Entity Definitions",
        "Extract the following specific attributes from the text:",
    ]

    type_hints = get_type_hints(document_class)

    for field_name, field_info in document_class.model_fields.items():
        if field_name == "description":
            continue
        field_type = type_hints.get(field_name, field_info.annotation)

        semantic_definition = field_info.description or field_name.replace("_", " ").title()
        technical_instruction = get_field_instruction(field_type)

        prompt_sections.append(f"* **{field_name}**: {semantic_definition}. {technical_instruction}")

    return "\n".join(prompt_sections)
