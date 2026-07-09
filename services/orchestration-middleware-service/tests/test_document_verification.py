import uuid
import pytest
from unittest.mock import MagicMock, patch, Mock
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from beyondforms.auth import User as AuthUser, get_current_user, require_authenticated_user
from src.db import get_db
from src.main import app
from src.models import Users as DbUser, UserDocuments as DbDocument

client = TestClient(app)


@pytest.fixture
def mock_db():
    mock = MagicMock(spec=Session)
    return mock


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
def test_verify_document_updates_user_and_cleans_raw_data(mock_post, mock_db):
    """
    Test that calling POST /api/v1/documents/{document_id}/verify with a list of verified fields:
    1. Updates the user profile with the values from raw_data for those verified fields.
    2. Removes unverified fields from the raw_data JSONB column of UserDocuments.
    """
    document_id = uuid.uuid4()

    # Setup mock user
    mock_user = MagicMock(spec=DbUser)
    mock_user.first_name = "Old"
    mock_user.last_name = "Name"

    # Setup mock document
    mock_doc = MagicMock(spec=DbDocument)
    mock_doc.document_id = document_id
    mock_doc.raw_data = {
        "first_name": "New",
        "last_name": "Name",
        "sensitive_info": "Should be removed",
        "unverified_field": "Also removed",
    }

    # Mock DB query to return user and document
    def db_query_side_effect(model):
        query_mock = MagicMock()
        if model is DbDocument:
            query_mock.filter.return_value.first.return_value = mock_doc
        elif model is DbUser:
            query_mock.filter.return_value.first.return_value = mock_user
        return query_mock

    mock_db.query.side_effect = db_query_side_effect

    # Mock Rules Engine batch validation call
    mock_resp = Mock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "status": "success",
        "profile_sync": {"first_name": "NewCorrected", "last_name": "Name"},
    }
    mock_post.return_value = mock_resp

    payload = {
        "corrected_data": {
            "first_name": "NewCorrected",
            "last_name": "Name",
            "sensitive_info": "Should be removed",
            "unverified_field": "Also removed",
        },
        "verified_fields": ["first_name", "last_name"],
    }

    response = client.post(f"/api/v1/documents/{document_id}/verify", json=payload)

    assert response.status_code == 200, "Endpoint should exist and return 200 OK"

    # Verify user profile was updated
    assert mock_user.first_name == "NewCorrected", "User's first_name should be updated to 'NewCorrected'"

    # Verify all fields are preserved in raw_data as requested
    assert mock_doc.raw_data == {
        "first_name": "NewCorrected",
        "last_name": "Name",
        "sensitive_info": "Should be removed",
        "unverified_field": "Also removed",
    }, "All fields should be preserved in raw_data"

    # Verify status changed to VERIFIED
    assert mock_doc.status.value == "verified", "Document status should be updated to VERIFIED"

    assert mock_db.commit.call_count == 1, "Database session should be committed"


@patch("requests.post")
def test_verify_document_safe_type_coercion_for_empty_strings(mock_post, mock_db):
    """
    Test that empty strings for Date columns (date_of_birth) or Numeric columns (rent_total)
    are safely coerced to None to prevent PostgreSQL database casting exceptions.
    """
    document_id = uuid.uuid4()

    mock_user = MagicMock(spec=DbUser)
    mock_user.date_of_birth = None
    mock_user.rent_total = None

    mock_doc = MagicMock(spec=DbDocument)
    mock_doc.document_id = document_id
    mock_doc.raw_data = {
        "date_of_birth": "",
        "rent_total": "",
    }

    def db_query_side_effect(model):
        query_mock = MagicMock()
        if model is DbDocument:
            query_mock.filter.return_value.first.return_value = mock_doc
        elif model is DbUser:
            query_mock.filter.return_value.first.return_value = mock_user
        return query_mock

    mock_db.query.side_effect = db_query_side_effect

    # Mock Rules Engine batch validation call
    mock_resp = Mock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"status": "success", "profile_sync": {"date_of_birth": None, "rent_total": None}}
    mock_post.return_value = mock_resp

    payload = {
        "corrected_data": {
            "date_of_birth": "",
            "rent_total": "",
        },
        "verified_fields": ["date_of_birth", "rent_total"],
    }

    response = client.post(f"/api/v1/documents/{document_id}/verify", json=payload)

    assert response.status_code == 200

    # Verify safe type coercion to None instead of empty string ""
    assert mock_user.date_of_birth is None, "date_of_birth should be coerced to None"
    assert mock_user.rent_total is None, "rent_total should be coerced to None"


