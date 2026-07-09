from decimal import Decimal
from beyondforms.document_schemas.document_types import (
    parse_robust_decimal,
    SocialBenefitsProof,
    WageSlips,
)


def test_parse_robust_decimal_german_format():
    assert parse_robust_decimal("1.892,00 €") == Decimal("1892.00")
    assert parse_robust_decimal("1.892,00") == Decimal("1892.00")
    assert parse_robust_decimal("  1.892,00 €  ") == Decimal("1892.00")


def test_parse_robust_decimal_us_format():
    assert parse_robust_decimal("1,892.00") == Decimal("1892.00")
    assert parse_robust_decimal("1892.00") == Decimal("1892.00")


def test_parse_robust_decimal_simple_comma():
    assert parse_robust_decimal("1892,00") == Decimal("1892.00")


def test_parse_robust_decimal_invalid():
    assert parse_robust_decimal("invalid") == Decimal("0")
    assert parse_robust_decimal("") == Decimal("0")
    assert parse_robust_decimal(None) is None


def test_parse_robust_decimal_numeric():
    assert parse_robust_decimal(1892) == Decimal("1892")
    assert parse_robust_decimal(1892.00) == Decimal("1892.00")
    assert parse_robust_decimal(Decimal("1892.00")) == Decimal("1892.00")


def test_social_benefits_proof_validation():
    data = {
        "description": "Social benefits proof",
        "benefit_type": "Kindergeld",
        "payment_periods": [{"monthly_amount": "1.892,00 €"}],
    }
    proof = SocialBenefitsProof(**data)
    assert proof.payment_periods[0].monthly_amount == Decimal("1892.00")


def test_social_benefits_proof_validation_invalid():
    data = {
        "description": "Social benefits proof",
        "benefit_type": "Kindergeld",
        "payment_periods": [{"monthly_amount": "invalid"}],
    }
    proof = SocialBenefitsProof(**data)
    assert proof.payment_periods[0].monthly_amount == Decimal("0")


def test_wage_slips_validation():
    data = {
        "description": "Wage slip",
        "net_amount": "2.829,07 EUR",
        "pay_period": "2026-04",
    }
    slip = WageSlips(**data)
    assert slip.net_amount == Decimal("2829.07")
