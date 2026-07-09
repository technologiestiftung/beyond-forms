import uuid
import decimal
import datetime
import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from beyondforms.auth import User as AuthUser, get_current_user, require_authenticated_user
from src.db import get_db
from src.main import app
from src.models import (
    Users as DbUser,
    UserDocuments as DbDocument,
    DocumentStatusType,
    GenderType,
    HealthInsuranceStatusType,
)
from unittest.mock import patch
from src.mappers import map_flat_to_rules_engine_payload
from tests.http_mocks import validate_fields_error_response, validate_fields_success_response

client = TestClient(app)

# ==========================================
# UNIT TESTS: utils.py Parsers & Normalizers
# ==========================================


# =================================================
# INTEGRATION TESTS: verify_document Endpoint Sync
# =================================================


@pytest.fixture
def mock_db():
    return MagicMock(spec=Session)


@pytest.fixture(autouse=True)
def override_dependencies(mock_db):
    def override_get_current_user():
        return AuthUser(
            user_id="test-auth-id",
            user_name="test_user",
            session_id="test-session-id",
            is_authenticated=True,
        )

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[require_authenticated_user] = override_get_current_user
    yield
    app.dependency_overrides.clear()


@patch("requests.post")
def test_verify_document_syncs_mapped_keys_and_coerces_types(mock_post, mock_db):
    """
    Tests that:
    1. Document keys are translated to DB columns (given_names -> first_name, monthly_total_rent -> rent_total).
    2. Raw OCR inputs are batch validated via the Rules Engine.
    3. Safe conversions are resolved before database saving.
    """
    document_id = uuid.uuid4()

    # Setup mock user
    mock_user = MagicMock(spec=DbUser)
    mock_user.first_name = None
    mock_user.last_name = None
    mock_user.date_of_birth = None
    mock_user.nationality = None
    mock_user.rent_total = None
    mock_user.rent_total = None
    mock_user.living_area = None
    mock_user.identification_numbers = None
    mock_user.legal_gender = "original_unmodified"
    mock_user.street = None
    mock_user.house_number = None
    mock_user.zip_code = None
    mock_user.city = None
    mock_user.state = None

    # Setup mock document (identity_document type)
    mock_doc = MagicMock(spec=DbDocument)
    mock_doc.document_id = document_id
    mock_doc.document_type = "id_card"
    mock_doc.raw_data = {
        "given_names": "Helmut",
        "last_name": "Klar",
        "date_of_birth": "01.05.1959",
        "nationality": "DEUTSCH",
        "document_id": "XYZ123",
        "street": "Hauptstraße",
        "house_number": "12A",
        "zip_code": "12345",
        "city": "Berlin",
        "state": "Berlin",
    }

    def db_query_side_effect(model):
        query_mock = MagicMock()
        if model is DbDocument:
            query_mock.filter.return_value.first.return_value = mock_doc
        elif model is DbUser:
            query_mock.filter.return_value.first.return_value = mock_user
        return query_mock

    mock_db.query.side_effect = db_query_side_effect

    # Mock Rules Engine Batch Validation HTTP response
    mock_resp = validate_fields_success_response(
        validated_fields={
            "given_names": "Helmut",
            "last_name": "Klar",
            "date_of_birth": "1959-05-01",
            "nationality": "DEU",
            "document_id": "XYZ123",
        },
        profile_sync={
            "first_name": "Helmut",
            "last_name": "Klar",
            "date_of_birth": "1959-05-01",
            "nationality": "DE",
            "identification_numbers": "XYZ123",
        },
    )
    mock_post.return_value = mock_resp

    payload = {
        "corrected_data": {
            "given_names": "Helmut",
            "last_name": "Klar",
            "date_of_birth": "01.05.1959",
            "nationality": "DEUTSCH",
            "document_id": "XYZ123",
            "legal_gender": "UnrecognisedGenderRawString",
            "street": "Hauptstraße",
            "house_number": "12A",
            "zip_code": "12345",
            "city": "Berlin",
            "state": "Berlin",
        },
        "verified_fields": [
            "given_names",
            "last_name",
            "date_of_birth",
            "nationality",
            "document_id",
        ],
        "document_type": "id_card",
    }

    response = client.post(f"/api/v1/documents/{document_id}/verify", json=payload)

    assert response.status_code == 200

    # Assert key mapping and batch validations are persisted properly
    assert mock_user.first_name == "Helmut"
    assert mock_user.last_name == "Klar"
    assert mock_user.date_of_birth == datetime.date(1959, 5, 1)
    assert mock_user.nationality == "DE"
    assert mock_user.identification_numbers == "XYZ123"
    assert mock_user.street is None

    assert mock_doc.status == DocumentStatusType.VERIFIED
    assert mock_db.commit.call_count == 1


