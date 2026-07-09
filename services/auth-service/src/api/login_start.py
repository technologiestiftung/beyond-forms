import logging
import requests
import secrets
from fastapi import APIRouter, HTTPException, Response, Request
from pydantic import BaseModel, Field
from src.utils.config import LOGIN_FLOW_URL, ENROLLMENT_FLOW_URL, IS_PRODUCTION, PROD_TEST_BYPASS_KEY
from src.utils.auth_flows import AuthFlow, AUTH_FLOW_COOKIE_NAME
from src.utils.test_accounts import is_test_account, start_test_login

logger = logging.getLogger(__name__)
router = APIRouter()


class LoginStartRequest(BaseModel):
    phone_number: str = Field(..., description="Phone number to authenticate")


async def _start_enrollment(session: requests.Session, phone_number: str, response: Response):
    """Helper to handle the enrollment flow."""
    logger.info(f"Starting enrollment flow for {phone_number}")

    # 1. Start enrollment: Get flow to initialize session
    init_response = session.get(ENROLLMENT_FLOW_URL, params={"query": ""})
    if init_response.status_code >= 400:
        logger.error(f"Enrollment init failed: {init_response.text}")
        raise HTTPException(status_code=init_response.status_code, detail="Failed to initialize enrollment.")

    # 2. Solve Prompt stage
    enroll_response = session.post(
        ENROLLMENT_FLOW_URL,
        json={
            "component": "ak-stage-prompt",
            "username": phone_number,
            "phone_number": phone_number,
        },
        params={"query": ""},
    )

    if enroll_response.status_code >= 400:
        logger.error(f"Enrollment solve failed: {enroll_response.text}")
        raise HTTPException(status_code=enroll_response.status_code, detail="Failed to start enrollment.")

    enroll_data = enroll_response.json()
    if enroll_data.get("component") == "ak-stage-access-denied":
        raise HTTPException(
            status_code=403, detail=f"Access denied during enrollment: {enroll_data.get('error_message')}"
        )

    # 3. Send SMS
    sms_response = session.post(
        ENROLLMENT_FLOW_URL,
        json={"component": "ak-stage-authenticator-sms", "phone_number": phone_number},
        params={"query": ""},
    )

    if sms_response.status_code >= 400:
        logger.error(f"Enrollment SMS failed: {sms_response.text}")
        raise HTTPException(status_code=sms_response.status_code, detail="Failed to send SMS during enrollment.")

    sms_data = sms_response.json()
    if sms_data.get("component") == "ak-stage-access-denied":
        raise HTTPException(
            status_code=403, detail=f"Access denied during enrollment SMS: {sms_data.get('error_message')}"
        )

    for name, value in session.cookies.items():
        response.set_cookie(key=name, value=value, httponly=True, secure=True, samesite="lax")

    # Set a hint for login_finish to know which flow to complete
    response.set_cookie(
        key=AUTH_FLOW_COOKIE_NAME, value=AuthFlow.ENROLLMENT.value, httponly=True, secure=True, samesite="lax"
    )

    return {
        "message": "SMS flow started",
        "new_user": True,
        "token": session.cookies.get("authentik_session"),
        "flow": AuthFlow.ENROLLMENT.value,
    }


@router.post("/login/start")
async def login_start(request: LoginStartRequest, response: Response, raw_request: Request):
    logger.info(f"Login start for phone number: {request.phone_number}")
    phone_number = request.phone_number

    # Secure test account authorization check with constant-time comparison and warnings
    bypass_key = raw_request.headers.get("X-BeyondForms-Prod-Test-Key")
    is_authorized_test = False

    if is_test_account(phone_number):
        if not IS_PRODUCTION:
            is_authorized_test = True
        elif PROD_TEST_BYPASS_KEY:
            if secrets.compare_digest(bypass_key or "", PROD_TEST_BYPASS_KEY):
                is_authorized_test = True
                logger.warning(f"Production test account bypass SUCCESSFUL for phone number {phone_number}")
            else:
                logger.warning(f"Production test account bypass FAILED (invalid key) for phone number {phone_number}")
                raise HTTPException(status_code=403, detail="Invalid test account bypass key.")
        else:
            logger.error(
                f"Production test account bypass FAILED (missing server-side config) for phone number {phone_number}"
            )
            raise HTTPException(status_code=403, detail="Test accounts are disabled in this environment.")

    if is_authorized_test:
        return await start_test_login(phone_number, response)

    session = requests.Session()

    try:
        # 1. Try Identification Stage (Login Flow)
        id_response = session.post(
            LOGIN_FLOW_URL,
            json={"component": "ak-stage-identification", "uid_field": phone_number},
            params={"query": ""},
        )

        if id_response.status_code >= 400:
            raise HTTPException(status_code=id_response.status_code, detail="Failed to start login flow.")

        id_data = id_response.json()

        # If user does not exist, Authentik returns the identification stage
        # again with a 'Failed to authenticate' error (if there is matching shadow-user from previous flow),
        # or redirects to ak-stage-access-denied.
        response_errors = id_data.get("response_errors", {})
        non_field_errors = response_errors.get("non_field_errors", [])
        user_not_found = any(
            err.get("code") == "invalid" and err.get("string") == "Failed to authenticate." for err in non_field_errors
        )

        if (id_data.get("component") == "ak-stage-identification" and user_not_found) or id_data.get(
            "component"
        ) == "ak-stage-access-denied":
            return await _start_enrollment(session, phone_number, response)

        # 2. Send SMS (Login Flow)
        sms_response = session.post(
            LOGIN_FLOW_URL,
            json={"component": "ak-stage-authenticator-sms", "phone_number": phone_number},
            params={"query": ""},
        )

        if sms_response.status_code >= 400:
            raise HTTPException(status_code=sms_response.status_code, detail="Failed to send SMS during login.")

        sms_data = sms_response.json()
        if sms_data.get("component") == "ak-stage-access-denied":
            raise HTTPException(
                status_code=403, detail=f"Access denied during login SMS: {sms_data.get('error_message')}"
            )

        for name, value in session.cookies.items():
            response.set_cookie(key=name, value=value, httponly=True, secure=True, samesite="lax")

        # Set a hint for login_finish to know which flow to complete
        response.set_cookie(
            key=AUTH_FLOW_COOKIE_NAME,
            value=AuthFlow.LOGIN.value,
            httponly=True,
            max_age=300,
            secure=True,
            samesite="lax",
        )

        return {
            "message": "SMS flow started",
            "new_user": False,
            "token": session.cookies.get("authentik_session"),
            "flow": AuthFlow.LOGIN.value,
        }

    except Exception as e:
        logger.error(f"Fallback enrollment failed: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Failed to start login flow: {e}")
