def get_google_id_token(audience: str) -> str | None:
    """
    Fetches an OIDC ID token from the Google Cloud Metadata Server using google-auth.
    Returns None if metadata server is not reachable or token cannot be retrieved,
    or if the audience is not an HTTPS URL.
    """
    import os

    if not os.getenv("K_SERVICE"):
        # Local development: Cloud Run metadata server is not available.
        # Skip fetching to prevent 10s metadata server connection timeout hangs.
        return None

    if not audience or not audience.startswith("https://"):
        # No OIDC token needed for non-https endpoints (e.g., local development)
        return None

    from urllib.parse import urlparse

    parsed = urlparse(audience)
    base_audience = f"{parsed.scheme}://{parsed.netloc}"

    try:
        from google.auth.transport.requests import Request
        from google.oauth2 import id_token

        auth_req = Request()
        return id_token.fetch_id_token(auth_req, base_audience)
    except Exception:
        # Fail-safe: if metadata server is not available (e.g., local development), return None
        return None
