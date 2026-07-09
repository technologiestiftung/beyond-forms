import io
import uuid
import pytest
import google.auth.exceptions
from unittest.mock import MagicMock, patch, Mock, call
from beyondforms.auth import User as AuthUser, get_current_user, require_authenticated_user
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from src.db import get_db
from src.main import app
from src.models import UploadedFiles, UserDocuments, Users as DbUser

from src.routes.files import get_storage_client
from src.services.user_service import UserService, get_user_service

client = TestClient(app)


@pytest.fixture
def mock_db():
    mock = MagicMock(spec=Session)
    return mock


@pytest.fixture
def mock_user_service():
    mock = MagicMock(spec=UserService)
    mock.get_internal_user_id.return_value = str(uuid.uuid4())
    mock.get_or_create_user_application.return_value = (str(uuid.uuid4()), str(uuid.uuid4()))
    return mock


@pytest.fixture
def mock_storage_client():
    mock = MagicMock()
    return mock


@pytest.fixture(autouse=True)
def override_dependencies(mock_db, mock_user_service, mock_storage_client):
    def override_get_current_user():
        return AuthUser(
            user_id="test-auth-id", user_name="1234567890", session_id="test-session-id", is_authenticated=True
        )

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[require_authenticated_user] = override_get_current_user
    app.dependency_overrides[get_user_service] = lambda: mock_user_service
    app.dependency_overrides[get_storage_client] = lambda: mock_storage_client
    yield
    app.dependency_overrides.clear()


def test_delete_document_transaction_safety_call_order(mock_storage_client, mock_db):
    """
    Verify DELETE /api/v1/documents/{document_id} deletes from GCS first
    before committing DB deletion to satisfy GDPR compliance safely.
    """
    document_id = uuid.uuid4()
    file_id = uuid.uuid4()

    mock_file = UploadedFiles(id=file_id, bucket_name="test-bucket", object_name="test-object")
    mock_doc = UserDocuments(document_id=document_id, fk_file_id=file_id, fk_file=mock_file)

    mock_db.query.return_value.filter.return_value.first.return_value = mock_doc

    mock_blob = MagicMock()
    mock_blob.exists.return_value = True
    mock_storage_client.bucket.return_value.blob.return_value = mock_blob

    # Track sequence of calls using a mock manager
    manager = MagicMock()
    manager.attach_mock(mock_db.commit, "db_commit")
    manager.attach_mock(mock_blob.delete, "gcs_delete")

    response = client.delete(f"/api/v1/documents/{document_id}")
    assert response.status_code == 200

    # Assert correct call order (GCS delete first, then DB commit)
    expected_calls = [
        call.gcs_delete(),
        call.db_commit(),
    ]
    assert manager.mock_calls == expected_calls


def test_delete_document_gcs_failure_aborts_db_deletion(mock_storage_client, mock_db):
    """
    Verify that if GCS physical erasure fails, the DB delete transaction
    is aborted (rolled back) to guarantee data state safety.
    """
    document_id = uuid.uuid4()
    file_id = uuid.uuid4()

    mock_file = UploadedFiles(id=file_id, bucket_name="test-bucket", object_name="test-object")
    mock_doc = UserDocuments(document_id=document_id, fk_file_id=file_id, fk_file=mock_file)

    mock_db.query.return_value.filter.return_value.first.return_value = mock_doc

    # Mock GCS delete error
    mock_blob = MagicMock()
    mock_blob.exists.return_value = True
    mock_blob.delete.side_effect = Exception("GCS delete error")
    mock_storage_client.bucket.return_value.blob.return_value = mock_blob

    response = client.delete(f"/api/v1/documents/{document_id}")
    assert response.status_code == 500

    # Verify no DB deletes were committed
    mock_db.delete.assert_not_called()
    mock_db.commit.assert_not_called()


@patch("src.routes.files.publish_document_event")
@patch("google.cloud.storage.Client")
def test_upload_file_db_failure_deletes_gcs_blob(mock_storage_client, mock_publish, mock_user_service, mock_db):
    """
    Verify that if GCS upload succeeds but the subsequent DB insertions fail,
    the uploaded GCS blob is cleaned up/deleted from GCS.
    """
    mock_blob = MagicMock()
    mock_storage_client.return_value.bucket.return_value.blob.return_value = mock_blob
    app.dependency_overrides[get_storage_client] = lambda: mock_storage_client.return_value

    # Mock DB insert failure (e.g. raises exception on commit)
    mock_db.commit.side_effect = Exception("DB commit failed")

    file_content = b"pdf content"
    file = io.BytesIO(file_content)

    response = client.post("/upload", files={"file": ("test.pdf", file, "application/pdf")})
    assert response.status_code == 500

    # Ensure blob delete was called to clean up
    mock_blob.delete.assert_called_once()