def test_delete_document_endpoint_transaction_safety(mock_db):
    """
    Test that DELETE /api/v1/documents/{document_id} deletes the document and associated files
    from the database and GCS in a transaction-safe order.
    """
    from src.models import UploadedFiles as DbUploadedFile
    from unittest.mock import patch

    document_id = uuid.uuid4()

    # Setup mocks
    mock_file = MagicMock(spec=DbUploadedFile)
    mock_file.bucket_name = "test-bucket"
    mock_file.object_name = "test-object"

    mock_doc = MagicMock(spec=DbDocument)
    mock_doc.document_id = document_id
    mock_doc.fk_file = mock_file

    # Mock DB query
    def db_query_side_effect(model):
        query_mock = MagicMock()
        if model is DbDocument:
            query_mock.filter.return_value.first.return_value = mock_doc
        return query_mock

    mock_db.query.side_effect = db_query_side_effect

    import src.gcs

    src.gcs._gcs_client = None

    with patch("google.cloud.storage.Client") as mock_gcs_client:
        mock_bucket = MagicMock()
        mock_blob = MagicMock()
        mock_blob.exists.return_value = True
        mock_bucket.blob.return_value = mock_blob
        mock_gcs_client.return_value.bucket.return_value = mock_bucket

        response = client.delete(f"/api/v1/documents/{document_id}")

        # It will fail with 404 since endpoint is not implemented yet (Red stage)
        assert response.status_code == 200
        assert mock_db.delete.call_count == 2  # mock_file and mock_doc
        assert mock_db.commit.call_count == 1
        mock_blob.delete.assert_called_once()


@patch("requests.post")
def test_verify_document_validation_error_reverse_mappings(mock_post, mock_db):
    """
    Test that validation errors from the Rules Engine are passed through to the client
    using the same field keys that were submitted for verification.
    """
    document_id = uuid.uuid4()

    mock_user = MagicMock(spec=DbUser)
    mock_doc = MagicMock(spec=DbDocument)
    mock_doc.document_id = document_id
    mock_doc.raw_data = {
        "given_names": "Helmut",
        "birth_date": "20.01.1959",
    }

    def db_query_side_effect(model):
        query_mock = MagicMock()
        if model is DbDocument:
            query_mock.filter.return_value.first.return_value = mock_doc
        elif model is DbUser:
            query_mock.filter.return_value.first.return_value = mock_user
        return query_mock

    mock_db.query.side_effect = db_query_side_effect

    # Mock Rules Engine returning a 422 error keyed by DB fields
    mock_resp = Mock()
    mock_resp.status_code = 422
    mock_resp.json.return_value = {
        "status": "error",
        "code": 422,
        "detail": "Validation failed",
        "validation_errors": {
            "given_names": [
                {
                    "field_path": "given_names",
                    "message": "String must have at least one character.",
                    "type": "value_error",
                }
            ],
            "birth_date": [
                {
                    "field_path": "birth_date",
                    "message": "The date provided cannot be in the future.",
                    "type": "value_error",
                }
            ],
        },
    }
    mock_post.return_value = mock_resp

    payload = {
        "corrected_data": {
            "given_names": "Helmut",
            "birth_date": "20.01.1959",
        },
        "verified_fields": ["given_names", "birth_date"],
    }

    response = client.post(f"/api/v1/documents/{document_id}/verify", json=payload)

    assert response.status_code == 422
    response_data = response.json()
    errors = response_data["detail"]["errors"]

    assert "given_names" in errors
    assert "birth_date" in errors
    assert errors["given_names"][0]["message"] == "String must have at least one character."
    assert errors["birth_date"][0]["message"] == "The date provided cannot be in the future."


