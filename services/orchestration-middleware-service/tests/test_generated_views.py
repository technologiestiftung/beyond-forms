import json

from src.generated_views import build_view, catalog_prompt, validate_view
from src.ui_tools import SHOW_VIEW_EXAMPLE, show_view

CHECKLIST_VIEW = [
    {"component": "Text", "variant": "title", "text": "Unterlagen"},
    {"component": "Checklist", "items": [{"label": "Mietvertrag"}, {"label": "Kontoauszüge", "hint": "3 Monate"}]},
    {"component": "Table", "columns": ["Leistung", "Für wen"], "rows": [["Wohngeld", "Mieter:innen"]]},
    {
        "component": "Row",
        "children": [{"component": "Chip", "label": "Wo beantrage ich das?", "sendText": "Wo beantrage ich Wohngeld?"}],
    },
]


def test_valid_view_is_passed_on_unchanged():
    view = build_view(json.dumps(CHECKLIST_VIEW))

    assert view.errors == []
    assert view.components == CHECKLIST_VIEW


def test_example_in_tool_description_is_valid():
    assert validate_view(json.loads(SHOW_VIEW_EXAMPLE)) == []


def test_unknown_component_is_rejected_with_the_allowed_list():
    errors = validate_view([{"component": "Iframe", "src": "https://example.com"}])

    assert len(errors) == 1
    assert "unknown component type 'Iframe'" in errors[0]
    assert "Checklist" in errors[0]


def test_unknown_and_missing_props_are_reported():
    errors = validate_view([{"component": "Text", "html": "<b>hi</b>"}])

    assert "components[0]: Text has no prop 'html'" in errors
    assert any("missing 'text'" in error for error in errors)


def test_errors_in_children_name_their_path():
    errors = validate_view([{"component": "Row", "children": [{"component": "Chip", "label": "Los"}]}])

    assert errors == ["components[0].children[0]: missing 'sendText' (the message sent when the user taps it)"]


def test_links_must_stay_inside_the_app():
    for href in ("https://phishing.example", "//evil.example", "javascript:alert(1)"):
        errors = validate_view([{"component": "Link", "label": "Weiter", "href": href}])
        assert any("invalid 'href'" in error for error in errors), href


def test_nesting_is_limited():
    view = {"component": "Note", "text": "tief"}
    for _ in range(4):
        view = {"component": "Column", "children": [view]}

    assert any("nested too deeply" in error for error in validate_view([view]))


def test_invalid_json_and_oversized_input():
    assert "not valid JSON" in build_view("[{").errors[0]
    assert "too long" in build_view("x" * 20_001).errors[0]
    assert "too many components" in validate_view([{"component": "Note", "text": "x"} for _ in range(61)])[0]
    assert (
        "too many components"
        in validate_view([{"component": "Row", "children": [{"component": "Note", "text": "x"}] * 30}] * 2)[0]
    )


def test_show_view_emits_the_view_as_ui_event():
    result = show_view(components_json=json.dumps(CHECKLIST_VIEW))

    assert result.component == "generated_view"
    assert result.props == {"components": CHECKLIST_VIEW}


def test_show_view_returns_errors_to_the_model_for_another_attempt():
    result = show_view(components_json='[{"component": "Video"}]')

    assert result.component is None
    assert result.result["error"] == "view rejected"
    assert "call show_view again" in result.result["instruction"]


def test_catalog_prompt_lists_every_component():
    prompt = catalog_prompt()
    for name in ("Column", "Table", "Checklist", "Chip", "Link"):
        assert f"- {name}:" in prompt
