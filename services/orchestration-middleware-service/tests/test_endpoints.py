import io
import uuid
from unittest.mock import MagicMock, patch, AsyncMock

import pytest
from beyondforms.auth import User as AuthUser, get_current_user, require_authenticated_user
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from src.db import get_db
from src.main import app
from src.models import UploadedFiles, UserDocuments, Users as DbUser
from src.services.user_service import UserService, get_user_service

client = TestClient(app)


@pytest.fixture
def mock_db():
    """Fixture to provide a mocked SQLAlchemy session."""
    mock = MagicMock(spec=Session)
    return mock


@pytest.fixture
def mock_user_service():
    mock = MagicMock(spec=UserService)
    mock.get_internal_user_id.return_value = str(uuid.uuid4())
    mock.get_or_create_user_application.return_value = (str(uuid.uuid4()), str(uuid.uuid4()))
    return mock


@pytest.fixture(autouse=True)
def override_dependencies(mock_db, mock_user_service):
    """Fixture to override FastAPI dependencies for all tests."""

    def override_get_current_user():
        return AuthUser(
            user_id="test-auth-id", user_name="1234567890", session_id="test-session-id", is_authenticated=True
        )

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[require_authenticated_user] = override_get_current_user
    app.dependency_overrides[get_user_service] = lambda: mock_user_service
    yield
    app.dependency_overrides.clear()


@patch("src.routes.user.run_background_gcs_cleanup")
def test_get_profile_success(mock_cleanup, mock_db):
    # Setup mock return for User query
    mock_user_id = uuid.uuid4()
    mock_user = DbUser(id=mock_user_id, phone_number="1234567890")
    # Mock chain: db.query(User).filter(...).first()
    mock_db.query.return_value.filter.return_value.first.return_value = mock_user

    response = client.get("/profile")

    assert response.status_code == 200
    data = response.json()
    assert data["phone_number"] == "1234567890"

    # Verify query was called
    mock_db.query.assert_called_with(DbUser)
    mock_cleanup.assert_called_once_with(mock_user_id)


@patch("src.routes.user.run_background_gcs_cleanup")
def test_get_profile_not_found(mock_cleanup, mock_db):
    # Mock no user found
    mock_db.query.return_value.filter.return_value.first.return_value = None

    response = client.get("/profile")
    assert response.status_code == 200
    assert response.json()["first_name"] == ""
    assert response.json()["phone_number"] == "1234567890"
    mock_cleanup.assert_not_called()


@patch("requests.post")
def test_update_profile_success(mock_post, mock_db):
    # Setup mock for rules engine response
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"status": "success", "message": "Validation successful"}
    mock_post.return_value = mock_response

    # Setup mock return for User query
    mock_user = DbUser(id=uuid.uuid4(), phone_number="1234567890")
    mock_db.query.return_value.filter.return_value.first.return_value = mock_user

    payload = {"first_name": "Sandor", "last_name": "Miller"}
    response = client.post("/profile", json=payload)

    assert response.status_code == 200
    assert response.json()["status"] == "success"

    # Verify user was updated
    assert mock_user.first_name == "Sandor"
    assert mock_user.last_name == "Miller"
    mock_db.commit.assert_called_once()


