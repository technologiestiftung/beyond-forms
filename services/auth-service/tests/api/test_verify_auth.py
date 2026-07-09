from src.main import app
from beyondforms.auth import get_current_user, User


def test_verify_auth_unauthenticated(client):
    response = client.get("/verify_auth")
    assert response.status_code == 200
    data = response.json()
    assert data["is_authenticated"] is False
    assert data["user"] == "No session"
    assert data["user_name"] == "None"
    assert data["session_id"] == "None"


def test_verify_auth_authenticated(client):
    # Override get_current_user to simulate an authenticated user
    mock_user = User(user_id="test-user-123", user_name="+1234567890", session_id="session-456", is_authenticated=True)
    app.dependency_overrides[get_current_user] = lambda: mock_user

    try:
        response = client.get("/verify_auth")
        assert response.status_code == 200
        data = response.json()
        assert data["is_authenticated"] is True
        assert data["user"] == "test-user-123"
        assert data["user_name"] == "+1234567890"
        assert data["session_id"] == "session-456"
    finally:
        del app.dependency_overrides[get_current_user]
