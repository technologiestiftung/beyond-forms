import re
from datetime import date


def validate_non_empty_string(string: str) -> str:
    """
    Validates non-empty and minimum length of one character
    """

    if len(string.strip().replace(" ", "")) < 1:
        raise ValueError("String must have at least one character.")
    return string


def validate_phone_number_format(phone_number: str) -> str:
    """
    Validates that the string follows the E.164 international phone numbering plan.
    Supports basic normalization for common German formats.
    """
    # Count digits to prevent empty/insufficient inputs from normalizing to valid country codes
    digit_count = sum(1 for c in phone_number if c.isdigit())
    if digit_count < 2:
        raise ValueError("Phone number must be in E.164 format (e.g., +1234567890).")

    # Remove country code parenthetical zero, e.g. +49 (0) 151 -> +49 151
    s = re.sub(r"\(\s*0\s*\)", "", phone_number)
    # Remove spaces, dashes, and remaining parentheses
    s = re.sub(r"[\s\-\(\)]", "", s)

    # Normalize starts: 00 -> +, 0 -> +49
    if s.startswith("00"):
        s = "+" + s[2:]
    elif s.startswith("0"):
        s = "+49" + s[1:]
    elif not s.startswith("+"):
        if s.startswith("49"):
            s = "+" + s
        else:
            s = "+49" + s

    international_phone_regex = r"^\+[1-9]\d{1,14}$"
    if not re.match(international_phone_regex, s):
        raise ValueError("Phone number must be in E.164 format (e.g., +1234567890).")
    return s


def validate_german_zip_code(zip_code: str) -> str:
    """
    Validates that the string follows is a five-digit ZIP code.
    Example: 63949
    """
    german_postal_code_pattern = r"^\d{5}$"
    if not re.match(german_postal_code_pattern, zip_code.replace(" ", "")):
        raise ValueError("German postal codes must consist of exactly five digits.")
    return zip_code


def validate_date_is_not_future(input_date: date) -> date:
    if input_date > date.today():
        raise ValueError("The date provided cannot be in the future.")
    return input_date


def validate_date_is_in_future(input_date: date) -> date:
    if input_date <= date.today():
        raise ValueError("The date provided must be in the future.")
    return input_date


# @add_new_validator
# def is_42(input_number: int) -> int:
#     if input_number == 42:
#         raise ValueError("The input number has to be 42.")
#     return input_number
