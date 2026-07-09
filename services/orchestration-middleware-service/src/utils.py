import json
import uuid
from typing import Any, Optional


def ndjson_token(content: str) -> str:
    return json.dumps({"type": "token", "content": content}) + "\n"


def ndjson_done(conversation_id: uuid.UUID) -> str:
    return json.dumps({"type": "done", "conversation_id": str(conversation_id)}) + "\n"


def ndjson_error(message: str) -> str:
    return json.dumps({"type": "error", "content": message}) + "\n"


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


def parse_boolean(val: Any) -> Optional[bool]:
    """
    Safely converts common text boolean representations to Python bool.
    """
    if val is None:
        return None
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return bool(val)

    s = str(val).strip().lower()
    if s in ("ja", "yes", "true", "1", "t", "y"):
        return True
    if s in ("nein", "no", "false", "0", "f", "n"):
        return False
    return None


def parse_address(address_str: str) -> dict[str, str]:
    """
    Parses a single address string into street, house_number, zip_code, and city.
    Supports standard German address formats.
    """
    import re

    if not address_str:
        return {"street": "", "house_number": "", "zip_code": "", "city": ""}

    address_str = address_str.strip()

    # 1. Look for a 5-digit zip code
    zip_match = re.search(r"\b\d{5}\b", address_str)

    zip_code = ""
    city = ""
    street_and_hn = address_str

    if zip_match:
        zip_code = zip_match.group(0)
        start_idx, end_idx = zip_match.span()

        before = address_str[:start_idx].strip(", \t\n\r")
        after = address_str[end_idx:].strip(", \t\n\r")

        if not before:
            # Format: "12345 Berlin, Hauptstr. 12"
            parts = re.split(r"[,\n]", after, maxsplit=1)
            city = parts[0].strip()
            street_and_hn = parts[1].strip() if len(parts) > 1 else ""
        elif not after:
            # Format: "Hauptstr. 12, 12345"
            street_and_hn = before
            city = ""
        else:
            # Format: "Hauptstr. 12, 12345 Berlin"
            street_and_hn = before
            city = after

    street = street_and_hn
    house_number = ""

    # Parse street and house number using greedy match for street name
    if street_and_hn:
        match = re.match(r"^(?P<street>.+)\s+(?P<house_number>\d+.*)$", street_and_hn)
        if match:
            street = match.group("street").strip(", \t\n\r")
            house_number = match.group("house_number").strip(", \t\n\r")

    return {
        "street": street,
        "house_number": house_number,
        "zip_code": zip_code,
        "city": city,
    }
