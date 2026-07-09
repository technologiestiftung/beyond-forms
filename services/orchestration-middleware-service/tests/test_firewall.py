import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import requests
from src.main import app
from src.db import get_db
from beyondforms.auth import User as AuthUser, get_current_user, require_authenticated_user
from src.services.user_service import UserService, get_user_service

client = TestClient(app)


@pytest.fixture(autouse=True)
def override_dependencies():
    def override_get_current_user():
        return AuthUser(user_id="test-id", user_name="12345678", session_id="sid", is_authenticated=True)

    mock_db = MagicMock()
    mock_user_service = MagicMock(spec=UserService)
    mock_user_service.get_internal_user_id.return_value = "internal-uuid"

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[require_authenticated_user] = override_get_current_user
    app.dependency_overrides[get_user_service] = lambda: mock_user_service
    yield
    app.dependency_overrides.clear()


@patch("requests.post")
def test_update_profile_firewall_401(mock_post):
    """
    Test that a 401 from rules engine is mapped to 502.
    """
    mock_response = MagicMock()
    mock_response.status_code = 401
    mock_post.return_value = mock_response

    payload = {"first_name": "Sandor", "last_name": "Test"}

    response = client.post("/profile", json=payload)

    assert response.status_code == 502
    assert response.json()["detail"] == "Upstream service authentication failure."


@patch("requests.post")
def test_update_profile_firewall_403(mock_post):
    """
    Test that a 403 from rules engine is mapped to 502.
    """
    mock_response = MagicMock()
    mock_response.status_code = 403
    mock_post.return_value = mock_response

    payload = {"first_name": "Sandor"}

    response = client.post("/profile", json=payload)

    assert response.status_code == 502
    assert response.json()["detail"] == "Upstream service authentication failure."


@patch("requests.post")
def test_update_profile_firewall_500(mock_post):
    """
    Test that a 500 from rules engine is mapped to 502.
    """
    mock_response = MagicMock()
    mock_response.status_code = 500
    # response.raise_for_status will be called
    mock_response.raise_for_status.side_effect = requests.exceptions.HTTPError(
        "Downstream exploded", response=mock_response
    )
    mock_post.return_value = mock_response

    response = client.post("/profile", json={"first_name": "S"})

    assert response.status_code == 502
    assert response.json()["detail"] == "Upstream service returned an error."


@patch("requests.post")
def test_update_profile_firewall_timeout(mock_post):
    """
    Test that a timeout from rules engine is mapped to 504.
    """
    mock_post.side_effect = requests.exceptions.Timeout("Connection timed out")

    response = client.post("/profile", json={"first_name": "S"})

    assert response.status_code == 504
    assert "Gateway Timeout" in response.json()["detail"]


@patch("requests.post")
def test_update_profile_validation_error_422(mock_post):
    """
    Test that a 422 validation failure from rules engine is handled and returned.
    """
    mock_response = MagicMock()
    mock_response.status_code = 422
    mock_response.json.return_value = {
        "status": "error",
        "code": 422,
        "detail": "Validation failed.",
        "validation_errors": [
            {"field_path": "applicant_identity -> first_name", "message": "Field required", "type": "missing"}
        ],
    }
    mock_post.return_value = mock_response

    response = client.post("/profile", json={"first_name": "Sandor"})

    assert response.status_code == 200
    resp_data = response.json()
    assert resp_data["status"] == "success"
    assert resp_data["validation_status"] == "draft"
    assert len(resp_data["rules_warnings"]) > 0
