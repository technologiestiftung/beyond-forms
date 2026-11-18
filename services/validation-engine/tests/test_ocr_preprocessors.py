import decimal
import datetime
import pytest

from app.validators.ocr_preprocessors import (
    clean_decimal_string,
    parse_date_string,
    normalize_gender_string,
)
from app.domain.field_types import CoercedDate, CoercedPastDate
from pydantic import BaseModel, ValidationError


@pytest.mark.parametrize(
    "input_val, expected",
    [
        ("430,00", decimal.Decimal("430.00")),
        ("430,50 €", decimal.Decimal("430.50")),
        ("EUR 1.200,99", decimal.Decimal("1200.99")),
        ("1,200.50", decimal.Decimal("1200.50")),  # US / International Format
        ("430,-", decimal.Decimal("430.00")),
        ("430,--", decimal.Decimal("430.00")),
        ("  -430,50  ", decimal.Decimal("-430.50")),
        (430.5, decimal.Decimal("430.50")),
        (decimal.Decimal("430.50"), decimal.Decimal("430.50")),
        ("", None),
        (None, None),
        ("invalid_numeric_string", None),
    ],
)
def test_clean_decimal_string(input_val, expected):
    assert clean_decimal_string(input_val) == expected


@pytest.mark.parametrize(
    "input_val, expected",
    [
        ("1959-05-01", datetime.date(1959, 5, 1)),
        ("01.05.1959", datetime.date(1959, 5, 1)),
        (" 01 . 05 . 1959 ", " 01 . 05 . 1959 "),
        ("01/05/1959", datetime.date(1959, 5, 1)),
        ("1959/05/01", datetime.date(1959, 5, 1)),
        (datetime.date(1959, 5, 1), datetime.date(1959, 5, 1)),
        ("", ""),
        (None, None),
        ("invalid_date", "invalid_date"),
    ],
)
def test_parse_date_string(input_val, expected):
    assert parse_date_string(input_val) == expected


# Test Pydantic integration and validation triggers
def test_pydantic_date_before_validators():
    class DateModel(BaseModel):
        dob: CoercedDate
        past_dob: CoercedPastDate | None = None

    # Verify DD.MM.YYYY is parsed successfully by BeforeValidator
    model = DateModel(dob="20.01.1959")
    assert model.dob == datetime.date(1959, 1, 20)

    # Verify future dates raise ValidationError via pydantic's PastDate
    with pytest.raises(ValidationError) as exc:
        DateModel(dob="20.01.1959", past_dob="2035-01-01")
    assert "Date should be in the past" in str(exc.value)


@pytest.mark.parametrize(
    "input_val, expected",
    [
        ("M", "MALE"),
        ("male", "MALE"),
        ("F", "FEMALE"),
        ("female", "FEMALE"),
        ("D", "NON_BINARY"),
        ("diverse", "NON_BINARY"),
        ("non_binary", "NON_BINARY"),
        ("<", "<"),
        ("", ""),
        (None, None),
        ("invalid", "invalid"),
    ],
)
def test_normalize_gender_string(input_val, expected):
    assert normalize_gender_string(input_val) == expected
