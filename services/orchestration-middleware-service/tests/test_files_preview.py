import uuid
from unittest.mock import MagicMock
import pytest
from fastapi.testclient import TestClient
from google.cloud import exceptions as gcloud_exceptions
import io

from beyondforms.auth import User as AuthUser, get_current_user, require_authenticated_user
from src.db import get_db
from src.main import app
from src.models import UserDocuments as DbDocument, UploadedFiles as DbUploadedFile

from src.services.user_service import UserService, get_user_service

client = TestClient(app)


@pytest.fixture
def mock_db():
    return MagicMock()


@pytest.fixture
def mock_user_service():
    service = MagicMock(spec=UserService)
    service.get_internal_user_id.return_value = uuid.UUID("11111111-1111-1111-1111-111111111111")
    return service


@pytest.fixture(autouse=True)
def override_dependencies(mock_db, mock_user_service):
    def override_get_current_user():
        return AuthUser(
            user_id="test-auth-id",
            user_name="test_user",
            session_id="test-session-id",
            is_authenticated=True,
        )

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_user_service] = lambda: mock_user_service
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[require_authenticated_user] = override_get_current_user
    yield
    app.dependency_overrides.clear()


def test_get_document_file_success_pdf(mock_db):
    doc_id = uuid.uuid4()
    file_id = uuid.uuid4()

    mock_file = MagicMock(spec=DbUploadedFile)
    mock_file.id = file_id
    mock_file.name = "test.pdf"
    mock_file.bucket_name = "test-bucket"
    mock_file.object_name = "obj-pdf"

    mock_doc = MagicMock(spec=DbDocument)
    mock_doc.document_id = doc_id
    mock_doc.fk_user_id = uuid.UUID("11111111-1111-1111-1111-111111111111")
    mock_doc.fk_file = mock_file

    mock_db.query.return_value.filter.return_value.first.return_value = mock_doc

    mock_blob = MagicMock()
    mock_blob.content_type = "application/pdf"
    mock_blob.open.return_value.__enter__.return_value = io.BytesIO(b"pdf-bytes")

    mock_bucket = MagicMock()
    mock_bucket.get_blob.return_value = mock_blob

    mock_storage_client = MagicMock()
    mock_storage_client.bucket.return_value = mock_bucket

    with pytest.MonkeyPatch.context() as m:
        m.setattr("google.cloud.storage.Client", lambda: mock_storage_client)
        resp = client.get(f"/api/v1/documents/{doc_id}/file?disposition=inline")

    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.headers["content-disposition"] == 'inline; filename="test.pdf"'
    assert resp.content == b"pdf-bytes"


def test_get_document_file_success_image(mock_db):
    doc_id = uuid.uuid4()
    file_id = uuid.uuid4()

    mock_file = MagicMock(spec=DbUploadedFile)
    mock_file.id = file_id
    mock_file.name = "image.png"
    mock_file.bucket_name = "test-bucket"
    mock_file.object_name = "obj-png"

    mock_doc = MagicMock(spec=DbDocument)
    mock_doc.document_id = doc_id
    mock_doc.fk_user_id = uuid.UUID("11111111-1111-1111-1111-111111111111")
    mock_doc.fk_file = mock_file

    mock_db.query.return_value.filter.return_value.first.return_value = mock_doc

    mock_blob = MagicMock()
    mock_blob.content_type = "image/png"
    mock_blob.open.return_value.__enter__.return_value = io.BytesIO(b"png-bytes")

    mock_bucket = MagicMock()
    mock_bucket.get_blob.return_value = mock_blob

    mock_storage_client = MagicMock()
    mock_storage_client.bucket.return_value = mock_bucket

    with pytest.MonkeyPatch.context() as m:
        m.setattr("google.cloud.storage.Client", lambda: mock_storage_client)
        resp = client.get(f"/api/v1/documents/{doc_id}/file?disposition=attachment")

    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/png"
    assert resp.headers["content-disposition"] == 'attachment; filename="image.png"'
    assert resp.content == b"png-bytes"


def test_get_document_file_bola_defense(mock_db):
    doc_id = uuid.uuid4()
    # Return None so it behaves exactly like when someone requests an ID they don't own
    mock_db.query.return_value.filter.return_value.first.return_value = None

    resp = client.get(f"/api/v1/documents/{doc_id}/file?disposition=inline")
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


def test_get_document_file_not_found(mock_db):
    doc_id = uuid.uuid4()
    mock_db.query.return_value.filter.return_value.first.return_value = None

    resp = client.get(f"/api/v1/documents/{doc_id}/file")
    assert resp.status_code == 404


def test_get_document_file_no_fk_file(mock_db):
    doc_id = uuid.uuid4()

    mock_doc = MagicMock(spec=DbDocument)
    mock_doc.document_id = doc_id
    mock_doc.fk_user_id = uuid.UUID("11111111-1111-1111-1111-111111111111")
    mock_doc.fk_file = None

    mock_db.query.return_value.filter.return_value.first.return_value = mock_doc

    resp = client.get(f"/api/v1/documents/{doc_id}/file")
    assert resp.status_code == 404
    assert "no physical file" in resp.json()["detail"].lower()


def test_get_document_file_gcs_blob_missing(mock_db):
    doc_id = uuid.uuid4()
    file_id = uuid.uuid4()

    mock_file = MagicMock(spec=DbUploadedFile)
    mock_file.id = file_id
    mock_file.name = "test.pdf"
    mock_file.bucket_name = "test-bucket"
    mock_file.object_name = "obj-pdf"

    mock_doc = MagicMock(spec=DbDocument)
    mock_doc.document_id = doc_id
    mock_doc.fk_user_id = uuid.UUID("11111111-1111-1111-1111-111111111111")
    mock_doc.fk_file = mock_file

    mock_db.query.return_value.filter.return_value.first.return_value = mock_doc

    mock_bucket = MagicMock()
    mock_bucket.get_blob.return_value = None

    mock_storage_client = MagicMock()
    mock_storage_client.bucket.return_value = mock_bucket

    with pytest.MonkeyPatch.context() as m:
        m.setattr("google.cloud.storage.Client", lambda: mock_storage_client)
        resp = client.get(f"/api/v1/documents/{doc_id}/file")

    assert resp.status_code == 404
    assert "file not found in cloud storage" in resp.json()["detail"].lower()


def test_get_document_file_gcs_error(mock_db):
    doc_id = uuid.uuid4()
    file_id = uuid.uuid4()

    mock_file = MagicMock(spec=DbUploadedFile)
    mock_file.id = file_id
    mock_file.name = "test.pdf"
    mock_file.bucket_name = "test-bucket"
    mock_file.object_name = "obj-pdf"

    mock_doc = MagicMock(spec=DbDocument)
    mock_doc.document_id = doc_id
    mock_doc.fk_user_id = uuid.UUID("11111111-1111-1111-1111-111111111111")
    mock_doc.fk_file = mock_file

    mock_db.query.return_value.filter.return_value.first.return_value = mock_doc

    mock_bucket = MagicMock()
    mock_bucket.get_blob.side_effect = gcloud_exceptions.GoogleCloudError("GCS error")

    mock_storage_client = MagicMock()
    mock_storage_client.bucket.return_value = mock_bucket

    with pytest.MonkeyPatch.context() as m:
        m.setattr("google.cloud.storage.Client", lambda: mock_storage_client)
        resp = client.get(f"/api/v1/documents/{doc_id}/file")

    assert resp.status_code == 502
    assert "unavailable" in resp.json()["detail"].lower()