@patch("requests.post")
def test_update_profile_all_fields_success(mock_post, mock_db):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"status": "success", "message": "Validation successful"}
    mock_post.return_value = mock_response

    mock_user = DbUser(id=uuid.uuid4(), phone_number="1234567890")
    mock_db.query.return_value.filter.return_value.first.return_value = mock_user

    payload = {
        "first_name": "Sandor",
        "last_name": "Miller",
        "street": "Hauptstr",
        "house_number": "42",
        "zip_code": "10115",
        "city": "Berlin",
        "state": "Berlin",
        "birth_name": "Sandor Born",
        "residence_status": "Citizen",
        "identification_numbers": "ID999",
        "tax_id": "TAX999",
        "marital_status": "Single",
        "monthly_income": 1250.50,
        "has_assets": True,
        "assets_description": "Some valuable items",
        "income_sources": ["Gesetzliche Rente"],
        "assets_types": ["Guthaben/Sparbuch"],
        "has_disability_id": True,
        "has_costly_medical_nutrition": False,
    }
    response = client.post("/profile", json=payload)

    assert response.status_code == 200
    assert response.json()["status"] == "success"

    assert mock_user.first_name == "Sandor"
    assert mock_user.last_name == "Miller"
    assert mock_user.street == "Hauptstr"
    assert mock_user.house_number == "42"
    assert mock_user.zip_code == "10115"
    assert mock_user.city == "Berlin"
    assert mock_user.district == "Mitte"
    assert mock_user.state == "Berlin"
    assert mock_user.birth_name == "Sandor Born"
    assert mock_user.residence_status == "Citizen"
    assert mock_user.identification_numbers == "ID999"
    assert mock_user.tax_id == "TAX999"
    assert mock_user.marital_status == "Single"
    assert mock_user.monthly_income == 1250.50
    assert mock_user.has_assets is True
    assert mock_user.assets_description == "Some valuable items"
    assert mock_user.income_sources == ["Gesetzliche Rente"]
    assert mock_user.assets_types == ["Guthaben/Sparbuch"]
    assert mock_user.has_disability_id is True
    assert mock_user.has_costly_medical_nutrition is False
    mock_db.commit.assert_called_once()


@patch("requests.post")
def test_update_profile_echecker_sync_fields_success(mock_post, mock_db):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"status": "success", "message": "Validation successful"}
    mock_post.return_value = mock_response

    mock_user = DbUser(id=uuid.uuid4(), phone_number="1234567890")
    mock_db.query.return_value.filter.return_value.first.return_value = mock_user

    payload = {
        "is_resident_in_germany": True,
        "has_permanent_reduction_in_earning_capacity": True,
        "ability_to_work": "Permanently disabled",
    }
    response = client.post("/profile", json=payload)

    assert response.status_code == 200
    assert response.json()["status"] == "success"

    assert mock_user.is_resident_in_germany is True
    assert mock_user.has_permanent_reduction_in_earning_capacity is True
    assert mock_user.ability_to_work == "Permanently disabled"
    mock_db.commit.assert_called_once()


@patch("requests.post")
def test_update_profile_health_and_household_fields_success(mock_post, mock_db):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"status": "success", "message": "Validation successful"}
    mock_post.return_value = mock_response

    mock_user = DbUser(id=uuid.uuid4(), phone_number="1234567890")
    mock_db.query.return_value.filter.return_value.first.return_value = mock_user

    payload = {
        "persons_in_household_count": 3,
        "marital_status": "Married",
        "married_since": "2015-05-20",
        "is_care_dependent": True,
        "inpatient_facility_move_in_date": "2024-01-15",
        "inpatient_facility_last_residence": "Some street 12, Berlin",
        "reduced_work_capacity_start_date": "2023-06-01",
        "reduced_work_capacity_end_date": "2024-06-01",
        "reduced_work_capacity_reason": "Injury",
        "has_disability_id": True,
        "disability_valid_until": "2029-12-31",
        "merkzeichen": "G",
    }
    response = client.post("/profile", json=payload)

    assert response.status_code == 200
    assert response.json()["status"] == "success"

    assert mock_user.persons_in_household_count == 3
    assert mock_user.marital_status == "Married"
    assert mock_user.married_since.isoformat() == "2015-05-20"
    assert mock_user.is_care_dependent is True
    assert mock_user.inpatient_facility_move_in_date.isoformat() == "2024-01-15"
    assert mock_user.inpatient_facility_last_residence == "Some street 12, Berlin"
    assert mock_user.reduced_work_capacity_start_date.isoformat() == "2023-06-01"
    assert mock_user.reduced_work_capacity_end_date.isoformat() == "2024-06-01"
    assert mock_user.reduced_work_capacity_reason == "Injury"
    assert mock_user.has_disability_id is True
    assert mock_user.disability_valid_until.isoformat() == "2029-12-31"
    assert mock_user.merkzeichen == "G"
    mock_db.commit.assert_called_once()


