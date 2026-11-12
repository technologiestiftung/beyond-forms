from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from src.chat_cards import CardInput, asked_in_chat, build_inputs_view, input_errors, inputs_prompt
from src.routes.llm import _card_view, save_answer

GUARDIAN = CardInput("p1_guardian", "choice", (True, False), about="es besteht eine Betreuung")
STATUS = CardInput("answer", "choice", ("0", "2"), about="Familienstand", option_about=("ledig", "verheiratet"))
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
    assert not asked_in_chat([STREET, STATUS])
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
    view, errors = build_inputs_view("form:test_form:p1_group", [GUARDIAN, SINCE], _args([GUARDIAN, SINCE]))

    assert errors == []
    assert view["inputs"] == [
        {
            "field": "p1_guardian",
            "kind": "choice",
            "label": "Label p1_guardian",
            "options": [{"value": True, "label": "Option True"}, {"value": False, "label": "Option False"}],
        },
        {"field": "p1_since", "kind": "date", "label": "Label p1_since", "optional": True},
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


def test_input_errors_trim_text_and_skip_a_left_out_or_blank_optional_value():
    values, errors = input_errors([STREET, SINCE, RENT], {"p1_street": " Hauptstr. 4 ", "p1_rent": 430.87})
    assert errors == []
    assert values == {"p1_street": "Hauptstr. 4", "p1_rent": 430.87}
    values, errors = input_errors([STREET, SINCE, RENT], {"p1_street": "Hauptstr. 4", "p1_rent": 1, "p1_since": " "})
    assert errors == [] and values["p1_since"] is None


def test_a_card_for_a_question_asked_in_the_chat_is_refused():
    call = {"function": {"arguments": '{"card_id": "form:test_form:p1_street", "question": "Wo?", "labels": {}}'}}
    view, error = _card_view(call, "form:test_form:p1_street", [STREET], already_shown=False)
    assert view is None and "save_answer" in error


@pytest.mark.asyncio
async def test_save_answer_saves_through_the_card_path_as_a_chat_question():
    with patch("src.routes.llm._save_form_card_answer", AsyncMock()) as save:
        result = await save_answer(
            "form:test_form:p1_street", {"p1_street": "Hauptstr. 4"}, MagicMock(), MagicMock(), None
        )
    assert result == {"card_id": "form:test_form:p1_street", "saved": {"p1_street": "Hauptstr. 4"}}
    assert save.call_args.args[3:] == ("form:test_form:p1_street", {"p1_street": "Hauptstr. 4"})
    assert save.call_args.kwargs == {"in_chat": True}


@pytest.mark.asyncio
async def test_save_answer_hands_a_refusal_back_to_the_model():
    refused = HTTPException(status_code=422, detail="show its card instead")
    with patch("src.routes.llm._save_form_card_answer", AsyncMock(side_effect=refused)):
        result = await save_answer("form:test_form:p1_guardian", {"p1_guardian": True}, MagicMock(), MagicMock(), None)
    assert result == {"error": "show its card instead"}
