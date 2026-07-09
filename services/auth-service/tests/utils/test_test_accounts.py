from unittest.mock import MagicMock, patch
from src.utils.test_accounts import is_test_account, AuthFlow, AUTH_FLOW_COOKIE_NAME


def test_is_test_account():
    # Berlin drama numbers
    assert is_test_account("03023125000") is True
    assert is_test_account("+493023125999") is True

    # Frankfurt
    assert is_test_account("06990009123") is True

    # Hamburg
    assert is_test_account("04066969000") is True

    # Köln
    assert is_test_account("02214710123") is True

    # München
    assert is_test_account("08999998000") is True

    # Non-test numbers
    assert is_test_account("+1234567890") is False
    assert is_test_account("0301234567") is False
    assert is_test_account("+491701234567") is False


@patch("src.utils.test_accounts.requests.Session")
def test_login_start_test_account_exists(mock_session_class, client):
    # Mock requests.Session
    mock_session = MagicMock()
    mock_session_class.return_value = mock_session

    # Existence check response - Success (already exists)
    mock_exist_response = MagicMock()
    mock_exist_response.status_code = 200
    mock_exist_response.json.return_value = {"component": "ak-stage-identification"}

    # Identification in password flow - Success
    mock_id_response = MagicMock()
    mock_id_response.status_code = 200
    mock_id_response.json.return_value = {"component": "ak-stage-password"}

    mock_session.post.side_effect = [mock_exist_response, mock_id_response]
    mock_session.cookies.items.return_value = [("authentik_session", "test_session_id")]

    payload = {"phone_number": "+493023125001"}  # Using a drama number
    response = client.post("/login/start", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Test Account flow started"
    assert data["new_user"] is False
    assert response.cookies.get("authentik_session") == "test_session_id"
    assert response.cookies.get(AUTH_FLOW_COOKIE_NAME) == AuthFlow.TEST_LOGIN.value


@patch("src.utils.test_accounts.requests.Session")
def test_login_start_test_account_not_found_enrolls(mock_session_class, client):
    # Mock requests.Session
    mock_session = MagicMock()
    mock_session_class.return_value = mock_session

    # Existence check response - Not found
    mock_exist_response = MagicMock()
    mock_exist_response.status_code = 200
    mock_exist_response.json.return_value = {
        "component": "ak-stage-identification",
        "response_errors": {"non_field_errors": [{"code": "invalid", "string": "Failed to authenticate."}]},
    }

    # Enrollment Init, Enrollment Prompt, Password identification
    mock_enroll_init = MagicMock(status_code=200)
    mock_enroll_prompt = MagicMock(status_code=200)
    mock_pw_id = MagicMock(status_code=200)

    mock_session.get.return_value = mock_enroll_init
    mock_session.post.side_effect = [mock_exist_response, mock_enroll_prompt, mock_pw_id]
    mock_session.cookies.items.return_value = [("authentik_session", "enroll_session_id")]

    payload = {"phone_number": "+493023125002"}
    response = client.post("/login/start", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Test Account flow started"
    assert data["new_user"] is True
    assert response.cookies.get(AUTH_FLOW_COOKIE_NAME) == AuthFlow.TEST_ENROLLMENT.value


@patch("src.utils.test_accounts.get_or_create_user")
@patch("src.utils.test_accounts.get_db_pool")
@patch("src.utils.test_accounts.get_current_user")
@patch("src.utils.test_accounts.exchange_session_for_oidc_token")
@patch("src.utils.test_accounts.requests.Session")
def test_login_finish_test_account(
    mock_session_class, mock_exchange, mock_get_user, mock_get_db, mock_create_user, client
):
    # Mock token exchange
    mock_exchange.return_value = "auth_session_token"
    mock_get_user.return_value = MagicMock(user_id="test-user", user_name="test")
    mock_get_db.return_value = MagicMock()

    # Mock requests.Session
    mock_session = MagicMock()
    mock_session_class.return_value = mock_session

    # Password response - Success
    mock_pw_response = MagicMock()
    mock_pw_response.status_code = 200
    mock_pw_response.json.return_value = {"component": "xak-flow-redirect"}

    mock_session.post.return_value = mock_pw_response

    payload = {"code": "ANY_CODE"}
    client.cookies.set(AUTH_FLOW_COOKIE_NAME, AuthFlow.TEST_LOGIN.value)
    client.cookies.set("authentik_session", "identified_session_id")

    response = client.post("/login/finish", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["is_new_user"] is False
    assert response.cookies.get("authentik_session") == "auth_session_token"
    # Verify cookie is deleted
    assert response.cookies.get(AUTH_FLOW_COOKIE_NAME) is None or response.cookies.get(AUTH_FLOW_COOKIE_NAME) == ""

    mock_create_user.assert_called_once_with(mock_get_db.return_value, "test", "test-user")


@patch("src.utils.test_accounts.get_or_create_user")
@patch("src.utils.test_accounts.get_db_pool")
@patch("src.utils.test_accounts.get_current_user")
@patch("src.utils.test_accounts.exchange_session_for_oidc_token")
@patch("src.utils.test_accounts.requests.Session")
def test_enrollment_finish_test_account(
    mock_session_class, mock_exchange, mock_get_user, mock_get_db, mock_create_user, client
):
    mock_exchange.return_value = "auth_session_token"
    mock_get_user.return_value = MagicMock(user_id="test-user", user_name="test")
    mock_get_db.return_value = MagicMock()

    mock_session = MagicMock()
    mock_session_class.return_value = mock_session

    mock_pw_response = MagicMock()
    mock_pw_response.status_code = 200
    mock_pw_response.json.return_value = {"component": "xak-flow-redirect"}

    mock_session.post.return_value = mock_pw_response

    payload = {"code": "ANY_CODE"}
    client.cookies.set(AUTH_FLOW_COOKIE_NAME, AuthFlow.TEST_ENROLLMENT.value)
    client.cookies.set("authentik_session", "identified_session_id")

    response = client.post("/login/finish", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["is_new_user"] is True
    assert response.cookies.get("authentik_session") == "auth_session_token"

    mock_create_user.assert_called_once_with(mock_get_db.return_value, "test", "test-user")


@patch("src.api.login_start.IS_PRODUCTION", True)
@patch("src.api.login_start.PROD_TEST_BYPASS_KEY", "secret_bypass_key")
@patch("src.utils.test_accounts.requests.Session")
def test_login_start_test_account_in_production_with_valid_key(mock_session_class, client):
    mock_session = MagicMock()
    mock_session_class.return_value = mock_session
    mock_exist_response = MagicMock(status_code=200)
    mock_exist_response.json.return_value = {"component": "ak-stage-identification"}
    mock_id_response = MagicMock(status_code=200)
    mock_id_response.json.return_value = {"component": "ak-stage-password"}
    mock_session.post.side_effect = [mock_exist_response, mock_id_response]
    mock_session.cookies.items.return_value = [("authentik_session", "test_session_id")]

    payload = {"phone_number": "+493023125001"}
    headers = {"X-BeyondForms-Prod-Test-Key": "secret_bypass_key"}
    response = client.post("/login/start", json=payload, headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Test Account flow started"
    assert response.cookies.get(AUTH_FLOW_COOKIE_NAME) == AuthFlow.TEST_LOGIN.value


@patch("src.api.login_start.IS_PRODUCTION", True)
@patch("src.api.login_start.PROD_TEST_BYPASS_KEY", "secret_bypass_key")
@patch("src.api.login_start.requests.Session")
def test_login_start_test_account_in_production_without_key_falls_back(mock_session_class, client):
    payload = {"phone_number": "+493023125001"}
    response = client.post("/login/start", json=payload)

    assert response.status_code == 403
    assert "Invalid test account bypass key." in response.json()["detail"]


@patch("src.api.login_start.IS_PRODUCTION", True)
@patch("src.api.login_start.PROD_TEST_BYPASS_KEY", "secret_bypass_key")
@patch("src.api.login_start.requests.Session")
def test_login_start_test_account_in_production_with_invalid_key_falls_back(mock_session_class, client):
    payload = {"phone_number": "+493023125001"}
    headers = {"X-BeyondForms-Prod-Test-Key": "wrong_bypass_key"}
    response = client.post("/login/start", json=payload, headers=headers)

    assert response.status_code == 403
    assert "Invalid test account bypass key." in response.json()["detail"]
