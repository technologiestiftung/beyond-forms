import datetime
import decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.chat_cards import CardInput, asked_in_chat, build_inputs_view, input_errors, inputs_prompt
from src.models import AccomodationType, IncomeEntries, IncomeTypeType, Users
from src.routes.llm import _card_view, save_answer
from src.services.wizard_rules import evaluation_payload

GUARDIAN = CardInput("p1_guardian", "choice", (True, False), about="es besteht eine Betreuung")
STATUS = CardInput("answer", "choice", ("0", "2"), about="Familienstand", option_about=("ledig", "verheiratet"))
COUNTRY = CardInput("p1_country", "select", options_source="countries")
STREET = CardInput("p1_street", "text", about="Straße")
SINCE = CardInput("p1_since", "date", optional=True, about="verheiratet seit")
RENT = CardInput("p1_rent", "amount", about="Miete")


def _args(inputs: list[CardInput], **overrides) -> dict:
    args = {
        "card_id": "form:test_form:p1_group",
        "question": "Frage?",
        "labels": {i.key: f"Label {i.key}" for i in inputs},
        "option_labels": {
            i.key: {("true" if o is True else "false" if o is False else str(o)): f"Option {o}" for o in i.options}
            for i in inputs
            if i.options
        },
    }
    return {**args, **overrides}


def test_a_card_is_used_where_there_are_options_to_pick():
    assert not asked_in_chat([GUARDIAN])
    assert not asked_in_chat([STREET, COUNTRY])
    assert asked_in_chat([STREET, SINCE, RENT])


def test_the_card_prompt_names_the_card_and_its_option_keys():
    prompt = inputs_prompt("form:test_form:p1_status", "Familienstand", [STATUS])
    assert 'Next card: card_id "form:test_form:p1_status"' in prompt and "show_card" in prompt
    assert '"answer": choice; option_labels keys: 0 (ledig), 2 (verheiratet)' in prompt


def test_free_inputs_are_asked_in_the_chat_with_the_format_per_key():
    prompt = inputs_prompt("form:test_form:p1_married", "Ehe", [STREET, SINCE, RENT])
    assert 'Next question: card_id "form:test_form:p1_married"' in prompt
    assert "save_answer" in prompt and "show_card" not in prompt
    assert '- "p1_since": a date as YYYY-MM-DD (optional) - verheiratet seit' in prompt
    assert '- "p1_rent": a number - Miete' in prompt


def test_build_inputs_view_puts_the_texts_on_the_inputs():
    view, errors = build_inputs_view("form:test_form:p1_group", [GUARDIAN, COUNTRY], _args([GUARDIAN, COUNTRY]))

    assert errors == []
    assert view["inputs"] == [
        {
            "field": "p1_guardian",
            "kind": "choice",
            "label": "Label p1_guardian",
            "options": [{"value": True, "label": "Option True"}, {"value": False, "label": "Option False"}],
        },
        # a country select needs no option labels
        {"field": "p1_country", "kind": "select", "label": "Label p1_country", "options_source": "countries"},
    ]


def test_build_inputs_view_reports_missing_texts():
    args = _args([GUARDIAN, STATUS])
    del args["labels"]["p1_guardian"]
    del args["option_labels"]["answer"]["2"]

    view, errors = build_inputs_view("form:test_form:p1_group", [GUARDIAN, STATUS], args)

    assert view is None
    assert "labels.p1_guardian must be a text of 1 to 255 characters" in errors
    assert "option_labels.answer.2 must be a text of 1 to 255 characters" in errors


@pytest.mark.parametrize(
    "values, error",
    [
        ({"p1_rent": 500}, "p1_street is missing"),
        ({"p1_street": "Hauptstr.", "p1_rent": 500, "p1_iban": "DE00"}, "p1_iban is not part of this card"),
        ({"p1_street": "Hauptstr.", "p1_rent": "500"}, "invalid value for p1_rent"),
        ({"p1_street": "Hauptstr.", "p1_rent": 500, "p1_since": "31.01.2000"}, "invalid value for p1_since"),
        ({"p1_street": "   ", "p1_rent": 500}, "invalid value for p1_street"),
        ("Hauptstr.", "values must be an object"),
    ],
)
def test_input_errors_reject_missing_foreign_and_malformed_values(values, error):
    _values, errors = input_errors([STREET, SINCE, RENT], values)
    assert error in errors


def test_input_errors_trim_text_and_accept_a_left_out_optional_value():
    values, errors = input_errors([STREET, SINCE, RENT], {"p1_street": " Hauptstr. 4 ", "p1_rent": 430.87})
    assert errors == []
    assert values == {"p1_street": "Hauptstr. 4", "p1_rent": 430.87}


def test_a_card_for_a_question_asked_in_the_chat_is_refused():
    call = {"function": {"arguments": '{"card_id": "form:test_form:p1_street", "question": "Wo?", "labels": {}}'}}
    view, error = _card_view(call, "form:test_form:p1_street", [STREET], already_shown=False)
    assert view is None and "save_answer" in error


@pytest.mark.asyncio
async def test_save_answer_saves_the_values_like_a_card_and_skips_empty_optional_ones():
    with (
        patch("src.routes.llm._card_inputs", AsyncMock(return_value=[STREET, SINCE])),
        patch("src.routes.llm._save_card_answer", AsyncMock(return_value='{"saved": {}}')) as save,
    ):
        await save_answer(
            "form:test_form:p1_married", {"p1_street": "Hauptstr. 4", "p1_since": " "}, MagicMock(), MagicMock(), None
        )
    assert save.call_args.args[4] == '{"values": {"p1_street": "Hauptstr. 4", "p1_since": null}}'


@pytest.mark.asyncio
async def test_save_answer_refuses_a_question_that_has_a_card():
    with patch("src.routes.llm._card_inputs", AsyncMock(return_value=[GUARDIAN])):
        result = await save_answer("form:test_form:p1_guardian", {"p1_guardian": True}, MagicMock(), MagicMock(), None)
    assert "show its card instead" in result["error"]


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