@patch("requests.post")
def test_verify_document_safety_gates(mock_post, mock_db):
    """
    Tests that writing to unauthorized fields (e.g. 'id' or 'authentik_id')
    via corrected_data does not sync to the user profile when only schema fields are verified.
    """
    document_id = uuid.uuid4()

    mock_user = MagicMock(spec=DbUser)
    mock_user.id = uuid.UUID("11111111-1111-1111-1111-111111111111")
    mock_user.authentik_id = "auth-id-original"

    mock_doc = MagicMock(spec=DbDocument)
    mock_doc.document_id = document_id
    mock_doc.document_type = "id_card"
    mock_doc.raw_data = {
        "id": "99999999-9999-9999-9999-999999999999",
        "authentik_id": "hacked-auth-id",
        "first_name": "Helmut",
    }

    def db_query_side_effect(model):
        query_mock = MagicMock()
        if model is DbDocument:
            query_mock.filter.return_value.first.return_value = mock_doc
        elif model is DbUser:
            query_mock.filter.return_value.first.return_value = mock_user
        return query_mock

    mock_db.query.side_effect = db_query_side_effect

    # Mock Rules Engine Response
    mock_post.return_value = validate_fields_success_response(
        profile_sync={"first_name": "Helmut"},
    )

    payload = {
        "corrected_data": {
            "id": "99999999-9999-9999-9999-999999999999",
            "authentik_id": "hacked-auth-id",
            "first_name": "Helmut",
        },
        "verified_fields": ["given_names"],
        "document_type": "id_card",
    }

    response = client.post(f"/api/v1/documents/{document_id}/verify", json=payload)

    assert response.status_code == 200

    # First name is allowed, should be updated
    assert mock_user.first_name == "Helmut"

    # Safety fields must NOT be modified
    assert mock_user.id == uuid.UUID("11111111-1111-1111-1111-111111111111")
    assert mock_user.authentik_id == "auth-id-original"


# ==================================================
# UNIT TESTS: mappers.py Rules Engine Casing Mapping
# ==================================================


