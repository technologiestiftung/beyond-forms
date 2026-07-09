import pytest
import jwt
import time
from unittest.mock import MagicMock, patch
from fastapi import HTTPException, Request
from beyondforms.auth.auth import get_current_user, require_authenticated_user, AUTHENTIK_ISSUER_URL

# Test RSA keys
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.backends import default_backend

private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048, backend=default_backend())
FAKE_PRIVATE_KEY = private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption(),
).decode()
FAKE_PUBLIC_KEY = (
    private_key.public_key()
    .public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    .decode()
)


@pytest.fixture(autouse=True)
def mock_authentik_config():
    with patch("beyondforms.auth.auth.AUTHENTIK_PUBLIC_KEY", FAKE_PUBLIC_KEY):
        yield


@pytest.fixture
def mock_request():
    return MagicMock(spec=Request)


def create_rs256_token(payload):
    if "exp" not in payload:
        payload["exp"] = int(time.time()) + 3600
    if "iss" not in payload:
        payload["iss"] = AUTHENTIK_ISSUER_URL
    return jwt.encode(payload, FAKE_PRIVATE_KEY, algorithm="RS256")


def create_hs256_token(payload):
    return jwt.encode(payload, "some-secret", algorithm="HS256")


@pytest.mark.asyncio
async def test_get_current_user_no_session(mock_request):
    user = await get_current_user(authentik_session=None, authorization=None)
    assert user is None


@pytest.mark.asyncio
async def test_get_current_user_valid_token_rs256(mock_request):
    payload = {
        "sub": "user-rs256",
        "preferred_username": "testuser",
        "sid": "session-rs256",
        "aud": "beyondforms",
    }
    token = create_rs256_token(payload)

    user = await get_current_user(authentik_session=token, authorization=None)
    assert user.user_id == "user-rs256"
    assert user.user_name == "testuser"
    assert user.session_id == "session-rs256"
    assert user.is_authenticated is True


@pytest.mark.asyncio
async def test_get_current_user_valid_header_rs256(mock_request):
    payload = {
        "sub": "user-rs256",
        "preferred_username": "testuser",
        "sid": "session-rs256",
        "aud": "beyondforms",
    }
    token = create_rs256_token(payload)
    authorization = f"Bearer {token}"

    user = await get_current_user(authentik_session=None, authorization=authorization)
    assert user.user_id == "user-rs256"
    assert user.user_name == "testuser"
    assert user.is_authenticated is True


@pytest.mark.asyncio
async def test_get_current_user_hs256_is_unauthenticated(mock_request):
    payload = {"sub": "user-123"}
    token = create_hs256_token(payload)

    user = await get_current_user(authentik_session=token, authorization=None)
    assert user is None


@pytest.mark.asyncio
async def test_get_current_user_expired_token(mock_request):
    payload = {"sub": "user-rs256", "exp": int(time.time()) - 100, "aud": "beyondforms"}
    token = create_rs256_token(payload)

    user = await get_current_user(authentik_session=token, authorization=None)
    assert user is None


@pytest.mark.asyncio
async def test_require_authenticated_user_success(mock_request):
    payload = {
        "sub": "user-123",
        "preferred_username": "testuser",
        "sid": "session-456",
        "aud": "beyondforms",
    }
    token = create_rs256_token(payload)

    user = await require_authenticated_user(authentik_session=token, authorization=None)
    assert user.user_id == "user-123"
    assert user.is_authenticated is True


@pytest.mark.asyncio
async def test_require_authenticated_user_no_session(mock_request):
    with pytest.raises(HTTPException) as excinfo:
        await require_authenticated_user(authentik_session=None, authorization=None)
    assert excinfo.value.status_code == 401
    assert "Missing authentication token" in excinfo.value.detail


@pytest.mark.asyncio
async def test_get_current_user_invalid_signature(mock_request):
    # Create another key pair
    other_private_key = (
        rsa.generate_private_key(public_exponent=65537, key_size=2048, backend=default_backend())
        .private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
        .decode()
    )

    payload = {"sub": "user-123", "aud": "beyondforms"}
    invalid_token = jwt.encode(payload, other_private_key, algorithm="RS256")

    user = await get_current_user(authentik_session=invalid_token, authorization=None)
    assert user is None


@pytest.mark.asyncio
async def test_require_authenticated_user_invalid_algorithm(mock_request):
    payload = {"sub": "user-123"}
    token = jwt.encode(payload, "secret", algorithm="HS512")

    with pytest.raises(HTTPException) as excinfo:
        await require_authenticated_user(authentik_session=token, authorization=None)
    assert excinfo.value.status_code == 401
    assert "Unsupported algorithm" in excinfo.value.detail


@pytest.mark.asyncio
async def test_require_authenticated_user_jwks_fallback():
    payload = {
        "sub": "user-jwks",
        "preferred_username": "jwksuser",
        "sid": "session-jwks",
        "aud": "beyondforms",
    }
    token = create_rs256_token(payload)

    # Force AUTHENTIK_PUBLIC_KEY to None and simulate file unreadable/nonexistent
    with (
        patch("beyondforms.auth.auth.AUTHENTIK_PUBLIC_KEY", None),
        patch("os.path.exists", return_value=False),
        patch("jwt.PyJWKClient") as mock_jwk_client_class,
    ):
        mock_jwk_client = MagicMock()
        mock_signing_key = MagicMock()
        mock_signing_key.key = FAKE_PUBLIC_KEY
        mock_jwk_client.get_signing_key_from_jwt.return_value = mock_signing_key
        mock_jwk_client_class.return_value = mock_jwk_client

        user = await require_authenticated_user(authentik_session=token, authorization=None)
        assert user.user_id == "user-jwks"
        assert user.user_name == "jwksuser"
        assert user.session_id == "session-jwks"
        assert user.is_authenticated is True


@pytest.mark.asyncio
async def test_require_authenticated_user_invalid_issuer_fallback():
    payload = {
        "sub": "user-iss",
        "preferred_username": "issuser",
        "sid": "session-iss",
        "aud": "beyondforms",
        "iss": "https://proxy.external.com/application/o/beyondforms/",
    }
    token = jwt.encode(payload, FAKE_PRIVATE_KEY, algorithm="RS256")

    user = await require_authenticated_user(authentik_session=token, authorization=None)
    assert user.user_id == "user-iss"
    assert user.user_name == "issuser"
    assert user.is_authenticated is True
