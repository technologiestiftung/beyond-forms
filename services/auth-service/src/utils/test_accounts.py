import logging
import requests
from fastapi import HTTPException, Response
from src.utils.config import (
    LOGIN_FLOW_URL,
    TEST_ENROLLMENT_FLOW_URL,
    TEST_PASSWORD_AUTH_FLOW_URL,
    TEST_ACCOUNT_PASSWORD,
)
from beyondforms.auth import get_current_user
from src.utils.auth_flows import AuthFlow, AUTH_FLOW_COOKIE_NAME
from src.utils.db import get_db_pool
from src.services.user_service import get_or_create_user
from src.utils.token_exchange import exchange_session_for_oidc_token

logger = logging.getLogger(__name__)

# Bundesnetzagentur defines ranges of "Drama Numbers", which are phone numbers allowed
# to be used in media productions, which will never be connected to real phones.
# These numbers are used as test accounts.
# https://www.bundesnetzagentur.de/DE/Fachthemen/Telekommunikation/Nummerierung/_DL/mittlg148_2021.pdf
_DRAMA_NUMBER_PREFIXES = (
    # Berlin
    "03023125",
    "+493023125",
    # Frankfurt
    "06990009",
    "+496990009",
    # Hamburg
    "04066969",
    "+494066969",
    # Köln
    "02214710",
    "+492214710",
    # München
    "08999998",
    "+498999998",
)


def is_test_account(phone_number: str) -> bool:
    """Checks if a phone number belongs to a test account."""
    return any(phone_number.startswith(prefix) for prefix in _DRAMA_NUMBER_PREFIXES)


async def _start_test_enrollment(phone_number: str, response: Response):
    """Initiates the enrollment flow for a new test account."""
    logger.info(f"Initiating test enrollment for {phone_number}")
    session = requests.Session()
    # session.get(TEST_ENROLLMENT_FLOW_URL, params={"query": ""})

    prompt_response = session.post(
        TEST_ENROLLMENT_FLOW_URL,
        json={"component": "ak-stage-prompt", "username": phone_number},
        params={"query": ""},
    )
    logger.debug(f"Authentik test enrollment response: {prompt_response.status_code} - {prompt_response.text}")
    response.set_cookie(
        key=AUTH_FLOW_COOKIE_NAME, value=AuthFlow.TEST_ENROLLMENT.value, httponly=True, secure=True, samesite="lax"
    )

    if prompt_response.status_code >= 400:
        logger.error(f"Test enrollment start failed: {prompt_response.text}")
        raise HTTPException(status_code=prompt_response.status_code, detail="Test enrollment start failed")

    # Capture the current session cookie from Authentik
    for name, value in session.cookies.items():
        response.set_cookie(key=name, value=value, httponly=True, secure=True, samesite="lax")

    return {
        "message": "Test Account flow started",
        "new_user": True,
        "token": session.cookies.get("authentik_session"),
        "flow": AuthFlow.TEST_ENROLLMENT.value,
    }


