from unittest.mock import MagicMock, patch


@patch("src.api.login_start.requests.Session")
def test_login_start_established_user(mock_session_class, client):
    # Mock requests.Session
    mock_session = MagicMock()
    mock_session_class.return_value = mock_session

    # Identification response - Success
    mock_id_response = MagicMock()
    mock_id_response.status_code = 200
    mock_id_response.json.return_value = {"component": "ak-stage-identification"}

    # SMS response - Success
    mock_sms_response = MagicMock()
    mock_sms_response.status_code = 200
    mock_sms_response.json.return_value = {"component": "ak-stage-authenticator-sms"}

    mock_session.post.side_effect = [mock_id_response, mock_sms_response]
    mock_session.cookies.items.return_value = [("authentik_session", "fake_session_id")]
    mock_session.cookies.get.return_value = "fake_session_id"

    payload = {"phone_number": "+1234567890"}
    response = client.post("/login/start", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "SMS flow started"
    assert data["new_user"] is False
    assert data["token"] == "fake_session_id"
    assert data["flow"] == "login"
    assert response.cookies.get("authentik_session") == "fake_session_id"
    assert response.cookies.get("beyondforms_auth_flow") == "login"


@patch("src.api.login_start.requests.Session")
def test_login_start_new_user_enrollment(mock_session_class, client):
    # Mock requests.Session
    mock_session = MagicMock()
    mock_session_class.return_value = mock_session

    # 1. Identification returns access-denied
    mock_id_response = MagicMock()
    mock_id_response.status_code = 200
    mock_id_response.json.return_value = {"component": "ak-stage-access-denied"}

    # 2. Enrollment Init
    mock_init_response = MagicMock()
    mock_init_response.status_code = 200
    mock_init_response.text = "OK"

    # 3. Enrollment Solve Prompt
    mock_enroll_response = MagicMock()
    mock_enroll_response.status_code = 200
    mock_enroll_response.json.return_value = {"component": "ak-stage-authenticator-sms"}

    # 4. Enrollment Send SMS
    mock_sms_response = MagicMock()
    mock_sms_response.status_code = 200
    mock_sms_response.json.return_value = {"component": "ak-stage-authenticator-sms"}

    mock_session.post.side_effect = [mock_id_response, mock_enroll_response, mock_sms_response]
    mock_session.get.return_value = mock_init_response
    mock_session.cookies.items.return_value = [("authentik_session", "enroll_session_id")]
    mock_session.cookies.get.return_value = "enroll_session_id"

    payload = {"phone_number": "+1234567890"}
    response = client.post("/login/start", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "SMS flow started"
    assert data["new_user"] is True
    assert data["token"] == "enroll_session_id"
    assert data["flow"] == "enrollment"
    assert response.cookies.get("authentik_session") == "enroll_session_id"
    assert response.cookies.get("beyondforms_auth_flow") == "enrollment"


@patch("src.api.login_start.requests.Session")
def test_login_start_error(mock_session_class, client):
    mock_session = MagicMock()
    mock_session_class.return_value = mock_session

    mock_id_response = MagicMock()
    mock_id_response.status_code = 400
    mock_session.post.return_value = mock_id_response

    payload = {"phone_number": "+1234567890"}
    response = client.post("/login/start", json=payload)
    assert response.status_code == 400
    assert "Failed to start login flow" in response.json()["detail"]
