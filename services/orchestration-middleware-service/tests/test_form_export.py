import uuid
from unittest.mock import MagicMock, AsyncMock, patch
import os

import pytest
from beyondforms.auth import User as AuthUser, get_current_user, require_authenticated_user
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from src.db import get_db
from src.main import app
from src.models import Users as DbUser
from src.services.form_service import FormService

client = TestClient(app)


@pytest.fixture
def mock_db():
    """Fixture to provide a mocked SQLAlchemy session."""
    mock = MagicMock(spec=Session)
    return mock


@pytest.fixture(autouse=True)
def override_dependencies(mock_db):
    """Fixture to override FastAPI dependencies for all tests."""

    def override_get_current_user():
        return AuthUser(
            user_id="test-auth-id-uuid", user_name="1234567890", session_id="test-session-id", is_authenticated=True
        )

    app.state.http_client = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[require_authenticated_user] = override_get_current_user

    yield
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_export_filled_form_success_returns_dual_urls(mock_db, monkeypatch):
    local_user_id = uuid.uuid4()
    auth_sub = "test-auth-id-uuid"

    monkeypatch.setenv("ENV", "testing")

    mock_user = DbUser(id=local_user_id, authentik_id=auth_sub, phone_number="1234567890")
    mock_db.query.return_value.filter.return_value.first.return_value = mock_user

    mock_pdf_content = b"%PDF-1.4 mock content"
    mock_form_service = MagicMock(spec=FormService)
    mock_form_service.fill_form = AsyncMock(return_value=mock_pdf_content)

    from src.services.form_service import get_form_service

    app.dependency_overrides[get_form_service] = lambda: mock_form_service

    try:
        response = client.get("/export/test_form")

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/json"
        data = response.json()
        assert "signed_open_url" in data
        assert "signed_download_url" in data
        assert data["expires_in_seconds"] == 60
        assert data["filename"] == "antrag_test_form.pdf"
        assert data["form_type"] == "test_form"
        assert "disposition=inline" in data["signed_open_url"]
        assert "disposition=attachment" in data["signed_download_url"]

        mock_form_service.fill_form.assert_called_once_with("test_form", mock_user)
    finally:
        del app.dependency_overrides[get_form_service]


@pytest.mark.asyncio
async def test_export_filled_form_gcs_signing_fails_falls_back_to_proxy(mock_db, monkeypatch):
    local_user_id = uuid.uuid4()
    auth_sub = "test-auth-id-uuid"

    monkeypatch.setenv("ENV", "production")
    monkeypatch.setenv("GCS_BUCKET_NAME", "beyondforms-test-bucket")
    monkeypatch.setenv("API_PUBLIC_URL", "http://testserver:8080")

    mock_user = DbUser(id=local_user_id, authentik_id=auth_sub, phone_number="1234567890")
    mock_db.query.return_value.filter.return_value.first.return_value = mock_user

    mock_pdf_content = b"%PDF-1.4 mock content"
    mock_form_service = MagicMock(spec=FormService)
    mock_form_service.fill_form = AsyncMock(return_value=mock_pdf_content)

    from src.services.form_service import get_form_service

    app.dependency_overrides[get_form_service] = lambda: mock_form_service

    mock_storage_client = MagicMock()
    mock_blob = MagicMock()
    mock_storage_client.bucket.return_value.blob.return_value = mock_blob

    mock_blob.upload_from_string.return_value = None
    mock_blob.generate_signed_url.side_effect = AttributeError("you need a private key")

    with (
        patch("src.routes.form_export.storage.Client", return_value=mock_storage_client),
        patch("src.routes.form_export.delayed_scrub_export_blob"),
    ):
        try:
            response = client.get("/export/test_form")

            assert response.status_code == 200
            assert response.headers["content-type"] == "application/json"
            data = response.json()
            assert "signed_open_url" in data
            assert "signed_download_url" in data
            assert "http://testserver:8080/export/proxy/" in data["signed_open_url"]
            assert "disposition=inline" in data["signed_open_url"]
            assert "http://testserver:8080/export/proxy/" in data["signed_download_url"]
            assert "disposition=attachment" in data["signed_download_url"]
        finally:
            app.dependency_overrides.clear()


