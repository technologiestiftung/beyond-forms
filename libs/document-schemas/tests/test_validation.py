import pytest
from decimal import Decimal
from pydantic import ValidationError

from beyondforms.document_schemas.document_types import (
    IdentityDocument,
    ResidencePermit,
    WageSlips,
)
from beyondforms.document_schemas.validation import (
    filter_to_schema_fields,
    parse_document_fields,
    validate_strict,
)


def test_identity_document_accepts_valid_gender_values():
    instance = IdentityDocument.model_validate({"gender": "M", "description": "test"})
    assert instance.gender == "M"

    instance = IdentityDocument.model_validate({"gender": "D", "description": "test"})
    assert instance.gender == "D"


def test_residence_permit_rejects_invalid_gender_value():
    with pytest.raises(ValidationError):
        ResidencePermit.model_validate({"gender": ">", "description": "test"})


def test_residence_permit_accepts_valid_gender_values():
    instance = ResidencePermit.model_validate({"gender": "M", "description": "test"})
    assert instance.gender == "M"

    instance = ResidencePermit.model_validate({"gender": "F", "description": "test"})
    assert instance.gender == "F"


def test_filter_to_schema_fields_drops_unknown_keys():
    filtered = filter_to_schema_fields(
        {"given_names": "Max", "gender": "M", "has_subtenants": True},
        IdentityDocument,
    )
    assert filtered == {"given_names": "Max", "gender": "M"}
    assert "has_subtenants" not in filtered


def test_validate_strict_rejects_unknown_fields():
    with pytest.raises(ValidationError):
        validate_strict(IdentityDocument, {"given_names": "Max", "has_subtenants": True})


def test_parse_document_fields_coerces_valid_values():
    result = parse_document_fields(
        WageSlips,
        {"gross_amount": "1.892,00", "unknown_field": "drop me"},
    )
    assert result["gross_amount"] == Decimal("1892.00")
    assert "unknown_field" not in result


def test_parse_document_fields_drops_invalid_fields_keeps_valid_ones():
    result = parse_document_fields(ResidencePermit, {"gender": ">", "given_names": "Max"})
    assert result == {"given_names": "Max"}
    assert "gender" not in result


def test_validate_strict_returns_schema_fields_only():
    result = validate_strict(
        IdentityDocument,
        {"given_names": "Max", "last_name": "Mustermann"},
    )
    assert result == {"given_names": "Max", "last_name": "Mustermann"}
