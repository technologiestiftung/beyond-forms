import copy
import time
import os
import tempfile
import shutil
import uuid
from unittest.mock import MagicMock, AsyncMock, patch

import pytest
import httpx
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from beyondforms.auth import User as AuthUser, get_current_user, require_authenticated_user
from src.main import app
from src.db import get_db
from src.models import Users as DbUser
from src.services.form_service import FormService, get_form_service, ASSET_CACHE_MANAGER


@pytest.fixture
def temp_forms_dir():
    """Create a temporary forms folder for isolated cache testing."""
    temp_dir = tempfile.mkdtemp()
    os.makedirs(os.path.join(temp_dir, "mappings"), exist_ok=True)
    os.makedirs(os.path.join(temp_dir, "pdfs"), exist_ok=True)

    yield temp_dir

    shutil.rmtree(temp_dir)


@pytest.fixture
def mock_db():
    """SQLAlchemy mocked Session fixture."""
    return MagicMock(spec=Session)


@pytest.fixture
def mock_user():
    """Mocked DbUser containing typical Helmut Klar attributes."""
    return DbUser(
        id=uuid.uuid4(),
        authentik_id="test-auth-id-uuid",
        phone_number="1234567890",
        street="Platz der Luftbrücke",
        house_number="4",
        zip_code="12101",
        city="Berlin",
        district="Tempelhof-Schöneberg",
    )


@pytest.fixture(autouse=True)
def override_dependencies(mock_db, temp_forms_dir):
    """Automatically override FastAPI dependencies for our E2E integrations."""

    def override_get_current_user():
        return AuthUser(
            user_id="test-auth-id-uuid",
            user_name="1234567890",
            session_id="test-session-id",
            is_authenticated=True,
        )

    # Override db, auth, and forms service dependencies
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[require_authenticated_user] = override_get_current_user
    app.dependency_overrides[get_form_service] = lambda: FormService(db=mock_db, forms_dir=temp_forms_dir)

    yield

    app.dependency_overrides.clear()


def write_form_assets(temp_dir: str, form_name: str, toml_content: str, pdf_content: bytes):
    """Helper to write temporary form assets (TOML mapping + PDF template)."""
    mapping_path = os.path.join(temp_dir, "mappings", f"{form_name}.toml")
    pdf_path = os.path.join(temp_dir, "pdfs", f"{form_name}.pdf")

    with open(mapping_path, "w", encoding="utf-8") as f:
        f.write(toml_content)

    with open(pdf_path, "wb") as f:
        f.write(pdf_content)


@pytest.mark.asyncio
async def test_e2e_form_export_caching_hit_miss(mock_db, mock_user, temp_forms_dir, monkeypatch):
    """Verifies that the API exports successfully and correctly uses the in-memory cache (HIT vs MISS)."""
    monkeypatch.setenv("ENV", "testing")
    mock_db.query.return_value.filter.return_value.first.return_value = mock_user

    form_name = "mvptest"
    toml_content = """
    street_name = "{{ street }} {{ house_number }}"
    district_name = "{{ district }}"
    """
    pdf_bytes = b"%PDF-1.4 mock template bytes"
    write_form_assets(temp_forms_dir, form_name, toml_content, pdf_bytes)

    # Ensure L1 Cache starts completely clean
    ASSET_CACHE_MANAGER.clear()

    mock_filled_pdf = b"%PDF-1.4 e2e filled output"
    mock_response = httpx.Response(status_code=200, content=mock_filled_pdf)

    client = TestClient(app)

    # Spy on disk loading & mock out final filling service HTTP post call
    with (
        patch.object(
            ASSET_CACHE_MANAGER, "_load_assets_from_disk", wraps=ASSET_CACHE_MANAGER._load_assets_from_disk
        ) as spy_load_disk,
        patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response) as mock_post,
        patch("src.services.form_service.get_google_id_token", return_value=None),
    ):
        # --- First Call: Cache MISS ---
        response1 = client.get(f"/export/{form_name}")
        assert response1.status_code == 200
        assert response1.headers["content-type"] == "application/json"
        data1 = response1.json()
        assert "signed_open_url" in data1
        assert "signed_download_url" in data1

        # Verify it hit the physical disk loader
        spy_load_disk.assert_called_once()
        mock_post.assert_called_once()

        # Reset spied mocks
        spy_load_disk.reset_mock()
        mock_post.reset_mock()

        # --- Second Call: L1 Cache HIT ---
        start_time = time.perf_counter()
        response2 = client.get(f"/export/{form_name}")
        end_time = time.perf_counter()

        assert response2.status_code == 200
        assert response2.headers["content-type"] == "application/json"
        data2 = response2.json()
        assert "signed_open_url" in data2

        # Verify ZERO disk reads were made
        spy_load_disk.assert_not_called()
        # But HTTP post to fill service is still made (to evaluate current user profiles)
        mock_post.assert_called_once()

        # Verify Cache HIT takes minimal microsecond/millisecond range
        hit_ms = (end_time - start_time) * 1000.0
        assert hit_ms < 500.0, f"Cache L1 Hit is too slow: {hit_ms:.2f}ms"