def test_map_flat_to_rules_engine_payload_case_and_enum_alignment():
    """
    Verifies that the flat database representation (which uses Mixed Case or different words)
    is translated correctly to what rules-engine expects to prevent 422 validation crashes.
    """
    db_user = MagicMock(spec=DbUser)
    db_user.first_name = "Helmut"
    db_user.last_name = "Klar"
    db_user.date_of_birth = datetime.date(1959, 5, 1)
    db_user.legal_gender = GenderType.MALE  # value = "Male"
    db_user.nationality = "DEUTSCH"
    db_user.place_of_birth = "Au"  # 2-letter city: "Au" (Germany) -> country_of_birth must NOT map to "AU" (Australia)
    db_user.accomodation_type = None
    db_user.tenancy_status = None
    db_user.rent_total = decimal.Decimal("430.00")
    db_user.heating_costs = decimal.Decimal("85.50")
    db_user.living_area = decimal.Decimal("45.5")
    db_user.number_of_rooms = 2
    db_user.income_sources = ["pension"]
    db_user.monthly_income = decimal.Decimal("650.00")
    db_user.health_insurance_status = HealthInsuranceStatusType.COMPULSORY_INSURANCE  # value = "Compulsory Insurance"
    db_user.health_insurance_provider = "AOK Berlin"
    db_user.pension_insurance_provider = "Deutsche Rentenversicherung"
    db_user.pension_insurance_no = "1234567890"
    db_user.has_received_previous_benefits = True
    db_user.previous_benefits_authority = "Sozialamt Tempelhof-Schöneberg"
    db_user.has_costly_medical_nutrition = False

    # New Category 4 fields
    db_user.bic = "AOKBDEBB"
    db_user.has_applied_for_benefits_awaiting_decision = True
    db_user.benefits_awaiting_decision_type = "Grundsicherung"
    db_user.benefits_awaiting_decision_application_date = datetime.date(2026, 6, 1)
    db_user.benefits_awaiting_decision_office = "Sozialamt Tempelhof-Schöneberg"
    db_user.benefits_awaiting_decision_reference = "Ref-123"
    db_user.are_one_time_payments_expected = True
    db_user.one_time_payments_expected_type = "Bonus"
    db_user.one_time_payments_expected_amount = decimal.Decimal("1000.00")
    db_user.one_time_payments_expected_date = datetime.date(2026, 7, 1)

    payload = map_flat_to_rules_engine_payload(db_user)

    content = payload["form_content"]
    identity = content["applicant_identity"]
    insurance = content["applicant_insurance"]
    accommodation = content["accommodation"]
    finances = content["applicant_finances"]
    applicant_information = content["applicant_information"]
    income_information = content["income_information"]

    # 1. Assert Gender Casing mapping
    assert identity["gender"] == "MALE"  # "Male" (DB) -> "MALE" (Rules Engine)

    # 2. Assert Country Code mapping & country of birth derived from nationality.
    assert identity["nationality"] == "DEUTSCH"
    assert identity["country_of_birth"] == "DEUTSCH"

    # 3. Assert Health Insurance Status Casing mapping
    assert insurance["health_insurance_status"] == "compulsory_insurance"

    # 4. Assert Social Security Status formatting
    assert insurance["social_security_status"] == "none"

    # 5. Assert finances values
    assert finances["pension_income"] == 650.00
    assert finances["non_self_employed_income"] == 0.0

    # 6. Assert accommodation values
    assert accommodation["total_monthly_rent"] == 430.00
    assert accommodation["heating_cost_advance"] == 85.50
    assert accommodation["living_area_square_meters"] == 45

    # 7. Assert bank details mapping (including BIC)
    bank_details = applicant_information["applicant_bank_details"]
    assert bank_details["bic"] == "AOKBDEBB"

    # 8. Assert benefits awaiting decision details mapping
    awaiting_details = income_information["benefits_awaiting_decision_details_applicant"]
    assert awaiting_details["has_applied_for_benefits_awaiting_decision"] is True
    assert awaiting_details["benefits_awaiting_decision_type"] == "Grundsicherung"
    assert awaiting_details["benefits_awaiting_decision_application_date"] == "2026-06-01"
    assert awaiting_details["benefits_awaiting_decision_office"] == "Sozialamt Tempelhof-Schöneberg"
    assert awaiting_details["benefits_awaiting_decision_reference"] == "Ref-123"

    # 9. Assert expected one-time payments details mapping
    expected_payments = income_information["one-time_payments_expected_details_applicant"]
    assert expected_payments["are_one-time_payments_expected"] is True
    assert expected_payments["one-time_payments_expected_type"] == "Bonus"
    assert expected_payments["one-time_payments_expected_amount"] == 1000.00
    assert expected_payments["one-time_payments_expected_date"] == "2026-07-01"


