"""Views the model composes itself from the Klaro A2UI catalog (prompt, generate, validate)."""

import json
from dataclasses import dataclass, field
from typing import Any, Callable

from src.a2ui import new_surface

MAX_COMPONENTS = 60
MAX_TEXT_LENGTH = 600
MAX_JSON_LENGTH = 20_000


def _is_text(value: Any) -> bool:
    return isinstance(value, str) and 0 < len(value) <= MAX_TEXT_LENGTH


def _is_text_list(value: Any) -> bool:
    return isinstance(value, list) and all(_is_text(item) for item in value)


def _is_table_rows(value: Any) -> bool:
    return isinstance(value, list) and len(value) <= 30 and all(_is_text_list(row) for row in value)


def _is_checklist_items(value: Any) -> bool:
    return (
        isinstance(value, list)
        and 0 < len(value) <= 30
        and all(
            isinstance(item, dict)
            and _is_text(item.get("label"))
            and set(item) <= {"label", "hint"}
            and ("hint" not in item or _is_text(item["hint"]))
            for item in value
        )
    )


def _is_send_text_action(value: Any) -> bool:
    event = value.get("event") if isinstance(value, dict) else None
    return (
        isinstance(event, dict)
        and set(value) == {"event"}
        and event.get("name") == "send_text"
        and isinstance(event.get("context"), dict)
        and set(event["context"]) == {"text"}
        and _is_text(event["context"]["text"])
    )


def _is_internal_path(value: Any) -> bool:
    return _is_text(value) and value.startswith("/") and not value.startswith("//")


def _is_text_variant(value: Any) -> bool:
    return value in ("eyebrow", "title", "body", "muted")


def _is_spacing(value: Any) -> bool:
    return value in ("tight", "normal")


def _is_chip_variant(value: Any) -> bool:
    return value in ("solid", "outline")


@dataclass(frozen=True)
class Prop:
    check: Callable[[Any], bool]
    description: str
    required: bool = True


@dataclass(frozen=True)
class ComponentSpec:
    description: str
    props: dict[str, Prop] = field(default_factory=dict)


CHILD = Prop(lambda v: isinstance(v, str), "id of the child component")
CHILDREN = Prop(lambda v: isinstance(v, list) and all(isinstance(c, str) for c in v), "list of child component ids")

VIEW_COMPONENTS: dict[str, ComponentSpec] = {
    "Card": ComponentSpec("White card that frames a view. Use it as root.", {"child": CHILD}),
    "Column": ComponentSpec(
        "Stacks children vertically.",
        {"children": CHILDREN, "spacing": Prop(_is_spacing, '"tight" or "normal"', required=False)},
    ),
    "Row": ComponentSpec("Places children side by side and wraps.", {"children": CHILDREN}),
    "Text": ComponentSpec(
        "Plain text.",
        {
            "text": Prop(_is_text, "the text"),
            "variant": Prop(_is_text_variant, '"eyebrow", "title", "body" or "muted"', required=False),
        },
    ),
    "Fact": ComponentSpec(
        "A short label with a text below.", {"label": Prop(_is_text, "label"), "text": Prop(_is_text, "text")}
    ),
    "Note": ComponentSpec("A small highlighted remark.", {"text": Prop(_is_text, "text")}),
    "DefinitionRow": ComponentSpec(
        "Label on the left, value on the right.", {"label": Prop(_is_text, "label"), "value": Prop(_is_text, "value")}
    ),
    "Table": ComponentSpec(
        "A table for comparisons.",
        {
            "columns": Prop(_is_text_list, "list of column headings"),
            "rows": Prop(_is_table_rows, "list of rows, each a list of cell texts in column order"),
        },
    ),
    "Checklist": ComponentSpec(
        "A list the user can tick off, e.g. documents to gather.",
        {"items": Prop(_is_checklist_items, 'list of {"label": text, "hint": optional text}')},
    ),
    "Chip": ComponentSpec(
        "A button that sends a follow-up question as the user's chat message.",
        {
            "label": Prop(_is_text, "button text"),
            "action": Prop(
                _is_send_text_action, '{"event": {"name": "send_text", "context": {"text": "<message to send>"}}}'
            ),
            "variant": Prop(_is_chip_variant, '"solid" or "outline"', required=False),
        },
    ),
    "Link": ComponentSpec(
        "A link to a page in the app.",
        {"label": Prop(_is_text, "link text"), "href": Prop(_is_internal_path, 'app path, e.g. "/profile/documents"')},
    ),
}


def catalog_prompt() -> str:
    lines = []
    for name, spec in VIEW_COMPONENTS.items():
        props = ", ".join(
            f"{prop_name}{'' if prop.required else '?'}: {prop.description}" for prop_name, prop in spec.props.items()
        )
        lines.append(f"- {name}: {spec.description} Props: {props}")
    return "\n".join(lines)


def _child_ids(component: dict[str, Any]) -> list[str]:
    if "child" in component:
        return [component["child"]]
    return list(component.get("children", []))


def _component_errors(component: Any, index: int) -> list[str]:
    if not isinstance(component, dict):
        return [f"components[{index}] is not an object"]
    name = component.get("component")
    spec = VIEW_COMPONENTS.get(name)
    label = f"component '{component.get('id', index)}'"
    if spec is None:
        return [f"{label}: unknown component type {name!r}, allowed: {', '.join(VIEW_COMPONENTS)}"]
    errors = []
    for prop_name in set(component) - {"id", "component"} - set(spec.props):
        errors.append(f"{label}: {name} has no prop {prop_name!r}")
    for prop_name, prop in spec.props.items():
        if prop_name not in component:
            if prop.required:
                errors.append(f"{label}: missing {prop_name!r} ({prop.description})")
        elif not prop.check(component[prop_name]):
            errors.append(f"{label}: invalid {prop_name!r}, expected {prop.description}")
    return errors


def validate_view(components: Any) -> list[str]:
    """Returns readable errors so the model can fix its view, or an empty list."""
    if not isinstance(components, list) or not components:
        return ["components must be a non-empty list"]
    if len(components) > MAX_COMPONENTS:
        return [f"too many components ({len(components)}), at most {MAX_COMPONENTS}"]

    errors = [error for index, component in enumerate(components) for error in _component_errors(component, index)]
    if errors:
        return errors

    ids = [component.get("id") for component in components]
    if any(not isinstance(component_id, str) or not component_id for component_id in ids):
        errors.append("every component needs a non-empty string id")
    if len(set(ids)) != len(ids):
        errors.append("component ids must be unique")
    if "root" not in ids:
        errors.append('one component must have the id "root"')
    known = set(ids)
    for component in components:
        for child_id in _child_ids(component):
            if child_id not in known:
                errors.append(f"component '{component['id']}' refers to unknown child '{child_id}'")
            elif child_id == component["id"]:
                errors.append(f"component '{component['id']}' refers to itself")
    return errors


@dataclass
class ViewResult:
    a2ui_messages: list[dict[str, Any]]
    errors: list[str]


def build_view(components_json: str) -> ViewResult:
    if len(components_json) > MAX_JSON_LENGTH:
        return ViewResult([], [f"components_json is too long, at most {MAX_JSON_LENGTH} characters"])
    try:
        components = json.loads(components_json)
    except json.JSONDecodeError as error:
        return ViewResult([], [f"components_json is not valid JSON: {error}"])
    errors = validate_view(components)
    if errors:
        return ViewResult([], errors)
    return ViewResult(new_surface("generated-view", components), [])