@patch("requests.post")
def test_verify_document_validation_error_list_reverse_mappings(mock_post, mock_db):
    """
    Test that validation errors in standard Pydantic list format are passed through
    to the client unchanged.
    """
    document_id = uuid.uuid4()

    mock_user = MagicMock(spec=DbUser)
    mock_doc = MagicMock(spec=DbDocument)
    mock_doc.document_id = document_id
    mock_doc.raw_data = {
        "given_names": "Helmut",
        "birth_date": "20.01.1959",
    }

    def db_query_side_effect(model):
        query_mock = MagicMock()
        if model is DbDocument:
            query_mock.filter.return_value.first.return_value = mock_doc
        elif model is DbUser:
            query_mock.filter.return_value.first.return_value = mock_user
        return query_mock

    mock_db.query.side_effect = db_query_side_effect

    # Mock rules engine response with validation error list format
    mock_resp = MagicMock()
    mock_resp.status_code = 422
    mock_resp.json.return_value = {
        "status": "error",
        "code": 422,
        "detail": "Validation failed",
        "validation_errors": [
            {
                "loc": ["body", "fields", "given_names"],
                "message": "String must have at least one character.",
                "type": "value_error",
            },
            {
                "loc": ["body", "fields", "birth_date"],
                "message": "The date provided cannot be in the future.",
                "type": "value_error",
            },
        ],
    }
    mock_post.return_value = mock_resp

    payload = {
        "corrected_data": {
            "given_names": "Helmut",
            "birth_date": "20.01.1959",
        },
        "verified_fields": ["given_names", "birth_date"],
    }

    response = client.post(f"/api/v1/documents/{document_id}/verify", json=payload)

    assert response.status_code == 422
    response_data = response.json()
    errors = response_data["detail"]["errors"]

    assert errors[0]["loc"] == ["body", "fields", "given_names"]
    assert errors[1]["loc"] == ["body", "fields", "birth_date"]
    assert errors[0]["message"] == "String must have at least one character."
    assert errors[1]["message"] == "The date provided cannot be in the future."


@patch("requests.post")
def test_verify_document_splits_fullname_success(mock_post, mock_db):
    document_id = uuid.uuid4()

    mock_user = MagicMock(spec=DbUser)
    mock_user.first_name = ""
    mock_user.last_name = ""

    mock_doc = MagicMock(spec=DbDocument)
    mock_doc.document_id = document_id
    mock_doc.raw_data = {"full_name": "Helmut Karl Klar"}

    def db_query_side_effect(model):
        query_mock = MagicMock()
        if model is DbDocument:
            query_mock.filter.return_value.first.return_value = mock_doc
        elif model is DbUser:
            query_mock.filter.return_value.first.return_value = mock_user
        return query_mock

    mock_db.query.side_effect = db_query_side_effect

    mock_resp = Mock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "status": "success",
        "profile_sync": {"first_name": "Helmut Karl", "last_name": "Klar"},
    }
    mock_post.return_value = mock_resp

    payload = {
        "corrected_data": {
            "full_name": "Helmut Karl Klar",
        },
        "verified_fields": ["full_name"],
    }

    response = client.post(f"/api/v1/documents/{document_id}/verify", json=payload)

    assert response.status_code == 200
    assert response.json()["status"] == "success"

    called_json = mock_post.call_args[1]["json"]
    assert called_json["fields"] == {"full_name": "Helmut Karl Klar"}

    assert mock_user.first_name == "Helmut Karl"
    assert mock_user.last_name == "Klar"
    mock_db.commit.assert_called_once()