def test_map_flat_to_rules_engine_payload_null_monthly_income():
    db_user = MagicMock(spec=DbUser)
    db_user.first_name = "Helmut"
    db_user.last_name = "Klar"
    db_user.legal_gender = None
    db_user.nationality = None
    db_user.place_of_birth = None
    db_user.accomodation_type = None
    db_user.tenancy_status = None
    db_user.rent_total = None
    db_user.heating_costs = None
    db_user.living_area = None
    db_user.number_of_rooms = None
    db_user.income_sources = ["pension"]
    db_user.monthly_income = None
    db_user.health_insurance_status = None
    db_user.health_insurance_provider = None
    db_user.pension_insurance_provider = None
    db_user.pension_insurance_no = None
    db_user.has_received_previous_benefits = False
    db_user.has_costly_medical_nutrition = False
    db_user.bic = None
    db_user.benefits_awaiting_decision_type = None
    db_user.benefits_awaiting_decision_application_date = None
    db_user.benefits_awaiting_decision_office = None
    db_user.benefits_awaiting_decision_reference = None
    db_user.are_one_time_payments_expected = None
    db_user.one_time_payments_expected_type = None
    db_user.one_time_payments_expected_amount = None
    db_user.one_time_payments_expected_date = None
    db_user.has_applied_for_asylum_benefits = None

    payload = map_flat_to_rules_engine_payload(db_user)
    assert payload["form_content"]["applicant_finances"]["pension_income"] == 0.0


@patch("requests.post")
def test_verify_document_extracts_and_verifies_address(mock_post, mock_db):
    """
    Tests that:
    1. A verified field "address" is parsed into street, house_number, zip_code, and city.
    2. These subfields are sent to rules-engine for validation.
    3. The database User record is updated with these individual fields.
    4. The Berlin district is correctly synced.
    """
    document_id = uuid.uuid4()

    # Setup mock user
    mock_user = MagicMock(spec=DbUser)
    mock_user.street = None
    mock_user.house_number = None
    mock_user.zip_code = None
    mock_user.city = None
    mock_user.district = None

    # Setup mock document
    mock_doc = MagicMock(spec=DbDocument)
    mock_doc.document_id = document_id
    mock_doc.document_type = "id_card"
    mock_doc.raw_data = {"address": "Hauptstraße 12, 10115 Berlin"}

    def db_query_side_effect(model):
        query_mock = MagicMock()
        if model is DbDocument:
            query_mock.filter.return_value.first.return_value = mock_doc
        elif model is DbUser:
            query_mock.filter.return_value.first.return_value = mock_user
        return query_mock

    mock_db.query.side_effect = db_query_side_effect

    # Mock Rules Engine Batch Validation response
    mock_post.return_value = validate_fields_success_response(
        validated_fields={"address": "Hauptstraße 12, 10115 Berlin"},
        profile_sync={
            "street": "Hauptstraße",
            "house_number": "12",
            "zip_code": "10115",
            "city": "Berlin",
        },
    )

    payload = {
        "corrected_data": {
            "address": "Hauptstraße 12, 10115 Berlin",
        },
        "verified_fields": ["address"],
        "document_type": "id_card",
    }

    response = client.post(f"/api/v1/documents/{document_id}/verify", json=payload)

    assert response.status_code == 200

    # Assert Rules Engine is called with individual parsed fields
    mock_post.assert_called()
    rules_engine_call = next(call for call in mock_post.call_args_list if "validate-fields" in call.args[0])
    called_json = rules_engine_call.kwargs["json"]
    assert "fields" in called_json
    assert called_json["fields"] == {"address": "Hauptstraße 12, 10115 Berlin"}
    assert called_json["document_type"] == "identity_document"

    # Assert user record is updated
    assert mock_user.street == "Hauptstraße"
    assert mock_user.house_number == "12"
    assert mock_user.zip_code == "10115"
    assert mock_user.city == "Berlin"
    # District should be resolved to "Mitte" since PLZ 10115 maps to Mitte
    assert mock_user.district == "Mitte"

    assert mock_doc.status == DocumentStatusType.VERIFIED
    assert mock_db.commit.call_count == 1


