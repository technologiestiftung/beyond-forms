import pytest
from typing import Any, Dict
from fastapi.testclient import TestClient
from pydantic import EmailStr

from src.app.main import app

client = TestClient(app)


@pytest.fixture
def mock_field_registry(monkeypatch) -> Dict[str, Any]:
    mock_data = {"email_address": EmailStr}
    # patch the internal dictionary of the registry instance
    monkeypatch.setattr("src.app.main.field_registry._registry", mock_data)
    return mock_data


def test_error_for_unregistered_field_type(mock_field_registry: Dict[str, Any]) -> None:
    request_payload: Dict[str, Any] = {"field_type": "non_existent_type", "field_value": "some_value"}

    response = client.post("/validate-field", json=request_payload)
    response_data = response.json()

    assert response.status_code == 404
    assert "not found" in response_data["detail"]


def test_validation_error_for_invalid_email_format(mock_field_registry: Dict[str, Any]) -> None:
    request_payload: Dict[str, Any] = {"field_type": "email_address", "field_value": "invalid@email!com"}

    response = client.post("/validate-field", json=request_payload)
    response_data = response.json()

    assert response.status_code == 422
    assert response_data["status"] == "error"
    assert len(response_data["validation_errors"]) > 0


def test_success_for_valid_email_format(mock_field_registry: Dict[str, Any]) -> None:
    valid_email: str = "test.user@example.com"
    request_payload: Dict[str, Any] = {"field_type": "email_address", "field_value": valid_email}

    response = client.post("/validate-field", json=request_payload)
    response_data = response.json()

    assert response.status_code == 200
    assert response_data["code"] == 200
    assert response_data["validated_value"] == valid_email


def test_validate_fields_endpoint_fail_closed_on_unknown() -> None:
    request_payload = {
        "fields": {
            "some_completely_random_unknown_field_name": "Some text",
        }
    }
    response = client.post("/validate-fields", json=request_payload)
    response_data = response.json()

    assert response.status_code == 422
    assert response_data["status"] == "error"
    assert "some_completely_random_unknown_field_name" in response_data["validation_errors"]


def test_validate_fields_address_mapping() -> None:
    request_payload = {
        "fields": {
            "street": "Hauptstraße",
            "house_number": "12A",
            "zip_code": "12345",
            "city": "Berlin",
            "state": "Berlin",
        }
    }
    response = client.post("/validate-fields", json=request_payload)
    response_data = response.json()

    assert response.status_code == 200
    validated = response_data["validated_fields"]
    assert validated["street"] == "Hauptstraße"
    assert validated["house_number"] == "12A"
    assert validated["zip_code"] == "12345"
    assert validated["city"] == "Berlin"
    assert validated["state"] == "Berlin"


def test_validate_fields_rejects_invalid_legal_gender() -> None:
    response = client.post("/validate-fields", json={"fields": {"legal_gender": ">"}})
    response_data = response.json()

    assert response.status_code == 422
    assert response_data["status"] == "error"
    assert "legal_gender" in response_data["validation_errors"]


def test_validate_fields_rejects_unrecognised_legal_gender() -> None:
    response = client.post(
        "/validate-fields",
        json={"fields": {"legal_gender": "UnrecognisedGenderRawString"}},
    )
    response_data = response.json()

    assert response.status_code == 422
    assert response_data["status"] == "error"
    assert "legal_gender" in response_data["validation_errors"]


def test_validate_fields_with_document_type_rejects_unknown_field_on_identity_document():
    response = client.post(
        "/validate-fields",
        json={
            "document_type": "identity_document",
            "fields": {"given_names": "Max", "gender": ">"},
        },
    )
    assert response.status_code == 422
    body = response.json()
    assert body["status"] == "error"
    assert "gender" in body["validation_errors"]


def test_validate_fields_with_document_type_rejects_invalid_gender_on_residence_permit():
    response = client.post(
        "/validate-fields",
        json={
            "document_type": "residence_permit",
            "fields": {"given_names": "Max", "gender": ">"},
        },
    )
    assert response.status_code == 422
    body = response.json()
    assert body["status"] == "error"
    assert "gender" in body["validation_errors"]