@patch("requests.post")
def test_verify_document_maps_health_insurance_enum_to_pascalcase(mock_post, mock_db):
    document_id = uuid.uuid4()
    mock_user = MagicMock(spec=DbUser)
    mock_user.health_insurance_status = ""

    mock_doc = MagicMock(spec=DbDocument)
    mock_doc.document_id = document_id
    mock_doc.raw_data = {"health_insurance_status": "compulsory_insurance"}

    def db_query_side_effect(model):
        query_mock = MagicMock()
        if model is DbDocument:
            query_mock.filter.return_value.first.return_value = mock_doc
        elif model is DbUser:
            query_mock.filter.return_value.first.return_value = mock_user
        return query_mock

    mock_db.query.side_effect = db_query_side_effect

    mock_resp = Mock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "status": "success",
        "profile_sync": {"health_insurance_status": "compulsory_insurance"},
    }
    mock_post.return_value = mock_resp

    payload = {
        "corrected_data": {"health_insurance_status": "compulsory_insurance"},
        "verified_fields": ["health_insurance_status"],
    }

    response = client.post(f"/api/v1/documents/{document_id}/verify", json=payload)
    assert response.status_code == 200
    assert mock_user.health_insurance_status == "Compulsory Insurance"


@patch("requests.post")
def test_verify_document_maps_tenancy_status_boolean(mock_post, mock_db):
    document_id = uuid.uuid4()
    mock_user = MagicMock(spec=DbUser)
    mock_user.tenancy_status = ""

    mock_doc = MagicMock(spec=DbDocument)
    mock_doc.document_id = document_id
    mock_doc.raw_data = {"is_main_tenant": True}

    def db_query_side_effect(model):
        query_mock = MagicMock()
        if model is DbDocument:
            query_mock.filter.return_value.first.return_value = mock_doc
        elif model is DbUser:
            query_mock.filter.return_value.first.return_value = mock_user
        return query_mock

    mock_db.query.side_effect = db_query_side_effect

    mock_resp = Mock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "status": "success",
        "profile_sync": {"is_main_tenant": True},
    }
    mock_post.return_value = mock_resp

    payload = {
        "corrected_data": {"is_main_tenant": True},
        "verified_fields": ["is_main_tenant"],
    }

    response = client.post(f"/api/v1/documents/{document_id}/verify", json=payload)
    assert response.status_code == 200
    assert mock_user.tenancy_status == "Main Tenant"


@patch("requests.post")
def test_verify_document_pension_notice_adds_income_source(mock_post, mock_db):
    document_id = uuid.uuid4()
    mock_user = MagicMock(spec=DbUser)
    mock_user.income_sources = ["salary"]

    mock_doc = MagicMock(spec=DbDocument)
    mock_doc.document_id = document_id
    mock_doc.document_type = "pension_notice"
    mock_doc.raw_data = {"monthly_amount": "650.00"}

    def db_query_side_effect(model):
        query_mock = MagicMock()
        if model is DbDocument:
            query_mock.filter.return_value.first.return_value = mock_doc
        elif model is DbUser:
            query_mock.filter.return_value.first.return_value = mock_user
        return query_mock

    mock_db.query.side_effect = db_query_side_effect

    mock_resp = Mock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "status": "success",
        "profile_sync": {"monthly_income": 650.0},
    }
    mock_post.return_value = mock_resp

    payload = {
        "document_type": "pension_notice",
        "corrected_data": {"monthly_amount": "650.00"},
        "verified_fields": ["monthly_amount"],
    }

    response = client.post(f"/api/v1/documents/{document_id}/verify", json=payload)
    assert response.status_code == 200
    assert "pension" in mock_user.income_sources
    assert "salary" in mock_user.income_sources