@patch("src.routes.user.sync_berlin_district", autospec=True)
@patch("requests.post")
def test_update_profile_skips_district_sync_when_address_unchanged(mock_post, mock_sync, mock_db):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"status": "success", "message": "Validation successful"}
    mock_post.return_value = mock_response

    mock_user = DbUser(
        id=uuid.uuid4(),
        phone_number="1234567890",
        street="Hauptstr",
        house_number="42",
        zip_code="10115",
        city="Berlin",
        district="Mitte",
    )
    mock_db.query.return_value.filter.return_value.first.return_value = mock_user

    response = client.post("/profile", json={"first_name": "Sandor"})

    assert response.status_code == 200
    mock_sync.assert_not_called()
    assert mock_user.district == "Mitte"


@patch("src.routes.user.sync_berlin_district", autospec=True)
@patch("requests.post")
def test_update_profile_syncs_district_when_address_changes(mock_post, mock_sync, mock_db):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"status": "success", "message": "Validation successful"}
    mock_post.return_value = mock_response
    mock_sync.return_value = "Neukölln"

    mock_user = DbUser(
        id=uuid.uuid4(),
        phone_number="1234567890",
        street="Hauptstr",
        house_number="42",
        zip_code="10115",
        city="Berlin",
        district="Mitte",
    )
    mock_db.query.return_value.filter.return_value.first.return_value = mock_user

    response = client.post("/profile", json={"zip_code": "12049"})

    assert response.status_code == 200
    mock_sync.assert_called_once_with(
        db=mock_db,
        street="Hauptstr",
        house_number="42",
        zip_code="12049",
        city="Berlin",
    )
    assert mock_user.district == "Neukölln"


def test_update_profile_negative_income_validation_error(mock_db):
    payload = {"monthly_income": -100.00}
    response = client.post("/profile", json=payload)
    assert response.status_code == 422


@patch("requests.post")
def test_update_profile_validate_entire_form(mock_post, mock_db):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"status": "success", "message": "Validation successful"}
    mock_post.return_value = mock_response

    mock_user = DbUser(id=uuid.uuid4(), phone_number="1234567890")
    mock_db.query.return_value.filter.return_value.first.return_value = mock_user

    payload = {"first_name": "Sandor", "last_name": "Miller", "validate_entire_form": True}
    response = client.post("/profile", json=payload)

    assert response.status_code == 200
    assert response.json()["status"] == "success"

    # Verify rules engine call params had validate_entire_form=True
    assert mock_post.call_count >= 1
    validate_call = next((call for call in mock_post.call_args_list if "/validate-form" in call[0][0]), None)
    assert validate_call is not None, "validate-form endpoint was not called"
    called_args, called_kwargs = validate_call
    assert called_kwargs["params"]["validate_entire_form"] is True

    assert mock_user.first_name == "Sandor"
    assert mock_user.last_name == "Miller"
    mock_db.commit.assert_called_once()


@patch("src.routes.files.run_background_gcs_cleanup")
def test_list_user_files_empty(mock_cleanup, mock_user_service, mock_db):
    # Mock empty result for documents query
    mock_db.query.return_value.outerjoin.return_value.filter.return_value.all.return_value = []
    mock_user_id = str(uuid.uuid4())
    mock_user_service.get_internal_user_id.return_value = mock_user_id

    response = client.get("/files")
    assert response.status_code == 200
    assert response.json() == []
    mock_cleanup.assert_called_once_with(mock_user_id)