def test_proxy_local_blob_success(monkeypatch, tmp_path):
    monkeypatch.setenv("ENV", "testing")
    mock_content = b"%PDF-1.4 test proxy content"
    # User ID must exactly match "test-auth-id-uuid" to pass BOLA/IDOR verification
    test_object_name = "exports/ephemeral/test-auth-id-uuid/1234_antrag_wohngeld.pdf"
    local_file_path = os.path.join("/tmp/beyondforms_exports", test_object_name)
    os.makedirs(os.path.dirname(local_file_path), exist_ok=True)

    with open(local_file_path, "wb") as f:
        f.write(mock_content)

    try:
        response = client.get(f"/export/proxy/{test_object_name}?disposition=inline")
        assert response.status_code == 200
        assert response.content == mock_content
        assert response.headers["content-type"] == "application/pdf"
        assert 'inline; filename="antrag_wohngeld.pdf"' in response.headers["content-disposition"]

        response_dl = client.get(f"/export/proxy/{test_object_name}?disposition=attachment")
        assert response_dl.status_code == 200
        assert 'attachment; filename="antrag_wohngeld.pdf"' in response_dl.headers["content-disposition"]
    finally:
        if os.path.exists(local_file_path):
            os.remove(local_file_path)


def test_proxy_bola_idor_rejection(monkeypatch):
    monkeypatch.setenv("ENV", "testing")
    # Requesting another citizen's folder (other-user-id) when logged in as test-auth-id-uuid for a permanent export
    test_object_name = "exports/permanent/other-user-id/1234_antrag_wohngeld.pdf"
    response = client.get(f"/export/proxy/{test_object_name}")
    assert response.status_code == 403
    assert "Access Denied" in response.json()["detail"]


def test_export_filled_form_not_found(mock_db):
    mock_db.query.return_value.filter.return_value.first.return_value = None

    response = client.get("/export/test_form")
    assert response.status_code == 404
    assert response.json()["detail"] == "User profile not found"


@pytest.mark.asyncio
async def test_export_filled_form_error_handling(mock_db):
    local_user_id = uuid.uuid4()
    auth_sub = "test-auth-id-uuid"

    mock_user = DbUser(id=local_user_id, authentik_id=auth_sub)
    mock_db.query.return_value.filter.return_value.first.return_value = mock_user

    mock_form_service = MagicMock(spec=FormService)
    mock_form_service.fill_form = AsyncMock(side_effect=Exception("Filling service unavailable"))

    from src.services.form_service import get_form_service

    app.dependency_overrides[get_form_service] = lambda: mock_form_service

    try:
        response = client.get("/export/test_form")

        assert response.status_code == 500
        assert "Export failed: Filling service unavailable" in response.json()["detail"]
    finally:
        del app.dependency_overrides[get_form_service]


def test_proxy_ephemeral_unauthenticated_success(monkeypatch, tmp_path):
    monkeypatch.setenv("ENV", "testing")
    mock_content = b"%PDF-1.4 ephemeral unauthenticated content"
    valid_uuid = str(uuid.uuid4())
    test_object_name = f"exports/ephemeral/test-user-id/{valid_uuid}_antrag.pdf"
    local_file_path = os.path.join("/tmp/beyondforms_exports", test_object_name)
    os.makedirs(os.path.dirname(local_file_path), exist_ok=True)

    with open(local_file_path, "wb") as f:
        f.write(mock_content)

    def require_auth_unauthorized():
        from fastapi import HTTPException

        raise HTTPException(status_code=401, detail="Missing authentication token")

    try:
        app.dependency_overrides[get_current_user] = lambda: None
        app.dependency_overrides[require_authenticated_user] = require_auth_unauthorized

        response = client.get(f"/export/proxy/{test_object_name}?disposition=inline")
        assert response.status_code == 200
        assert response.content == mock_content
        assert response.headers["content-type"] == "application/pdf"
        assert 'inline; filename="antrag.pdf"' in response.headers["content-disposition"]
    finally:

        def override_get_current_user():
            return AuthUser(
                user_id="test-auth-id-uuid", user_name="1234567890", session_id="test-session-id", is_authenticated=True
            )

        app.dependency_overrides[get_current_user] = override_get_current_user
        app.dependency_overrides[require_authenticated_user] = override_get_current_user
        if os.path.exists(local_file_path):
            os.remove(local_file_path)


