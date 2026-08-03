import pytest

from beyondforms.auth import DRAMA_NUMBER_PREFIXES, is_test_account


@pytest.mark.parametrize(
    "phone_number",
    [
        "+493023125101",  # Berlin, demo persona sabine
        "+493023125102",  # Berlin, demo persona helmut
        "+493023125103",  # Berlin, demo persona sandor
        "03023125123",  # Berlin, national format
        "+496990009123",  # Frankfurt
        "04066969123",  # Hamburg
        "+492214710123",  # Köln
        "08999998123",  # München
    ],
)
def test_drama_numbers_are_test_accounts(phone_number):
    assert is_test_account(phone_number) is True


@pytest.mark.parametrize(
    "phone_number",
    [
        "+4930123456",  # real-looking Berlin landline
        "+491701234567",  # real-looking mobile
        "0302312",  # truncated below the prefix length
        "3023125101",  # missing leading 0 / country code
        "",
        None,
    ],
)
def test_other_numbers_are_not_test_accounts(phone_number):
    assert is_test_account(phone_number) is False


def test_every_prefix_is_recognised():
    """Guards against a prefix being added to the tuple but shadowed by a typo."""
    for prefix in DRAMA_NUMBER_PREFIXES:
        assert is_test_account(prefix + "000") is True
