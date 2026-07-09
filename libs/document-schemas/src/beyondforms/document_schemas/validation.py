import logging
from typing import Any, Type

from pydantic import BaseModel, ValidationError

logger = logging.getLogger(__name__)


def filter_to_schema_fields(data: dict[str, Any], document_class: Type[BaseModel]) -> dict[str, Any]:
    allowed = {key for key in document_class.model_fields if key != "description"}
    dropped = set(data.keys()) - allowed
    for key in dropped:
        logger.warning(f"Dropping unknown field '{key}' not defined on schema for {document_class.__name__}")
    return {key: value for key, value in data.items() if key in allowed}


def filter_to_json_schema_properties(data: dict[str, Any], schema_dict: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(schema_dict, dict):
        return data
    properties = schema_dict.get("properties")
    if not isinstance(properties, dict):
        return data
    allowed = set(properties.keys())
    dropped = set(data.keys()) - allowed
    for key in dropped:
        logger.warning(f"Dropping unknown field '{key}' not defined in dynamic output schema")
    return {key: value for key, value in data.items() if key in allowed}


def format_pydantic_errors(error: ValidationError) -> dict[str, list[dict[str, str]]]:
    formatted: dict[str, list[dict[str, str]]] = {}
    for err in error.errors():
        field_path = str(err.get("loc", ["unknown"])[0])
        formatted.setdefault(field_path, []).append(
            {
                "field_path": field_path,
                "message": err.get("msg", "Validation failed"),
                "type": err.get("type", "value_error"),
            }
        )
    return formatted


def validate_strict(document_class: Type[BaseModel], data: dict[str, Any]) -> dict[str, Any]:
    validated = document_class.model_validate(data)
    return validated.model_dump(exclude={"description"}, exclude_none=True)


def parse_document_fields(document_class: Type[BaseModel], data: dict[str, Any]) -> dict[str, Any]:
    filtered = filter_to_schema_fields(data, document_class)
    result: dict[str, Any] = {}
    for key, value in filtered.items():
        if key == "description":
            continue
        try:
            validated = document_class.model_validate({key: value})
            parsed_value = getattr(validated, key)
        except ValidationError as error:
            logger.warning(
                "Document field parsing failed for %s.%s: %s",
                document_class.__name__,
                key,
                error,
            )
            continue
        if parsed_value is not None:
            result[key] = parsed_value
    return result