def test_validate_fields_with_document_type_accepts_valid_residence_permit_gender():
    response = client.post(
        "/validate-fields",
        json={
            "document_type": "residence_permit",
            "fields": {"given_names": "Max", "gender": "M"},
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["validated_fields"]["gender"] == "M"
    assert body["profile_sync"]["legal_gender"] == "MALE"


def test_validate_fields_with_document_type_unknown_document_type():
    response = client.post(
        "/validate-fields",
        json={
            "document_type": "not_a_real_document",
            "fields": {"given_names": "Max"},
        },
    )
    assert response.status_code == 400


def test_validate_fields_with_document_type_rejects_invalid_gender_via_profile_rules():
    response = client.post(
        "/validate-fields",
        json={
            "document_type": "residence_permit",
            "fields": {"given_names": "Max", "gender": "UnrecognisedGenderRawString"},
        },
    )
    assert response.status_code == 422
    body = response.json()
    assert "gender" in body["validation_errors"]


def test_validate_fields_with_document_type_parses_address_into_profile_sync():
    response = client.post(
        "/validate-fields",
        json={
            "document_type": "identity_document",
            "fields": {"address": "Hauptstraße 12, 10115 Berlin"},
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["profile_sync"]["street"] == "Hauptstraße"
    assert body["profile_sync"]["house_number"] == "12"
    assert body["profile_sync"]["zip_code"] == "10115"
    assert body["profile_sync"]["city"] == "Berlin"


def test_validate_fields_with_document_type_syncs_same_named_profile_fields_without_alias_map():
    response = client.post(
        "/validate-fields",
        json={
            "document_type": "registration_certificate",
            "fields": {"marital_status": "married"},
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["profile_sync"]["marital_status"] == "married"


def test_validate_fields_with_document_type_syncs_bank_statement_income_fields():
    response = client.post(
        "/validate-fields",
        json={
            "document_type": "bank_statements",
            "fields": {
                "amount_pension": "650.00",
                "amount_rent": "430.00",
                "iban": "DE89370400440532013000",
                "account_holder_name": "Helmut Klar",
            },
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["validated_fields"]["amount_pension"] == 650.0
    assert body["validated_fields"]["amount_rent"] == 430.0
    assert body["profile_sync"]["monthly_income"] == 650.0
    assert body["profile_sync"]["rent_total"] == 430.0
    assert body["profile_sync"]["iban"] == "DE89370400440532013000"
    assert body["profile_sync"]["account_holder"] == "Helmut Klar"


def test_validate_fields_with_pension_notice_syncs_to_profile():
    response = client.post(
        "/validate-fields",
        json={
            "document_type": "pension_notice",
            "fields": {
                "monthly_amount": "650.00",
                "pension_insurance_number": "33010259M041",
            },
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["validated_fields"]["monthly_amount"] == 650.0
    assert body["validated_fields"]["pension_insurance_number"] == "33010259M041"
    assert body["profile_sync"]["monthly_income"] == 650.0
    assert body["profile_sync"]["pension_insurance_no"] == "33010259M041"


def test_validate_fields_with_document_type_maps_rental_contract_rent_to_profile():
    response = client.post(
        "/validate-fields",
        json={
            "document_type": "rental_contract",
            "fields": {"monthly_total_rent": "550.50"},
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["profile_sync"]["rent_total"] == 550.5


def test_validate_fields_with_identity_document_place_of_birth():
    response = client.post(
        "/validate-fields",
        json={
            "document_type": "identity_document",
            "fields": {"place_of_birth": "Berlin"},
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["profile_sync"]["place_of_birth"] == "Berlin"


def test_validate_fields_with_identity_document_nationality_de_syncs_german_citizenship():
    response = client.post(
        "/validate-fields",
        json={
            "document_type": "identity_document",
            "fields": {"nationality": "DE"},
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["profile_sync"]["nationality"] == "DE"
    assert body["profile_sync"]["is_german_citizen"] is True
    assert body["profile_sync"]["residence_status"] == "Citizen"