async def start_test_login(phone_number: str, response: Response):
    """
    Starts the test login and starts login / enrollment flow depending on whether user already exists.
    """
    logger.info(f"Starting test account login flow for {phone_number}")
    session = requests.Session()

    try:
        # 1. Use the SMS login flow to check if the user exists (it has pretend_user_exists: false)
        id_response = session.post(
            LOGIN_FLOW_URL,
            json={"component": "ak-stage-identification", "uid_field": phone_number},
            params={"query": ""},
        )
        logger.debug(f"Authentik test login check response: {id_response.status_code} - {id_response.text}")

        id_data = id_response.json()
        response_errors = id_data.get("response_errors", {})
        non_field_errors = response_errors.get("non_field_errors", [])
        user_not_found = any(
            err.get("code") == "invalid" and err.get("string") == "Failed to authenticate." for err in non_field_errors
        )

        if user_not_found or id_data.get("component") == "ak-stage-access-denied":
            # If the user does not exist we start the enrollment flow instead.
            return await _start_test_enrollment(phone_number, response)

        # 2. If user exists, initialize the password flow so it's ready for the password stage
        # We need to do this because the session state is flow-specific.
        auth_init_response = session.post(
            TEST_PASSWORD_AUTH_FLOW_URL,
            json={"component": "ak-stage-identification", "uid_field": phone_number},
            params={"query": ""},
        )
        logger.debug(
            f"Authentik test auth flow init response: {auth_init_response.status_code} - {auth_init_response.text}"
        )

        response.set_cookie(
            key=AUTH_FLOW_COOKIE_NAME, value=AuthFlow.TEST_LOGIN.value, httponly=True, secure=True, samesite="lax"
        )
        # Capture the current session cookie from Authentik
        for name, value in session.cookies.items():
            response.set_cookie(key=name, value=value, httponly=True, secure=True, samesite="lax")

        return {
            "message": "Test Account flow started",
            "new_user": False,
            "token": session.cookies.get("authentik_session"),
            "flow": AuthFlow.TEST_LOGIN.value,
        }
    except Exception as e:
        logger.error(f"Test login start failed: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Internal error during test login start: {e}")


async def finish_test_enrollment(authentik_session: str, response: Response):
    """Completes the enrollment flow (Password stage)."""
    try:
        session = requests.Session()
        session.cookies.set("authentik_session", authentik_session)
        pw_response = session.post(
            TEST_ENROLLMENT_FLOW_URL,
            json={"component": "ak-stage-prompt", "password": TEST_ACCOUNT_PASSWORD},
            params={"query": ""},
        )
        logger.debug(f"Authentik test enrollment password response: {pw_response.status_code} - {pw_response.text}")

        if pw_response.status_code >= 400:
            raise HTTPException(status_code=pw_response.status_code, detail="Test login password failed")

        pw_data = pw_response.json()
        if pw_data.get("component") != "xak-flow-redirect":
            raise HTTPException(
                status_code=401, detail=f"Unexpected Authentik stage after password, {pw_data.get('component')}"
            )

        # Exchange session for RS256 token
        token = exchange_session_for_oidc_token(session)
        user = await get_current_user(token)
        if user:
            pool = get_db_pool()
            await get_or_create_user(pool, user.user_name, user.user_id)

        response.set_cookie(key="authentik_session", value=token, httponly=True, secure=True, samesite="lax")
        response.delete_cookie(AUTH_FLOW_COOKIE_NAME)

        return {"success": True, "is_new_user": True, "token": token}
    except Exception as e:
        logger.error(f"Test enrollment finish failed: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Internal error during test enrollment finish: {e}")


async def finish_test_login(authentik_session: str, response: Response):
    """
    Completes the test login or enrollment flow in Authentik.
    """
    session = requests.Session()
    try:
        session.cookies.set("authentik_session", authentik_session)
        pw_response = session.post(
            TEST_PASSWORD_AUTH_FLOW_URL,
            json={"component": "ak-stage-password", "password": TEST_ACCOUNT_PASSWORD},
            params={"query": ""},
        )
        logger.debug(f"Authentik test login password response: {pw_response.status_code} - {pw_response.text}")

        if pw_response.status_code >= 400:
            raise HTTPException(status_code=pw_response.status_code, detail="Test login password failed")

        pw_data = pw_response.json()
        if pw_data.get("component") != "xak-flow-redirect":
            raise HTTPException(status_code=401, detail="Unexpected Authentik stage after password")

        token = exchange_session_for_oidc_token(session)
        user = await get_current_user(token)
        if user:
            pool = get_db_pool()
            await get_or_create_user(pool, user.user_name, user.user_id)

        response.set_cookie(key="authentik_session", value=token, httponly=True, secure=True, samesite="lax")
        response.delete_cookie(AUTH_FLOW_COOKIE_NAME)

        return {"success": True, "is_new_user": False, "token": token}
    except Exception as e:
        logger.error(f"Test login finish failed: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Internal error during test login finish: {e}")