@patch("requests.post")
def test_verify_document_custom_field_mappings(mock_post, mock_db):
    """
    Tests that "monthly_total_rent" maps to rent_total and is coerced on save.
    """
    document_id = uuid.uuid4()

    # Setup mock user
    mock_user = MagicMock(spec=DbUser)
    mock_user.rent_total = None
    mock_user.monthly_income = None

    # Setup mock document
    mock_doc = MagicMock(spec=DbDocument)
    mock_doc.document_id = document_id
    mock_doc.document_type = "rent"
    mock_doc.raw_data = {"monthly_total_rent": "550.50"}

    def db_query_side_effect(model):
        query_mock = MagicMock()
        if model is DbDocument:
            query_mock.filter.return_value.first.return_value = mock_doc
        elif model is DbUser:
            query_mock.filter.return_value.first.return_value = mock_user
        return query_mock

    mock_db.query.side_effect = db_query_side_effect

    # Mock Rules Engine Batch Validation response
    mock_post.return_value = validate_fields_success_response(
        validated_fields={"monthly_total_rent": 550.50},
        profile_sync={
            "rent_total": 550.50,
        },
    )

    payload = {
        "corrected_data": {"monthly_total_rent": "550.50"},
        "verified_fields": ["monthly_total_rent"],
        "document_type": "rent",
    }

    response = client.post(f"/api/v1/documents/{document_id}/verify", json=payload)

    assert response.status_code == 200

    # Assert Rules Engine is called with mapped fields
    mock_post.assert_called()
    rules_engine_call = next(call for call in mock_post.call_args_list if "validate-fields" in call.args[0])
    called_json = rules_engine_call.kwargs["json"]
    assert "fields" in called_json
    assert called_json["fields"] == {"monthly_total_rent": "550.50"}
    assert called_json["document_type"] == "rental_contract"

    assert mock_user.rent_total == decimal.Decimal("550.50")

    assert mock_doc.status == DocumentStatusType.VERIFIED
    assert mock_db.commit.call_count == 1


@patch("requests.post")
def test_verify_id_card_rejects_gender_field_via_document_schema(mock_post, mock_db):
    document_id = uuid.uuid4()
    mock_user = MagicMock(spec=DbUser)
    mock_doc = MagicMock(spec=DbDocument)
    mock_doc.document_id = document_id
    mock_doc.document_type = "id_card"
    mock_doc.raw_data = {"given_names": "Helmut", "gender": ">"}

    def db_query_side_effect(model):
        query_mock = MagicMock()
        if model is DbDocument:
            query_mock.filter.return_value.first.return_value = mock_doc
        elif model is DbUser:
            query_mock.filter.return_value.first.return_value = mock_user
        return query_mock

    mock_db.query.side_effect = db_query_side_effect

    mock_post.return_value = validate_fields_error_response(
        {"gender": [{"field_path": "gender", "message": "Extra inputs are not permitted", "type": "extra_forbidden"}]}
    )

    payload = {
        "corrected_data": {"given_names": "Helmut", "gender": ">"},
        "verified_fields": ["given_names", "gender"],
        "document_type": "id_card",
    }

    response = client.post(f"/api/v1/documents/{document_id}/verify", json=payload)

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["message"] == "Validation failed"
    assert "gender" in detail["errors"]
    mock_post.assert_called_once()


@patch("requests.post")
def test_verify_registration_rejects_unknown_gender_field(mock_post, mock_db):
    document_id = uuid.uuid4()
    mock_user = MagicMock(spec=DbUser)
    mock_doc = MagicMock(spec=DbDocument)
    mock_doc.document_id = document_id
    mock_doc.document_type = "registration"
    mock_doc.raw_data = {"given_names": "Helmut", "gender": ">"}

    def db_query_side_effect(model):
        query_mock = MagicMock()
        if model is DbDocument:
            query_mock.filter.return_value.first.return_value = mock_doc
        elif model is DbUser:
            query_mock.filter.return_value.first.return_value = mock_user
        return query_mock

    mock_db.query.side_effect = db_query_side_effect

    mock_post.return_value = validate_fields_error_response(
        {"gender": [{"field_path": "gender", "message": "Extra inputs are not permitted", "type": "extra_forbidden"}]}
    )

    payload = {
        "corrected_data": {"given_names": "Helmut", "gender": ">"},
        "verified_fields": ["given_names", "gender"],
        "document_type": "registration",
    }

    response = client.post(f"/api/v1/documents/{document_id}/verify", json=payload)

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["message"] == "Validation failed"
    assert "gender" in detail["errors"]
