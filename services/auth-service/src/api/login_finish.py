import logging
import requests
from beyondforms.auth import get_current_user
from typing import Annotated, Optional
from fastapi import APIRouter, HTTPException, Response, Cookie, Header
from pydantic import BaseModel, Field
from src.utils.config import LOGIN_FLOW_URL, ENROLLMENT_FLOW_URL
from src.utils.auth_flows import AuthFlow, AUTH_FLOW_COOKIE_NAME, AUTH_FLOW_HEADER_NAME
from src.utils.db import get_db_pool
from src.services.user_service import get_or_create_user
from src.utils.test_accounts import finish_test_login, finish_test_enrollment
from src.utils.token_exchange import exchange_session_for_oidc_token

logger = logging.getLogger(__name__)
router = APIRouter()


class LoginFinishRequest(BaseModel):
    code: str = Field(..., description="SMS verification code")


@router.post("/login/finish")
async def login_finish(
    request: LoginFinishRequest,
    response: Response,
    authentik_session: Annotated[Optional[str], Cookie()] = None,
    authorization: Annotated[Optional[str], Header()] = None,
    beyondforms_auth_flow: Annotated[Optional[AuthFlow], Cookie(alias=AUTH_FLOW_COOKIE_NAME)] = None,
    auth_flow_header: Annotated[Optional[AuthFlow], Header(alias=AUTH_FLOW_HEADER_NAME)] = None,
):
    logger.info(f"Login finish with code {request.code}")

    token = authentik_session
    if not token and authorization:
        if authorization.startswith("Bearer "):
            token = authorization.replace("Bearer ", "")
        else:
            token = authorization

    flow = beyondforms_auth_flow or auth_flow_header

    if not token:
        raise HTTPException(status_code=401, detail="Tried to finish login flow without session")

    # Run completely separate flow if test account.
    if flow == AuthFlow.TEST_ENROLLMENT:
        return await finish_test_enrollment(token, response)
    if flow == AuthFlow.TEST_LOGIN:
        return await finish_test_login(token, response)

    # Determine which flow to finish based on the hint
    flow_url = ENROLLMENT_FLOW_URL if flow == AuthFlow.ENROLLMENT else LOGIN_FLOW_URL

    try:
        session = requests.Session()
        session.cookies.set("authentik_session", token)

        payload = {"component": "ak-stage-authenticator-sms", "code": request.code}

        solve_response = session.post(flow_url, json=payload, params={"query": ""})

        if solve_response.status_code >= 400:
            logger.error(f"Authentik error during login finish: {solve_response.text}")
            raise HTTPException(status_code=solve_response.status_code, detail="Authentication provider error")

        data = solve_response.json()
        logger.info(f"Authentik flow solve response: {data}")
        success = data.get("type") == "redirect" or data.get("component") == "xak-flow-redirect"
        is_new_user = flow == AuthFlow.ENROLLMENT
        token_out = None

        if success:
            # Exchange the session for an RS256 token
            token_out = exchange_session_for_oidc_token(session)
            response.set_cookie(key="authentik_session", value=token_out, httponly=True, secure=True, samesite="lax")
            user = await get_current_user(token_out)

            if user:
                pool = get_db_pool()
                _user_id = await get_or_create_user(pool, user.user_name, user.user_id)

        response.delete_cookie(AUTH_FLOW_COOKIE_NAME)
        return {"success": success, "is_new_user": is_new_user, "token": token_out}
    except Exception as e:
        logger.error(f"Login finish error: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Failed to complete login flow: {e}")