@patch("requests.post")
def test_verify_document_defers_mutations_until_validated(mock_post, mock_db):
    """
    Verify that verify_document does not commit or perform DB mutations (like updating User profile)
    until AFTER the rules engine validation request successfully returns.
    """
    document_id = uuid.uuid4()
    mock_user = DbUser(id=uuid.uuid4(), first_name="OldName")
    mock_doc = UserDocuments(document_id=document_id, raw_data={"first_name": "NewName"}, fk_user_id=mock_user.id)

    # Mock DB query
    def db_query_side_effect(model):
        query_mock = MagicMock()
        if model is UserDocuments:
            query_mock.filter.return_value.first.return_value = mock_doc
        elif model is DbUser:
            query_mock.filter.return_value.first.return_value = mock_user
        return query_mock

    mock_db.query.side_effect = db_query_side_effect

    # We track rules engine post call, user first_name updates, and db commits
    events = []

    def mock_post_side_effect(url, *args, **kwargs):
        events.append("rules_engine_called")
        assert mock_user.first_name == "OldName", "User name mutated before rules engine validation!"

        resp = Mock()
        resp.status_code = 200
        resp.json.return_value = {
            "status": "success",
            "validated_fields": {"given_names": "NewName"},
            "profile_sync": {"first_name": "NewName"},
        }
        resp.raise_for_status = Mock()
        return resp

    mock_post.side_effect = mock_post_side_effect

    # Set user.first_name to property setter spy
    original_setattr = DbUser.__setattr__

    def spy_setattr(self, name, value):
        if name == "first_name":
            events.append("user_mutated")
        original_setattr(self, name, value)

    with patch.object(DbUser, "__setattr__", spy_setattr):
        payload = {
            "corrected_data": {"first_name": "NewName"},
            "verified_fields": ["first_name"],
        }
        response = client.post(f"/api/v1/documents/{document_id}/verify", json=payload)
        assert response.status_code == 200

    # Check order: rules engine validation request, then mutation
    assert events == ["rules_engine_called", "user_mutated"]


@patch("src.routes.files.publish_document_event")
@patch("google.cloud.storage.Client")
def test_upload_file_pubsub_deferred_after_commit(mock_storage_client, mock_publish, mock_user_service, mock_db):
    """
    Verify upload_file commits DB transaction BEFORE executing the Pub/Sub event publish.
    """
    mock_blob = MagicMock()
    mock_storage_client.return_value.bucket.return_value.blob.return_value = mock_blob
    app.dependency_overrides[get_storage_client] = lambda: mock_storage_client.return_value

    # Track sequence using manager mock
    manager = MagicMock()
    manager.attach_mock(mock_db.commit, "db_commit")
    manager.attach_mock(mock_publish, "publish")

    file_content = b"pdf content"
    file = io.BytesIO(file_content)

    response = client.post("/upload", files={"file": ("test.pdf", file, "application/pdf")})
    assert response.status_code == 200

    # Assert correct order
    expected_calls = [
        call.db_commit(),
        call.publish(
            uuid.UUID(response.json()["document_id"]),
            f"gs://beyondforms-dev-bucket/{mock_storage_client.return_value.bucket.return_value.blob.call_args[0][0]}",
        ),
    ]

    assert manager.mock_calls[0] == expected_calls[0]
    assert manager.mock_calls[1] == expected_calls[1]


def test_lazy_storage_client_caching():
    """
    Verify LazyStorageClient caches the storage.Client instance across multiple accesses,
    does not return None on subsequent calls, and correctly delegates attribute/method lookups.
    """
    with patch("google.cloud.storage.Client") as mock_gcs:
        mock_gcs.return_value = MagicMock()
        lazy_client = get_storage_client()

        # First access
        client1 = lazy_client.client
        assert client1 is not None
        mock_gcs.assert_called_once()

        # Second access
        client2 = lazy_client.client
        assert client2 is not None
        assert client1 is client2
        mock_gcs.assert_called_once()

        # Method delegation
        bucket = lazy_client.bucket("my-bucket")
        assert bucket is not None


def test_lazy_storage_client_default_credentials_error():
    """
    Verify LazyStorageClient successfully falls back to MagicMock when DefaultCredentialsError is raised.
    """
    with patch("google.cloud.storage.Client", side_effect=google.auth.exceptions.DefaultCredentialsError):
        lazy_client = get_storage_client()
        client1 = lazy_client.client
        assert client1 is not None
        assert isinstance(client1, MagicMock)


def test_upload_file_no_extension(mock_storage_client, mock_db):
    """
    Verify upload_file successfully rejects files without an extension with 400 Bad Request
    rather than throwing an unhandled python runtime exception.
    """
    file_content = b"content"
    file = io.BytesIO(file_content)

    response = client.post("/upload", files={"file": ("my_id_card", file, "application/octet-stream")})
    assert response.status_code == 400
    assert "Invalid file type" in response.json()["detail"]
