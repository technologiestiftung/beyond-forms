import re
from datetime import date
from phonenumbers import parse, is_possible_number, format_number, PhoneNumberFormat


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
    """
    parsed_number = parse(phone_number)
    if not is_possible_number(parsed_number):
        raise ValueError("Phone number is impossible")
    return format_number(parsed_number, PhoneNumberFormat.E164)


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
