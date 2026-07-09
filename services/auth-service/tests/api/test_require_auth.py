from src.main import app
from beyondforms.auth import require_authenticated_user, User


def test_require_auth_fails(client):
    # No override, default unauthenticated
    response = client.get("/require_auth")
    assert response.status_code == 401
    assert response.json()["detail"] == "Missing authentication token"


def test_require_auth_succeeds(client):
    mock_user = User(user_id="test-user-123", user_name="testuser", session_id="session-456", is_authenticated=True)
    app.dependency_overrides[require_authenticated_user] = lambda: mock_user

    try:
        response = client.get("/require_auth")
        assert response.status_code == 200
        data = response.json()
        assert data["user"] == "test-user-123"
        assert data["message"] == "Endpoint requiring authentication"
    finally:
        del app.dependency_overrides[require_authenticated_user]
