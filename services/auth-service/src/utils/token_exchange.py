import logging
import os
import requests
from urllib.parse import urlparse, parse_qs
from src.utils.config import AUTHENTIK_SERVER_URL, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET

logger = logging.getLogger(__name__)

# OIDC Configuration from blueprints/oidc-provider.yaml
# This URI must exactly match one of the 'redirect_uris' configured in the Authentik
# OIDC Provider defined in auth/blueprints/oidc-provider.yaml.
# While this points to the frontend port (3000), the auth-service
# intercepts the redirect server-side and never actually navigates to this address.
OIDC_REDIRECT_URI = os.getenv("OIDC_REDIRECT_URI", "http://localhost:3000/auth/callback")


def exchange_session_for_oidc_token(session: requests.Session) -> str | None:
    """
    Exchanges an active Authentik session (HS256 cookie) for a signed OIDC ID Token (RS256).

    This performs a 'silent' OIDC authorization flow using the session already
    established in the provided requests.Session object.
    """
    try:
        # 1. Request an authorization code (using prompt=none for silent auth)
        authorize_url = f"{AUTHENTIK_SERVER_URL}/application/o/authorize/"
        auth_params = {
            "client_id": OIDC_CLIENT_ID,
            "response_type": "code",
            "scope": "openid profile email",
            "redirect_uri": OIDC_REDIRECT_URI,
            "prompt": "none",
        }

        # We must use allow_redirects=False to catch the 302 with the code
        auth_response = session.get(authorize_url, params=auth_params, allow_redirects=False)

        if auth_response.status_code != 302:
            logger.warning(f"OIDC authorize failed (Expected 302): {auth_response.status_code} - {auth_response.text}")
            return None

        location = auth_response.headers.get("Location", "")
        query_params = parse_qs(urlparse(location).query)
        code = query_params.get("code", [None])[0]

        if not code:
            logger.warning(f"OIDC authorize redirected without code: {location}")
            return None

        # 2. Exchange authorization code for tokens at the token endpoint
        token_url = f"{AUTHENTIK_SERVER_URL}/application/o/token/"
        token_payload = {
            "grant_type": "authorization_code",
            "code": code,
            "client_id": OIDC_CLIENT_ID,
            "client_secret": OIDC_CLIENT_SECRET,
            "redirect_uri": OIDC_REDIRECT_URI,
        }

        token_response = requests.post(token_url, data=token_payload)
        if token_response.status_code != 200:
            logger.error(f"OIDC token exchange failed: {token_response.status_code} - {token_response.text}")
            return None

        token_data = token_response.json()
        id_token = token_data.get("id_token")

        if not id_token:
            logger.error("OIDC response did not contain an id_token")
            return None

        logger.info("Successfully exchanged session for RS256 OIDC token")
        return id_token

    except Exception as e:
        logger.error(f"Unexpected error during OIDC token exchange: {e}")
        return None
