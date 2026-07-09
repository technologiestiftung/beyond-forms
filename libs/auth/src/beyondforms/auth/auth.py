import os
import jwt
import logging
import time
from typing import Optional
from fastapi import HTTPException, Cookie, Header
from pydantic import BaseModel

logger = logging.getLogger(__name__)

AUTHENTIK_SERVER_URL = os.getenv("AUTHENTIK_SERVER_URL", "http://authentik-server:9000")
AUTHENTIK_PUBLIC_KEY_PATH = os.getenv("AUTHENTIK_PUBLIC_KEY_PATH")
AUTHENTIK_ISSUER_URL = os.getenv("AUTHENTIK_ISSUER_URL", AUTHENTIK_SERVER_URL + "/application/o/beyondforms/")

# Load public key from path if provided
AUTHENTIK_PUBLIC_KEY = None
if AUTHENTIK_PUBLIC_KEY_PATH and os.path.exists(AUTHENTIK_PUBLIC_KEY_PATH):
    try:
        with open(AUTHENTIK_PUBLIC_KEY_PATH, "r") as f:
            AUTHENTIK_PUBLIC_KEY = f.read()
    except Exception as e:
        logger.error(f"Failed to load public key from {AUTHENTIK_PUBLIC_KEY_PATH}: {e}")

# If it's a certificate, we need to extract the public key
if AUTHENTIK_PUBLIC_KEY and "-----BEGIN CERTIFICATE-----" in AUTHENTIK_PUBLIC_KEY:
    try:
        from cryptography import x509

        cert = x509.load_pem_x509_certificate(AUTHENTIK_PUBLIC_KEY.encode())
        AUTHENTIK_PUBLIC_KEY = cert.public_key()
    except Exception as e:
        logger.error(f"Failed to extract public key from certificate: {e}")


class User(BaseModel):
    """
    Represents a user authenticated via Authentik.

    Attributes:
        user_id: Unique identifier for the user.
        session_id: The session identifier.
        user_name: The username for the user (phone number).
        is_authenticated: Whether the user is fully authenticated.
    """

    # Unique, immutable identifier for the user within authentik.
    # Note: This is set to "anonymous" if user is not signed in.
    # https://docs.goauthentik.io/core/glossary/?subject-sub
    user_id: str
    user_name: str
    session_id: str
    is_authenticated: bool = True


def get_public_key(token: str):
    global AUTHENTIK_PUBLIC_KEY
    if AUTHENTIK_PUBLIC_KEY:
        return AUTHENTIK_PUBLIC_KEY

    # 1. Try loading from AUTHENTIK_PUBLIC_KEY_PATH (re-attempt opening file)
    path = os.getenv("AUTHENTIK_PUBLIC_KEY_PATH", AUTHENTIK_PUBLIC_KEY_PATH)
    if path and os.path.exists(path):
        try:
            with open(path, "r") as f:
                pub_key = f.read()
            if pub_key and "-----BEGIN CERTIFICATE-----" in pub_key:
                from cryptography import x509

                cert = x509.load_pem_x509_certificate(pub_key.encode())
                pub_key = cert.public_key()
            if pub_key:
                AUTHENTIK_PUBLIC_KEY = pub_key
                return pub_key
        except Exception as e:
            logger.warning(f"Failed to load public key from {path}: {e}")

    # 2. Try fetching dynamically via PyJWKClient using JWKS endpoint
    try:
        issuer_url = os.getenv("AUTHENTIK_ISSUER_URL", AUTHENTIK_ISSUER_URL)
        jwks_uri = issuer_url.rstrip("/") + "/jwks/"
        jwk_client = jwt.PyJWKClient(jwks_uri)
        signing_key = jwk_client.get_signing_key_from_jwt(token)
        return signing_key.key
    except Exception as e:
        logger.warning(f"Failed to fetch public key via JWKS: {e}")

    return None


async def require_authenticated_user(
    authentik_session: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
    token: Optional[str] = None,
) -> User:
    if not token:
        token = authentik_session
    if not token and isinstance(authorization, str):
        if authorization.startswith("Bearer "):
            token = authorization.replace("Bearer ", "")
        else:
            token = authorization

    if not token:
        raise HTTPException(status_code=401, detail="Missing authentication token")

    try:
        unverified_header = jwt.get_unverified_header(token)
        alg = unverified_header.get("alg")

        if alg == "RS256":
            pub_key = get_public_key(token)
            if not pub_key:
                logger.error(
                    f"Public key not found at {AUTHENTIK_PUBLIC_KEY_PATH} and JWKS unreachable. Cannot verify RS256 JWT."
                )
                raise HTTPException(
                    status_code=401,
                    detail="Internal authentication configuration error",
                )

            try:
                payload = jwt.decode(
                    token,
                    pub_key,
                    algorithms=["RS256"],
                    audience="beyondforms",
                    issuer=AUTHENTIK_ISSUER_URL,
                )
            except jwt.exceptions.InvalidIssuerError:
                payload = jwt.decode(
                    token,
                    pub_key,
                    algorithms=["RS256"],
                    audience="beyondforms",
                    options={"verify_iss": False},
                )

            if payload.get("exp") and payload.get("exp") < int(time.time()):
                raise HTTPException(status_code=401, detail="Token expired")

            return User(
                user_id=payload.get("sub"),
                user_name=payload.get("preferred_username", ""),
                session_id=payload.get("sid", payload.get("session_id", "")),
                is_authenticated=True,
            )

        if alg == "HS256":
            # Validated decoding can be done by passing secret key here, but we don't care as we treat HS256 tokens as non authenticated.
            # payload = jwt.decode(token, AUTHENTIK_SECRET_KEY, algorithms=["HS256"])
            raise HTTPException(status_code=401, detail="Invalid token for authentication")

        raise HTTPException(
            status_code=401,
            detail=f"Unsupported algorithm: {alg}. Supported: RS256, HS256.",
        )

    except Exception as e:
        logger.error(f"Authentication failed: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=401, detail=f"Invalid token or authentication failed: {str(e)}")


async def get_current_user(
    authentik_session: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
    token: Optional[str] = None,
) -> Optional[User]:
    try:
        return await require_authenticated_user(authentik_session, authorization, token)
    except HTTPException as e:
        logger.info(f"User not authenticated: {str(e)}")
        return None