def test_proxy_ephemeral_unauthenticated_predictable_filename_rejected(monkeypatch):
    monkeypatch.setenv("ENV", "testing")
    test_object_name = "exports/ephemeral/test-user-id/predictable_antrag.pdf"

    def require_auth_unauthorized():
        from fastapi import HTTPException

        raise HTTPException(status_code=401, detail="Missing authentication token")

    try:
        app.dependency_overrides[get_current_user] = lambda: None
        app.dependency_overrides[require_authenticated_user] = require_auth_unauthorized

        response = client.get(f"/export/proxy/{test_object_name}?disposition=inline")
        assert response.status_code == 401
        assert "Missing authentication token" in response.json()["detail"]
    finally:

        def override_get_current_user():
            return AuthUser(
                user_id="test-auth-id-uuid", user_name="1234567890", session_id="test-session-id", is_authenticated=True
            )

        app.dependency_overrides[get_current_user] = override_get_current_user
        app.dependency_overrides[require_authenticated_user] = override_get_current_user


def test_proxy_ephemeral_unauthenticated_path_traversal_rejected(monkeypatch):
    monkeypatch.setenv("ENV", "testing")
    test_object_name = "exports/ephemeral/test-user-id/../../permanent/other-user/file.pdf"

    def require_auth_unauthorized():
        from fastapi import HTTPException

        raise HTTPException(status_code=401, detail="Missing authentication token")

    try:
        app.dependency_overrides[get_current_user] = lambda: None
        app.dependency_overrides[require_authenticated_user] = require_auth_unauthorized

        response = client.get(f"/export/proxy/{test_object_name}?disposition=inline")
        assert response.status_code in (401, 403, 400)
    finally:

        def override_get_current_user():
            return AuthUser(
                user_id="test-auth-id-uuid", user_name="1234567890", session_id="test-session-id", is_authenticated=True
            )

        app.dependency_overrides[get_current_user] = override_get_current_user
        app.dependency_overrides[require_authenticated_user] = override_get_current_user


@pytest.mark.asyncio
async def test_export_filled_form_gcs_signing_fails_respects_x_forwarded_proto(mock_db, monkeypatch):
    local_user_id = uuid.uuid4()
    auth_sub = "test-auth-id-uuid"

    monkeypatch.setenv("ENV", "production")
    monkeypatch.setenv("GCS_BUCKET_NAME", "beyondforms-test-bucket")
    # API_PUBLIC_URL is intentionally NOT set here to force fallback path base_url resolution

    mock_user = DbUser(id=local_user_id, authentik_id=auth_sub, phone_number="1234567890")
    mock_db.query.return_value.filter.return_value.first.return_value = mock_user

    mock_pdf_content = b"%PDF-1.4 mock content"
    mock_form_service = MagicMock(spec=FormService)
    mock_form_service.fill_form = AsyncMock(return_value=mock_pdf_content)

    from src.services.form_service import get_form_service

    app.dependency_overrides[get_form_service] = lambda: mock_form_service

    mock_storage_client = MagicMock()
    mock_blob = MagicMock()
    mock_storage_client.bucket.return_value.blob.return_value = mock_blob

    mock_blob.upload_from_string.return_value = None
    mock_blob.generate_signed_url.side_effect = AttributeError("you need a private key")

    with (
        patch("src.routes.form_export.storage.Client", return_value=mock_storage_client),
        patch("src.routes.form_export.delayed_scrub_export_blob"),
    ):
        try:
            # We send the request with x-forwarded-proto: https
            headers = {"x-forwarded-proto": "https"}
            response = client.get("/export/test_form", headers=headers)

            assert response.status_code == 200
            data = response.json()
            assert "signed_open_url" in data
            assert "signed_download_url" in data
            # Even though FastAPI's request.base_url is http://testserver/ (default),
            # the generated fallback URL should be converted to https://
            assert data["signed_open_url"].startswith("https://testserver")
            assert data["signed_download_url"].startswith("https://testserver")
        finally:
            app.dependency_overrides.clear()
