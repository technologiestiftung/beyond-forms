import os
import json
import logging
from typing import Any, Callable, Coroutine, Optional, Type, Dict
from litellm import acompletion
from pydantic import BaseModel

from app.document_classifier.system_prompts import UNKNOWN_TYPE
from beyondforms.document_schemas.validation import parse_document_fields
from utils.labels import get_label_mappings
from domain.classified_document import ClassifiedDocument
from beyondforms.document_schemas.document_registry import DocumentRegistry
from entity_extractor.system_prompts import (
    ENTITY_EXTRACTION_PROMPT,
    generate_entity_extraction_prompt_tail,
)
from utils.llm_calls import get_number_of_retries

logger = logging.getLogger(__name__)

NEGATIVE_ALLOWED_FIELDS = {"account_balance", "balance_due"}

Extractor = Callable[[ClassifiedDocument, str, str], Coroutine[Any, Any, Optional[BaseModel]]]


def generate_structured_output_configuration(
    document_class: Type[BaseModel],
) -> Dict[str, Any]:
    """
    Generates the response_format configuration for LiteLLM.
    Configures the schema to use OpenAI-compatible 'strict' mode.
    """
    json_schema = document_class.model_json_schema()

    # remove document description from schema
    if "properties" in json_schema and "description" in json_schema["properties"]:
        json_schema["properties"].pop("description")

    json_schema["required"] = list(json_schema.get("properties", {}).keys())
    return {
        "type": "json_schema",
        "json_schema": {
            "name": document_class.__name__,
            "description": getattr(document_class, "description", f"Schema for {document_class.__name__}"),
            "schema": json_schema,
            "strict": True,
        },
    }


def clean_and_parse_llm_json(raw_response: str) -> dict:
    """
    Sanitizes the response content from the model to discard Markdown indicators.
    Parses result into standard dictionary objects.
    """
    cleaned = raw_response.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]

    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]

    cleaned = cleaned.strip()
    return json.loads(cleaned)


async def extract_data_from_document(
    base64_data: str,
    mime_type: str,
    schema_dict: dict,
    model_name: str,
    system_prompt_prefix: Optional[str] = None,
) -> dict:
    """
    Common unified entity extraction core processing system.
    Evaluates output matching strict target constraints.
    Filters out missing/null values safely.
    """
    system_prompt = system_prompt_prefix or ENTITY_EXTRACTION_PROMPT

    if not system_prompt_prefix:
        system_prompt += "\n# Target Schema\n"
        system_prompt += "Extract the defined attributes in compliance with fields descriptions below:\n"

        if isinstance(schema_dict, dict) and "properties" in schema_dict:
            for name, prop in schema_dict["properties"].items():
                f_type = prop.get("type", "string")
                f_desc = prop.get("description", name)
                system_prompt += f"* **{name}** ({f_type}): {f_desc}\n"

        system_prompt += """
# Output Format
You MUST return a JSON object containing only requested properties. Set value to null if not present.
"""

    extraction_schema = {"type": "json_object"}
    if isinstance(schema_dict, dict) and "properties" in schema_dict:
        schema_with_required = dict(schema_dict)
        schema_with_required["required"] = list(schema_with_required.get("properties", {}).keys())
        extraction_schema = {
            "type": "json_schema",
            "json_schema": {
                "name": "ExtractedData",
                "schema": schema_with_required,
                "strict": True,
            },
        }

    # Safe prefix checks
    model_path = model_name if ("/" in model_name) else "vertex_ai/" + model_name

    max_json_retries = 2
    attempts = 0

    while True:
        attempts += 1
        try:
            response = await acompletion(
                model=model_path,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": "Accurately extract the defined entities from this file.",
                            },
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:{mime_type};base64,{base64_data}"},
                            },
                        ],
                    },
                ],
                temperature=0,
                response_format=extraction_schema,
                num_retries=get_number_of_retries(),
                vertex_project=os.getenv("GCLOUD_PROJECT"),
                vertex_location="global",
            )

            raw_json = response.choices[0].message.content
            result_dict = clean_and_parse_llm_json(raw_json)
            extracted_data = result_dict.get("extracted_data", result_dict)
            logger.info(
                f"LLM raw extracted keys: {list(extracted_data.keys()) if isinstance(extracted_data, dict) else 'not a dict'}"
            )

            sanitized = {}
            if isinstance(extracted_data, dict):
                for k, v in extracted_data.items():
                    if v is not None and v != "":
                        if isinstance(v, (int, float)) and v < 0 and k not in NEGATIVE_ALLOWED_FIELDS:
                            v = abs(v)
                        elif isinstance(v, str) and v.startswith("-") and k not in NEGATIVE_ALLOWED_FIELDS:
                            v = v[1:]
                        sanitized[k] = v
                    else:
                        logger.info(f"Filtered out field '{k}' (value={v!r})")

            logger.info(f"Sanitized keys: {list(sanitized.keys())}")
            return {"extracted_data": sanitized}

        except (
            json.JSONDecodeError,
            KeyError,
            ValueError,
            AttributeError,
        ) as parse_err:
            logger.warning(f"LLM parsing error occurred (Attempt {attempts}/{max_json_retries + 1}): {parse_err}")
            if attempts > max_json_retries:
                logger.error("Output schema JSON validation failures limit reached.")
                raise RuntimeError(f"Dynamic data extraction output failed constraints: {parse_err}")

            import asyncio

            await asyncio.sleep(0.3 * attempts)

        except Exception as exception:
            logger.error(f"Unified model extraction process failed: {exception}", exc_info=True)
            raise RuntimeError(f"Unified extraction process failed: {str(exception)}")


