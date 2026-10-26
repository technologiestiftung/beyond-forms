import json

from src.a2ui import A2UI_VERSION, KLARO_CATALOG_ID, consent_surface
from src.ui_tools import (
    UI_TOOL_HANDLERS,
    UI_TOOLS,
    guided_check_prompt,
    record_eligibility_answer,
    start_eligibility_check,
)
from src.utils import ndjson_a2ui, ndjson_eligibility_answer


def test_consent_surface_creates_a_surface_and_its_components():
    create, update = consent_surface("de")

    surface_id = create["createSurface"]["surfaceId"]
    assert create == {
        "version": A2UI_VERSION,
        "createSurface": {"surfaceId": surface_id, "catalogId": KLARO_CATALOG_ID},
    }
    assert update["updateComponents"]["surfaceId"] == surface_id
    components = {c["id"]: c for c in update["updateComponents"]["components"]}
    assert components["root"]["component"] == "Card"
    assert components["start"]["action"] == {"event": {"name": "start_check", "context": {}}}


def test_consent_surface_follows_locale_with_german_fallback():
    def title(locale):
        return consent_surface(locale)[1]["updateComponents"]["components"][2]["text"]

    assert title("en") == "Let's find out which support fits you"
    assert title("fr") == title("de")


def test_each_consent_surface_gets_its_own_id():
    assert consent_surface("de")[0] != consent_surface("de")[0]


def test_start_eligibility_check_streams_the_consent_surface():
    result = start_eligibility_check(locale="de")
    assert len(result.a2ui_messages) == 2
    assert result.answer is None


def test_record_eligibility_answer_returns_a_data_event():
    result = record_eligibility_answer(locale="de", field="monthlyWarmRent", value="650")
    assert result.answer == {"field": "monthlyWarmRent", "value": "650"}
    assert result.a2ui_messages == []


def test_record_eligibility_answer_rejects_unknown_field():
    result = record_eligibility_answer(locale="de", field="salary", value="1000")
    assert result.answer is None
    assert "error" in result.result


def test_ndjson_events():
    assert json.loads(ndjson_a2ui({"deleteSurface": {"surfaceId": "x"}})) == {
        "type": "a2ui",
        "message": {"deleteSurface": {"surfaceId": "x"}},
    }
    assert json.loads(ndjson_eligibility_answer("isEmployed", "YES")) == {
        "type": "eligibility_answer",
        "field": "isEmployed",
        "value": "YES",
    }


def test_guided_check_prompt_names_current_field():
    assert "`assetsBand`" in guided_check_prompt("assetsBand")
    assert "currently shown" not in guided_check_prompt(None)


def test_ui_tools_are_named_like_their_handlers():
    names = {tool["function"]["name"] for tool in UI_TOOLS}
    assert names == set(UI_TOOL_HANDLERS)
