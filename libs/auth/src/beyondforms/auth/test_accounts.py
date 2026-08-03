"""
Recognition of BeyondForms test accounts by phone number.

Lives here rather than in auth-service because more than one service needs to
know whether a caller is a test account: auth-service to route them past the SMS
one-time-password flow, and the middleware to decide whether demo-persona
seeding may touch the account.
"""

# Bundesnetzagentur defines ranges of "Drama Numbers", which are phone numbers allowed
# to be used in media productions, which will never be connected to real phones.
# These numbers are used as test accounts.
# https://www.bundesnetzagentur.de/DE/Fachthemen/Telekommunikation/Nummerierung/_DL/mittlg148_2021.pdf
DRAMA_NUMBER_PREFIXES = (
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
    if not phone_number:
        return False
    return any(phone_number.startswith(prefix) for prefix in DRAMA_NUMBER_PREFIXES)