@patch("src.routes.files.run_background_gcs_cleanup")
def test_list_user_files_with_data(mock_cleanup, mock_user_service, mock_db):
    user_id = uuid.uuid4()
    app_id = uuid.uuid4()
    file_id = uuid.uuid4()
    mock_user_service.get_internal_user_id.return_value = str(user_id)

    doc = UserDocuments(
        document_id=uuid.uuid4(),
        fk_user_id=user_id,
        fk_application_id=app_id,
        fk_file_id=file_id,
        document_type="id_card",
    )
    uploaded_file = UploadedFiles(id=file_id, name="test.pdf", object_name="unique_test.pdf", bucket_name="test-bucket")

    # Mock chain for: db.query(UserDocuments, UploadedFiles).outerjoin(...).filter(...).all()
    mock_db.query.return_value.outerjoin.return_value.filter.return_value.all.return_value = [(doc, uploaded_file)]

    response = client.get("/files")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["document_type"] == "id_card"
    assert data[0]["object_name"] == "unique_test.pdf"
    mock_cleanup.assert_called_once_with(str(user_id))


@patch("src.routes.files.publish_document_event")
@patch("google.cloud.storage.Client")
def test_upload_file_success(mock_storage_client, mock_publish_event, mock_user_service, mock_db):
    import src.gcs

    src.gcs._gcs_client = None

    # Mock GCS
    mock_bucket = MagicMock()
    mock_blob = MagicMock()
    mock_storage_client.return_value.bucket.return_value = mock_bucket
    mock_bucket.blob.return_value = mock_blob

    # Mock service functions
    user_id = uuid.uuid4()
    app_id = uuid.uuid4()
    mock_user_service.get_internal_user_id.return_value = str(user_id)
    mock_user_service.get_or_create_user_application.return_value = (str(user_id), str(app_id))

    file_content = b"test file content"
    file = io.BytesIO(file_content)

    response = client.post("/upload", files={"file": ("test.png", file, "image/png")})

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "test.png"

    # Verify DB interactions
    assert mock_db.add.call_count == 2  # Once for UploadedFiles, once for UserDocuments
    mock_db.commit.assert_called_once()


@patch("src.routes.llm.acompletion", new_callable=AsyncMock)
def test_stateless_chat_success(mock_completion):
    """
    Verify the stateless chat endpoint parses payloads and returns responses.
    """
    import json

    class MockMessage:
        def __init__(self, content):
            self.content = content

    class MockChoice:
        def __init__(self, content):
            self.message = MockMessage(content)

    class MockResponse:
        def __init__(self, content):
            self.choices = [MockChoice(content)]

    mock_json = json.dumps(
        {"extracted_data": {"permit_type": "Car"}, "next_question": "What date do you want the permit to start?"}
    )
    mock_completion.return_value = MockResponse(mock_json)

    payload = {
        "staged_data": {"first_name": "Jane"},
        "recent_history": [{"role": "user", "content": "I want to register my car."}],
        "target_schema": [{"id": "permit_type", "type": "string", "text": "Permit Type"}],
    }

    response = client.post("/api/v1/stateless/chat", json=payload)

    assert response.status_code == 200
    json_response = response.json()
    assert json_response["extracted_data"]["permit_type"] == "Car"
    assert json_response["next_question"] == "What date do you want the permit to start?"


