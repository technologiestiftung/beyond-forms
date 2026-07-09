from unittest.mock import MagicMock, patch


@patch("src.api.login_finish.exchange_session_for_oidc_token")
@patch("src.api.login_finish.requests.Session")
def test_login_finish_established_user(mock_session_class, mock_exchange, client):
    # Mock token exchange
    mock_exchange.return_value = "new_session_token"

    # Mock requests.Session
    mock_session = MagicMock()
    mock_session_class.return_value = mock_session

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"component": "xak-flow-redirect"}
    mock_session.post.return_value = mock_response

    payload = {"code": "123456"}

    client.cookies.set("authentik_session", "old_session")
    client.cookies.set("beyondforms_auth_flow", "login")
    response = client.post("/login/finish", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["is_new_user"] is False
    assert response.cookies.get("authentik_session") == "new_session_token"
    # Cookie should be deleted (Max-Age=0)
    assert "beyondforms_auth_flow" not in response.cookies or response.cookies.get("beyondforms_auth_flow") == ""


@patch("src.api.login_finish.get_or_create_user")
@patch("src.api.login_finish.get_db_pool")
@patch("src.api.login_finish.get_current_user")
@patch("src.api.login_finish.exchange_session_for_oidc_token")
@patch("src.api.login_finish.requests.Session")
def test_login_finish_with_headers(
    mock_session_class, mock_exchange, mock_get_user, mock_get_db, mock_create_user, client
):
    # Mock token exchange
    mock_exchange.return_value = "new_session_token"
    mock_get_user.return_value = MagicMock(user_id="test-user", user_name="test")
    mock_get_db.return_value = MagicMock()
    mock_create_user.return_value = "db-user-id"

    # Mock requests.Session
    mock_session = MagicMock()
    mock_session_class.return_value = mock_session

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"component": "xak-flow-redirect"}
    mock_session.post.return_value = mock_response

    payload = {"code": "123456"}

    headers = {
        "Authorization": "Bearer old_session",
        "X-BeyondForms-Auth-Flow": "login",
    }
    response = client.post("/login/finish", json=payload, headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["token"] == "new_session_token"
    # Authentik session should be set in cookie for browser compatibility even if header was used.
    assert response.cookies.get("authentik_session") == "new_session_token"

    mock_create_user.assert_called_once_with(mock_get_db.return_value, "test", "test-user")


@patch("src.api.login_finish.exchange_session_for_oidc_token")
@patch("src.api.login_finish.requests.Session")
def test_login_finish_new_user(mock_session_class, mock_exchange, client):
    mock_exchange.return_value = "new_user_token"
    mock_session = MagicMock()
    mock_session_class.return_value = mock_session

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"component": "xak-flow-redirect"}
    mock_session.post.return_value = mock_response

    mock_session.cookies.__iter__.return_value = []

    payload = {"code": "123456"}

    client.cookies.set("authentik_session", "old_session")
    client.cookies.set("beyondforms_auth_flow", "enrollment")
    response = client.post("/login/finish", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["is_new_user"] is True


def test_login_finish_no_session(client):
    payload = {"code": "123456"}
    response = client.post("/login/finish", json=payload)
    assert response.status_code == 401
    assert "without session" in response.json()["detail"]


@patch("src.api.login_finish.requests.Session")
def test_login_finish_error(mock_session_class, client):
    mock_session = MagicMock()
    mock_session_class.return_value = mock_session

    mock_response = MagicMock()
    mock_response.status_code = 400
    mock_response.text = "Invalid Code"
    mock_session.post.return_value = mock_response

    payload = {"code": "123456"}
    client.cookies.set("authentik_session", "old_session")
    response = client.post("/login/finish", json=payload)
    assert response.status_code == 400
    assert "provider error" in response.json()["detail"]
