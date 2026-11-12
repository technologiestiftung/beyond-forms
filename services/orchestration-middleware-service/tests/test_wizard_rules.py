import datetime
import decimal

import pytest

from src.models import AccomodationType, IncomeEntries, IncomeTypeType, Users
from src.services.wizard_rules import RULES_PATH, evaluation_payload

pytestmark = pytest.mark.skipif(not RULES_PATH.exists(), reason="rules file is not part of this checkout")


def test_evaluation_payload_holds_the_stored_values_at_the_rule_fields():
    user = Users(
        first_name="Helmut",
        date_of_birth=datetime.date(1947, 2, 14),
        accomodation_type=AccomodationType.RENTAL_APARTMENT,
        rent_total=decimal.Decimal("520.00"),
    )

    payload = evaluation_payload(user)

    assert payload["applicant_information"]["applicant_personal_details"]["first_name"] == "Helmut"
    assert payload["applicant_information"]["applicant_personal_details"]["date_of_birth"] == "1947-02-14"
    assert payload["applicant_accommodation"]["applicant_accommodation_type"] == "Rental Apartment"
    assert payload["applicant_accommodation"]["applicant_rent_total"] == 520.0
    assert "applicant_landlord_name" not in payload["applicant_accommodation"]


def test_evaluation_payload_adds_up_income_rows_and_keeps_unanswered_lines_missing():
    user = Users(
        income_entries=[
            IncomeEntries(income_type=IncomeTypeType.OLD_AGE_PENSION, monthly_amount=decimal.Decimal("400")),
            IncomeEntries(income_type=IncomeTypeType.SURVIVOR_PENSION, monthly_amount=decimal.Decimal("200")),
            IncomeEntries(income_type=IncomeTypeType.ALIMONY, monthly_amount=decimal.Decimal("0")),
        ]
    )

    income = evaluation_payload(user)["income_information"]["income_information_applicant"]["income_applicant_details"]

    assert income["income_pension"] == 600.0
    assert income["income_alimony"] == 0.0
    assert "income_rental_income" not in income