@patch("httpx.AsyncClient")
@patch("google.cloud.storage.Client")
def test_delete_profile_success(mock_storage_client, mock_async_client, mock_db):
    import src.gcs

    src.gcs._gcs_client = None

    user_id = uuid.uuid4()
    mock_user = DbUser(id=user_id, phone_number="1234567890", authentik_id="auth-123")
    file_id = uuid.uuid4()
    mock_uploaded_file = UploadedFiles(id=file_id, name="test.pdf", object_name="obj.pdf", bucket_name="bucket")

    mock_uploaded_files_query = MagicMock()

    def mock_query(*models):
        primary_model = models[0]
        if primary_model == DbUser:
            mock_q = MagicMock()
            mock_q.filter.return_value.first.return_value = mock_user
            return mock_q
        elif primary_model == UserDocuments:
            mock_q = MagicMock()
            doc = UserDocuments(
                document_id=uuid.uuid4(), fk_user_id=user_id, fk_file_id=file_id, document_type="id_card"
            )
            mock_q.outerjoin.return_value.filter.return_value.all.return_value = [(doc, mock_uploaded_file)]
            return mock_q
        elif primary_model == UploadedFiles:
            return mock_uploaded_files_query
        else:
            mock_q = MagicMock()
            mock_q.filter.return_value.first.return_value = None
            return mock_q

    mock_db.query.side_effect = mock_query

    # Mock GCS
    mock_bucket = MagicMock()
    mock_blob = MagicMock()
    mock_storage_client.return_value.bucket.return_value = mock_bucket
    mock_bucket.blob.return_value = mock_blob
    mock_blob.exists.return_value = True

    # Mock httpx.AsyncClient context manager
    mock_client = AsyncMock()
    mock_response = MagicMock()
    mock_response.status_code = 204
    mock_client.delete.return_value = mock_response
    mock_async_client.return_value.__aenter__.return_value = mock_client

    with patch.dict("os.environ", {"AUTHENTIK_API_TOKEN": "token123", "AUTHENTIK_SERVER_URL": "http://auth-server"}):
        response = client.delete("/profile")

    assert response.status_code == 200
    assert response.json()["status"] == "success"

    # Assert db.delete and commit were called
    mock_db.delete.assert_called_once_with(mock_user)
    mock_uploaded_files_query.filter.return_value.delete.assert_called_once_with(synchronize_session=False)
    mock_db.commit.assert_called_once()

    # Assert Authentik delete called
    mock_client.delete.assert_called_once_with(
        "http://auth-server/api/v3/core/users/auth-123/", headers={"Authorization": "Bearer token123"}, timeout=5.0
    )

    # Assert GCS delete called
    mock_blob.delete.assert_called_once()


@patch("httpx.AsyncClient")
@patch("google.cloud.storage.Client")
def test_delete_profile_no_authentik_token(mock_storage_client, mock_async_client, mock_db):
    import src.gcs

    src.gcs._gcs_client = None

    user_id = uuid.uuid4()
    mock_user = DbUser(id=user_id, phone_number="1234567890", authentik_id="auth-123")
    file_id = uuid.uuid4()
    mock_uploaded_file = UploadedFiles(id=file_id, name="test.pdf", object_name="obj.pdf", bucket_name="bucket")

    mock_uploaded_files_query = MagicMock()

    def mock_query(*models):
        primary_model = models[0]
        if primary_model == DbUser:
            mock_q = MagicMock()
            mock_q.filter.return_value.first.return_value = mock_user
            return mock_q
        elif primary_model == UserDocuments:
            mock_q = MagicMock()
            doc = UserDocuments(
                document_id=uuid.uuid4(), fk_user_id=user_id, fk_file_id=file_id, document_type="id_card"
            )
            mock_q.outerjoin.return_value.filter.return_value.all.return_value = [(doc, mock_uploaded_file)]
            return mock_q
        elif primary_model == UploadedFiles:
            return mock_uploaded_files_query
        else:
            mock_q = MagicMock()
            mock_q.filter.return_value.first.return_value = None
            return mock_q

    mock_db.query.side_effect = mock_query

    # Mock GCS
    mock_bucket = MagicMock()
    mock_blob = MagicMock()
    mock_storage_client.return_value.bucket.return_value = mock_bucket
    mock_bucket.blob.return_value = mock_blob
    mock_blob.exists.return_value = True

    mock_client = AsyncMock()
    mock_async_client.return_value.__aenter__.return_value = mock_client

    with patch.dict("os.environ", {"AUTHENTIK_API_TOKEN": ""}):
        response = client.delete("/profile")

    assert response.status_code == 200
    assert response.json()["status"] == "success"

    # Assert db.delete and commit were called
    mock_db.delete.assert_called_once_with(mock_user)
    mock_uploaded_files_query.filter.return_value.delete.assert_called_once_with(synchronize_session=False)
    mock_db.commit.assert_called_once()

    # Authentik delete should NOT be called
    mock_client.delete.assert_not_called()

    # Assert GCS delete called
    mock_blob.delete.assert_called_once()
