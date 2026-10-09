import json

from src.generated_views import build_view, catalog_prompt, validate_view
from src.ui_tools import SHOW_VIEW_EXAMPLE, show_view

CHECKLIST_VIEW = [
    {"id": "root", "component": "Card", "child": "content"},
    {"id": "content", "component": "Column", "children": ["title", "docs", "table", "more"]},
    {"id": "title", "component": "Text", "variant": "title", "text": "Unterlagen"},
    {
        "id": "docs",
        "component": "Checklist",
        "items": [{"label": "Mietvertrag"}, {"label": "Kontoauszüge", "hint": "3 Monate"}],
    },
    {"id": "table", "component": "Table", "columns": ["Leistung", "Für wen"], "rows": [["Wohngeld", "Mieter:innen"]]},
    {
        "id": "more",
        "component": "Chip",
        "label": "Wo beantrage ich das?",
        "action": {"event": {"name": "send_text", "context": {"text": "Wo beantrage ich Wohngeld?"}}},
    },
]


def test_valid_view_becomes_an_a2ui_surface():
    view = build_view(json.dumps(CHECKLIST_VIEW))

    assert view.errors == []
    create, update = view.a2ui_messages
    assert create["createSurface"]["surfaceId"].startswith("generated-view-")
    assert update["updateComponents"]["components"] == CHECKLIST_VIEW


def test_example_in_tool_description_is_valid():
    assert validate_view(json.loads(SHOW_VIEW_EXAMPLE)) == []


def test_unknown_component_is_rejected_with_the_allowed_list():
    errors = validate_view([{"id": "root", "component": "Iframe", "src": "https://example.com"}])

    assert len(errors) == 1
    assert "unknown component type 'Iframe'" in errors[0]
    assert "Checklist" in errors[0]


def test_unknown_and_missing_props_are_reported():
    errors = validate_view([{"id": "root", "component": "Text", "html": "<b>hi</b>"}])

    assert "component 'root': Text has no prop 'html'" in errors
    assert any("missing 'text'" in error for error in errors)


def test_only_send_text_actions_are_allowed():
    errors = validate_view(
        [
            {
                "id": "root",
                "component": "Chip",
                "label": "Los",
                "action": {"event": {"name": "start_check", "context": {}}},
            }
        ]
    )

    assert any("invalid 'action'" in error for error in errors)


def test_links_must_stay_inside_the_app():
    for href in ("https://phishing.example", "//evil.example", "javascript:alert(1)"):
        errors = validate_view([{"id": "root", "component": "Link", "label": "Weiter", "href": href}])
        assert any("invalid 'href'" in error for error in errors), href


def test_structure_errors():
    errors = validate_view(
        [
            {"id": "start", "component": "Column", "children": ["missing", "start"]},
            {"id": "start", "component": "Note", "text": "doppelt"},
        ]
    )

    assert "component ids must be unique" in errors
    assert 'one component must have the id "root"' in errors
    assert "component 'start' refers to unknown child 'missing'" in errors
    assert "component 'start' refers to itself" in errors


def test_invalid_json_and_oversized_input():
    assert "not valid JSON" in build_view("[{").errors[0]
    assert "too long" in build_view("x" * 20_001).errors[0]
    assert (
        "too many components" in validate_view([{"id": str(i), "component": "Note", "text": "x"} for i in range(61)])[0]
    )


def test_show_view_returns_errors_to_the_model_for_another_attempt():
    result = show_view(locale="de", components_json='[{"id": "root", "component": "Video"}]')

    assert result.a2ui_messages == []
    assert result.result["error"] == "view rejected"
    assert "call show_view again" in result.result["instruction"]


def test_catalog_prompt_lists_every_component():
    prompt = catalog_prompt()
    for name in ("Card", "Table", "Checklist", "Chip", "Link"):
        assert f"- {name}:" in prompt
