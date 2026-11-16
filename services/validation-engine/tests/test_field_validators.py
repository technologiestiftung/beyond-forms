from datetime import date, timedelta
from typing import List

import pytest

from src.app.validators.field_type_validators import (
    validate_phone_number_format,
    validate_date_is_not_future,
    validate_date_is_in_future,
    validate_german_zip_code,
    validate_non_empty_string,
)

PAST_DATE_SAMPLES: List[date] = [
    date.today() - timedelta(days=1),
    date.today() - timedelta(days=365),
    date(1900, 1, 1),
]

FUTURE_DATE_SAMPLES: List[date] = [
    date.today() + timedelta(days=1),
    date.today() + timedelta(days=365),
    date(2100, 1, 1),
]

TODAY_SAMPLE: List[date] = [date.today()]


def test_validate_non_empty_string_success():
    """Verifies that valid strings are returned as-is."""
    valid_input = "Jane Doe"
    result = validate_non_empty_string(valid_input)

    assert result == valid_input
    assert len(result) > 0


@pytest.mark.parametrize(
    "invalid_input",
    [
        "",  # Empty string
        " ",  # Single space
        "   ",  # Multiple spaces
        "\n",  # Newline
        "\t",  # Tab character
        " \n \t ",  # Mix of whitespace
    ],
)
def test_validate_non_empty_string_fails_on_whitespace_only(invalid_input):
    """Ensures strings consisting only of whitespace trigger a ValueError."""
    with pytest.raises(ValueError) as exception_context:
        validate_non_empty_string(invalid_input)

    assert "at least one character" in str(exception_context.value)


def test_validate_non_empty_string_preserves_surrounding_whitespace():
    """
    Verifies the validator allows strings with leading/trailing spaces
    as long as they contain at least one non-space character.
    """
    input_with_spaces = "  Alice  "
    result = validate_non_empty_string(input_with_spaces)

    # The validator should return the original string, not a stripped one
    assert result == "  Alice  "


@pytest.mark.parametrize(
    "phone_input, expected_normalized",
    [
        ("+1234567890", "+1234567890"),
        ("+491512345678", "+491512345678"),
        ("+11", "+11"),
        ("+49 15123 456 78", "+491512345678"),
        ("+999999999999999", "+999999999999999"),
        ("01512345678", "+491512345678"),
        ("00491512345678", "+491512345678"),
        ("1512345678", "+491512345678"),
        ("491512345678", "+491512345678"),
        ("+49 (0) 151 2345678", "+491512345678"),
        ("030 123456", "+4930123456"),
        ("1234567890", "+491234567890"),
    ],
)
def test_valid_phone_number(
    phone_input: str,
    expected_normalized: str,
) -> None:
    assert validate_phone_number_format(phone_input) == expected_normalized


@pytest.mark.parametrize(
    "invalid_phone_number",
    [
        "+0123456789",
        "+1",
        "+1234567890123456",
        "+123a456",
        "",
        " ",
        "abc",
    ],
)
def test_invalid_phone_number(
    invalid_phone_number: str,
) -> None:
    with pytest.raises(ValueError, match="Phone number must be in E.164 format"):
        validate_phone_number_format(invalid_phone_number)


@pytest.mark.parametrize("past_date", PAST_DATE_SAMPLES + TODAY_SAMPLE)
def test_past_date_validator_accepts_valid_dates(past_date: date) -> None:
    assert validate_date_is_not_future(past_date) == past_date


@pytest.mark.parametrize("future_date", FUTURE_DATE_SAMPLES)
def test_past_date_validator_fails_for_future_dates(future_date: date) -> None:
    with pytest.raises(ValueError, match="The date provided cannot be in the future."):
        validate_date_is_not_future(future_date)


@pytest.mark.parametrize("future_date", FUTURE_DATE_SAMPLES)
def test_future_date_validator_accepts_valid_dates(future_date: date) -> None:
    assert validate_date_is_in_future(future_date) == future_date


@pytest.mark.parametrize("past_date", PAST_DATE_SAMPLES + TODAY_SAMPLE)
def test_future_date_validator_fails_for_past_dates(past_date: date) -> None:
    with pytest.raises(ValueError, match="The date provided must be in the future."):
        validate_date_is_in_future(past_date)


@pytest.mark.parametrize(
    "valid_postal_code",
    [
        "10117",  # Berlin
        "01067",  # Dresden (testing leading zero preservation)
        "80331",  # Munich
        "99998",  # High range
    ],
)
def test_german_postal_code_validator_accepts_valid_five_digit_strings(
    valid_postal_code: str,
) -> None:
    assert validate_german_zip_code(valid_postal_code) == valid_postal_code


@pytest.mark.parametrize(
    "invalid_postal_code",
    [
        "1234",  # Too short
        "123456",  # Too long
        "12A45",  # Contains letters
        "12 45",  # Contains spaces
        "12-45",  # Contains special characters
        "",  # Empty string
        "abcde",  # All letters
    ],
)
def test_german_postal_code_validator_raises_error_for_invalid_formats(
    invalid_postal_code: str,
) -> None:
    expected_error_message = "German postal codes must consist of exactly five digits."
    with pytest.raises(ValueError, match=expected_error_message):
        validate_german_zip_code(invalid_postal_code)
