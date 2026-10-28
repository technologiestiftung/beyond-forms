import datetime
import decimal

import pytest

from src.chat_cards import build_card_view, card_inputs, card_prompt, validate_card_answer
from src.models import AccomodationType, IncomeEntries, IncomeTypeType, Users
from src.schemas import UserProfileValidationSchema
from src.services.wizard_rules import RULES_PATH, application_start_step, evaluation_payload, rules_steps

pytestmark = pytest.mark.skipif(not RULES_PATH.exists(), reason="rules file is not part of this checkout")

# The rules engine skips these on its own (`is_field_required`).
OPTIONAL_FIELDS = (".birth_name", ".applicant_last_resided_address")


def _card_steps() -> dict:
    return {step_id: step for step_id, step in rules_steps().items() if step.get("columns")}


def _args(step_id: str) -> dict:
    inputs = card_inputs(rules_steps()[step_id])
    return {
        "card_id": step_id,
        "question": "Frage?",
        "labels": {i.key: f"Label {i.key}" for i in inputs},
        "option_labels": {
            i.key: {("true" if o is True else "false" if o is False else str(o)): f"Option {o}" for o in i.options}
            for i in inputs
            if i.options
        },
    }


def test_columns_name_profile_columns_or_income_types():
    columns = set(Users.__table__.columns.keys())
    accepted = set(UserProfileValidationSchema.model_fields)
    income_types = {t.value for t in IncomeTypeType}
    unknown = [
        (step_id, entry)
        for step_id, step in _card_steps().items()
        for entry in step["columns"]
        if ("column" in entry and not (entry["column"] in columns and entry["column"] in accepted))
        or ("income_type" in entry and entry["income_type"] not in income_types)
    ]
    assert unknown == []


def test_every_required_field_of_a_card_step_is_answered_by_a_column():
    unanswered = [
        (step_id, field)
        for step_id, step in _card_steps().items()
        for field in step["fields"]
        if not field.endswith(OPTIONAL_FIELDS) and field not in {e.get("field") for e in step["columns"]}
    ]
    assert unanswered == []


def test_the_application_starts_after_the_eligibility_check():
    assert application_start_step() == "step_applicant_name"


def test_inputs_follow_the_column_types_and_the_rules_overrides():
    kinds = {
        step_id: {i.key: (i.kind, i.options, i.options_source) for i in card_inputs(rules_steps()[step_id])}
        for step_id in (
            "step_applicant_accommodation_costs",
            "step_applicant_legal_support",
            "step_applicant_nationality",
            "step_applicant_heating",
            "step_applicant_gender",
        )
    }
    assert kinds["step_applicant_accommodation_costs"]["rent_total"] == ("amount", (), None)
    assert kinds["step_applicant_legal_support"]["has_custodian"] == ("choice", (True, False), None)
    assert kinds["step_applicant_nationality"]["nationality"] == ("select", (), "countries")
    assert kinds["step_applicant_heating"]["heating_type"][1][0] == "Sammelheizung"
    assert kinds["step_applicant_gender"]["legal_gender"][1] == ("Male", "Female", "Diverse")


def test_income_lines_become_optional_amounts():
    inputs = card_inputs(rules_steps()["step_applicant_pension"])
    assert [(i.key, i.kind, i.optional, i.income_type) for i in inputs] == [
        ("old_age_pension", "amount", True, "Old-Age Pension"),
        ("reduced_earning_capacity_pension", "amount", True, "Reduced Earning Capacity Pension"),
        ("survivor_pension", "amount", True, "Survivor Pension"),
    ]


def test_card_prompt_names_the_card_and_its_input_keys():
    prompt = card_prompt("step_applicant_legal_support", rules_steps()["step_applicant_legal_support"])
    assert 'card_id "step_applicant_legal_support"' in prompt
    assert '"has_custodian": choice; option_labels keys: true, false' in prompt


def test_build_card_view_puts_the_texts_on_the_fixed_inputs():
    view, errors = build_card_view(
        "step_applicant_legal_support",
        rules_steps()["step_applicant_legal_support"],
        _args("step_applicant_legal_support"),
    )

    assert errors == []
    assert view["card_id"] == "step_applicant_legal_support"
    assert view["inputs"][0] == {
        "field": "has_custodian",
        "kind": "choice",
        "label": "Label has_custodian",
        "options": [{"value": True, "label": "Option True"}, {"value": False, "label": "Option False"}],
    }


def test_build_card_view_reports_missing_texts():
    args = _args("step_applicant_legal_support")
    del args["labels"]["has_guardian"]
    del args["option_labels"]["has_custodian"]["false"]

    view, errors = build_card_view("step_applicant_legal_support", rules_steps()["step_applicant_legal_support"], args)

    assert view is None
    assert "labels.has_guardian must be a text of 1 to 300 characters" in errors
    assert "option_labels.has_custodian.false must be a text of 1 to 300 characters" in errors


def test_a_country_select_needs_no_option_labels():
    view, errors = build_card_view(
        "step_applicant_nationality", rules_steps()["step_applicant_nationality"], _args("step_applicant_nationality")
    )
    assert errors == []
    nationality = next(i for i in view["inputs"] if i["field"] == "nationality")
    assert nationality == {
        "field": "nationality",
        "kind": "select",
        "label": "Label nationality",
        "options_source": "countries",
    }


def test_validate_card_answer_accepts_the_card_values():
    payload, errors = validate_card_answer(
        rules_steps()["step_applicant_accommodation_costs"],
        {"rent_total": 520, "heating_costs": 80.5, "hot_water_costs": 20, "cable_tv_costs": 0},
    )
    assert errors == []
    assert payload.model_dump(exclude_unset=True)["rent_total"] == 520


@pytest.mark.parametrize(
    "values, error",
    [
        ({"rent_total": 520, "heating_costs": 80, "hot_water_costs": 20}, "cable_tv_costs is missing"),
        ({"iban": "DE00"}, "iban is not part of this card"),
        ({"rent_total": -5}, "invalid value for rent_total"),
        ({"rent_total": "viel"}, "invalid value for rent_total"),
        ("520", "values must be an object"),
    ],
)
def test_validate_card_answer_rejects_missing_foreign_or_malformed_values(values, error):
    payload, errors = validate_card_answer(rules_steps()["step_applicant_accommodation_costs"], values)
    assert payload is None
    assert error in errors


def test_validate_card_answer_only_accepts_offered_options():
    step = rules_steps()["step_applicant_gender"]
    assert validate_card_answer(step, {"legal_gender": "Female"})[1] == []
    assert validate_card_answer(step, {"legal_gender": "Other"})[1] == ["invalid value for legal_gender"]


def test_validate_card_answer_stores_empty_income_lines_as_zero():
    payload, errors = validate_card_answer(rules_steps()["step_applicant_pension"], {"old_age_pension": 650})

    assert errors == []
    rows = {row.income_type.value: row.monthly_amount for row in payload.income_entries}
    assert rows == {"Old-Age Pension": 650, "Reduced Earning Capacity Pension": 0, "Survivor Pension": 0}


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
