from dataclasses import dataclass, field
from typing import Any

from pydantic import TypeAdapter, ValidationError

from app.domain.ocr_field_mappings import (
    ADDRESS_PROFILE_COMPONENTS,
    ALLOWED_PROFILE_FIELDS,
    OCR_TO_PROFILE_FIELD_MAP,
    PROFILE_FIELD_TO_VALIDATOR,
)
from app.domain.registry import field_registry
from app.validation.address import parse_address
from app.web.utils import format_validation_errors
from beyondforms.document_schemas.document_registry import document_registry
from beyondforms.document_schemas.validation import format_pydantic_errors, validate_strict


@dataclass
class FieldValidationResult:
    validated_fields: dict[str, Any] = field(default_factory=dict)
    profile_sync: dict[str, Any] = field(default_factory=dict)
    errors: dict[str, list[dict[str, Any]]] = field(default_factory=dict)


def _validate_profile_field(profile_field: str, raw_value: Any) -> tuple[list[dict[str, Any]] | None, Any]:
    validator_name = PROFILE_FIELD_TO_VALIDATOR.get(profile_field)
    if not validator_name:
        if raw_value is None or raw_value == "":
            return None, None
        return [
            {
                "field_path": profile_field,
                "message": f"No validator mapped for field: '{profile_field}'",
                "type": "value_error",
            }
        ], None

    try:
        validator_type = field_registry.get(validator_name)
        validated_val = TypeAdapter(validator_type).validate_python(raw_value)
        return None, validated_val
    except ValidationError as error:
        return format_validation_errors(error.errors()), None
    except Exception as error:
        return [{"field_path": profile_field, "message": str(error), "type": "value_error"}], None


def validate_profile_fields(fields: dict[str, Any]) -> FieldValidationResult:
    result = FieldValidationResult()

    for field_name, raw_value in fields.items():
        field_errors, validated_val = _validate_profile_field(field_name, raw_value)
        if field_errors:
            result.errors[field_name] = field_errors
        else:
            result.validated_fields[field_name] = validated_val

    return result


def validate_document_verified_fields(document_type: str, fields: dict[str, Any]) -> FieldValidationResult:
    doc_model = document_registry.get_or_raise(document_type)
    result = FieldValidationResult()

    try:
        result.validated_fields = validate_strict(doc_model, fields)
    except ValidationError as error:
        result.errors = format_pydantic_errors(error)
        return result

    for ocr_field, raw_value in fields.items():
        if ocr_field == "address":
            parsed = parse_address(str(raw_value or ""))
            for component in ADDRESS_PROFILE_COMPONENTS:
                component_value = parsed.get(component, "")
                if not component_value or component not in ALLOWED_PROFILE_FIELDS:
                    continue
                field_errors, validated_val = _validate_profile_field(component, component_value)
                if field_errors:
                    result.errors.setdefault(ocr_field, []).extend(field_errors)
                elif validated_val is not None:
                    result.profile_sync[component] = validated_val
            continue

        profile_field = OCR_TO_PROFILE_FIELD_MAP.get(ocr_field, ocr_field)
        if profile_field not in ALLOWED_PROFILE_FIELDS:
            continue

        field_errors, validated_val = _validate_profile_field(profile_field, raw_value)
        if field_errors:
            result.errors[ocr_field] = field_errors
        elif validated_val is not None:
            result.profile_sync[profile_field] = validated_val
            if profile_field == "nationality" and validated_val == "DE":
                result.profile_sync["is_german_citizen"] = True
                result.profile_sync["residence_status"] = "Citizen"

    return result