async def extract_generic_envelope_from_document(
    base64_data: str,
    mime_type: str,
    schema_dict: dict,
    model_name: str,
) -> dict:
    """
    Extracts entities using a generic self-correction envelope schema.
    Returns both 'extracted_data' and 'extraction_metadata' fields.
    """
    system_prompt = """# Objective
Act as a precise Entity Extraction Engine with self-correction auditing. Convert the source document into structured data by identifying the requested attributes.

# Execution Instructions
1. For every requested field in the target schema, locate its value from the source document.
2. For every field, assign its status in the `extraction_metadata` block using these definitions:
   - **status**:
     - `SUCCESS`: The field was clearly found and extracted from the document.
     - `UNCLEAR`: The field text is blurry, ambiguous, or you are unsure about the accuracy of the extraction.
     - `NOT_ON_DOCUMENT`: The field does not exist or cannot be found anywhere in the document.
   - **reason**: A brief explanation of the lineage or evidence supporting the status.
"""

    system_prompt += "\\n# Target Schema Properties to Extract\\n"
    if isinstance(schema_dict, dict) and "properties" in schema_dict:
        for name, prop in schema_dict["properties"].items():
            f_type = prop.get("type", "string")
            f_desc = prop.get("description", name)
            system_prompt += f"* **{name}** ({f_type}): {f_desc}\\n"

    system_prompt += """
# Output format
You MUST return a JSON object matching the specified response schema, containing both `extracted_data` and `extraction_metadata`.
"""

    props = schema_dict.get("properties", {})
    metadata_props = {}

    for name, prop in props.items():
        metadata_props[name] = {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "enum": ["SUCCESS", "UNCLEAR", "NOT_ON_DOCUMENT"],
                },
                "reason": {"type": "string"},
            },
            "required": ["status", "reason"],
        }

    wrapped_schema = {
        "type": "object",
        "properties": {
            "extracted_data": {"type": "object", "properties": props},
            "extraction_metadata": {
                "type": "object",
                "properties": metadata_props,
                "required": list(props.keys()),
            },
        },
        "required": ["extracted_data", "extraction_metadata"],
    }

    extraction_schema = {
        "type": "json_schema",
        "json_schema": {
            "name": "ExtractionEnvelope",
            "schema": wrapped_schema,
            "strict": False,
        },
    }

    model_path = model_name if ("/" in model_name) else "vertex_ai/" + model_name
    max_json_retries = 2
    attempts = 0

    while True:
        attempts += 1
        try:
            response = await acompletion(
                model=model_path,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": "Accurately extract the defined entities from this file with self-correction metadata.",
                            },
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:{mime_type};base64,{base64_data}"},
                            },
                        ],
                    },
                ],
                temperature=0,
                response_format=extraction_schema,
                num_retries=get_number_of_retries(),
                vertex_project=os.getenv("GCLOUD_PROJECT"),
                vertex_location="global",
            )

            raw_json = response.choices[0].message.content
            result_dict = clean_and_parse_llm_json(raw_json)
            return result_dict

        except Exception as parse_err:
            logger.warning(f"LLM generic extraction parsing error occurred (Attempt {attempts}): {parse_err}")
            if attempts > max_json_retries:
                raise RuntimeError(f"Generic data extraction output failed: {parse_err}")
            import asyncio

            await asyncio.sleep(0.3 * attempts)


def init_entity_extractor(model_name: str, document_registry: DocumentRegistry) -> Extractor:
    label_to_slug, _ = get_label_mappings()

    async def entity_extractor(document: ClassifiedDocument, base64_data: str, mime_type: str) -> Optional[dict]:
        if document.document_type == UNKNOWN_TYPE:
            logger.warning(f"Document type is {UNKNOWN_TYPE}. Skipping extraction.")
            return document

        try:
            document_type = document_registry.get_or_raise(document.document_type)
        except ValueError:
            logger.warning(f"Document class {document.document_type} not found in registry. Skipping extraction.")
            return document

        system_prompt = ENTITY_EXTRACTION_PROMPT + generate_entity_extraction_prompt_tail(document_type)

        schema_dict = document_type.model_json_schema()

        try:
            res = await extract_data_from_document(
                base64_data=base64_data,
                mime_type=mime_type,
                schema_dict=schema_dict,
                model_name=model_name,
                system_prompt_prefix=system_prompt,
            )

            data_to_filter = res.get("extracted_data", {})
            if not isinstance(data_to_filter, dict):
                logger.warning("Entity extraction returned non-dict extracted_data")
                return None
            return parse_document_fields(document_type, data_to_filter)

        except Exception as exception:
            logger.warning(f"Entity extraction failed inside extraction wrapper: {exception}")
            return None

    return entity_extractor