@pytest.mark.asyncio
async def test_e2e_form_export_path_traversal_defense(mock_db, mock_user):
    """Verifies that path traversal payloads are blocked safely without ever hitting the disk loader."""
    mock_db.query.return_value.filter.return_value.first.return_value = mock_user
    client = TestClient(app)

    malicious_payloads = [
        "..%2F..%2F..%2Fetc%2Fpasswd",
        "form;rm",
        "invalid@name",
        "../../etc/passwd",
    ]

    with patch.object(ASSET_CACHE_MANAGER, "_load_assets_from_disk") as spy_load_disk:
        for payload in malicious_payloads:
            response = client.get(f"/export/{payload}")

            # Slashes trigger standard 404 path unresolved, other patterns raise validation errors (500)
            assert response.status_code in (404, 500)
            if response.status_code == 500:
                detail = response.json()["detail"]
                assert "Export failed" in detail
                assert "Invalid form name" in detail or "Access Denied" in detail

            # Assert the disk loader was NEVER called
            spy_load_disk.assert_not_called()


@pytest.mark.asyncio
async def test_e2e_form_export_contamination_protection(mock_db, mock_user, temp_forms_dir, monkeypatch):
    """Verifies that the API exports successfully using high-performance, deep-copied memory mappings protecting against cache contamination."""
    monkeypatch.setenv("ENV", "testing")
    mock_db.query.return_value.filter.return_value.first.return_value = mock_user

    form_name = "nested_nocopy"
    toml_content = """
    [options]
    type = "choice"
    value = { allowed = ["A", "B", "C"] }
    """
    pdf_bytes = b"%PDF-1.4"
    write_form_assets(temp_forms_dir, form_name, toml_content, pdf_bytes)

    ASSET_CACHE_MANAGER.clear()

    captured_payloads = []

    async def mock_post(url, json, **kwargs):
        captured_payloads.append(copy.deepcopy(json))
        return httpx.Response(status_code=200, content=b"%PDF-1.4 output")

    with (
        patch("httpx.AsyncClient.post", side_effect=mock_post),
        patch("src.services.form_service.get_google_id_token", return_value=None),
    ):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            # Fire 2 requests sequentially
            resp1 = await client.get(f"/export/{form_name}")
            resp2 = await client.get(f"/export/{form_name}")

            assert resp1.status_code == 200
            assert resp2.status_code == 200

            # Both requests must export the exact correct values from the static mapping
            assert captured_payloads[0]["field_values"]["options"]["allowed"] == ["A", "B", "C"]
            assert captured_payloads[1]["field_values"]["options"]["allowed"] == ["A", "B", "C"]
