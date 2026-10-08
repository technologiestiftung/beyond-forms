import json

from src.ui_tools import (
    UI_TOOLS,
    guided_check_prompt,
    record_eligibility_answer,
    start_eligibility_check,
)
from src.utils import ndjson_ui


def test_start_eligibility_check_shows_consent_card():
    result = start_eligibility_check()
    assert result.component == "eligibility_consent"
    assert result.props == {}


def test_record_eligibility_answer_emits_answer_event():
    result = record_eligibility_answer(field="monthlyWarmRent", value="650")
    assert result.component == "eligibility_answer"
    assert result.props == {"field": "monthlyWarmRent", "value": "650"}


def test_record_eligibility_answer_rejects_unknown_field():
    result = record_eligibility_answer(field="salary", value="1000")
    assert result.component is None
    assert "error" in result.result


def test_ndjson_ui_serialises_component_and_props():
    line = ndjson_ui("eligibility_answer", {"field": "isEmployed", "value": "YES"})
    assert line.endswith("\n")
    assert json.loads(line) == {
        "type": "ui",
        "component": "eligibility_answer",
        "props": {"field": "isEmployed", "value": "YES"},
    }


def test_guided_check_prompt_names_current_field():
    assert "`assetsBand`" in guided_check_prompt("assetsBand")
    assert "currently shown" not in guided_check_prompt(None)


def test_ui_tools_are_named_like_their_handlers():
    names = {tool["function"]["name"] for tool in UI_TOOLS}
    assert names == {"start_eligibility_check", "record_eligibility_answer"}
