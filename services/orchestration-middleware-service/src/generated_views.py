"""Views the model composes itself from a small set of app components (prompt, generate, validate)."""

import json
from dataclasses import dataclass, field
from typing import Any, Callable

MAX_COMPONENTS = 60
MAX_DEPTH = 4
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


def _is_children(value: Any) -> bool:
    return isinstance(value, list) and len(value) > 0


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


CHILDREN = Prop(_is_children, "non-empty list of components")

VIEW_COMPONENTS: dict[str, ComponentSpec] = {
    "Column": ComponentSpec(
        "Stacks children vertically.",
        {"children": CHILDREN, "spacing": Prop(_is_spacing, '"tight" or "normal"', required=False)},
    ),
    "Row": ComponentSpec("Places children side by side and wraps, e.g. several Chips.", {"children": CHILDREN}),
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
            "sendText": Prop(_is_text, "the message sent when the user taps it"),
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


def _count_components(components: list[Any]) -> int:
    return sum(
        1 + _count_components(c["children"]) if isinstance(c, dict) and _is_children(c.get("children")) else 1
        for c in components
    )


def _component_errors(component: Any, path: str, depth: int) -> list[str]:
    if not isinstance(component, dict):
        return [f"{path} is not an object"]
    name = component.get("component")
    spec = VIEW_COMPONENTS.get(name)
    if spec is None:
        return [f"{path}: unknown component type {name!r}, allowed: {', '.join(VIEW_COMPONENTS)}"]
    errors = [
        f"{path}: {name} has no prop {prop_name!r}" for prop_name in set(component) - {"component"} - set(spec.props)
    ]
    for prop_name, prop in spec.props.items():
        if prop_name not in component:
            if prop.required:
                errors.append(f"{path}: missing {prop_name!r} ({prop.description})")
        elif not prop.check(component[prop_name]):
            errors.append(f"{path}: invalid {prop_name!r}, expected {prop.description}")
    if "children" in spec.props and _is_children(component.get("children")):
        if depth >= MAX_DEPTH:
            errors.append(f"{path}: nested too deeply, at most {MAX_DEPTH} levels")
        else:
            errors.extend(
                error
                for index, child in enumerate(component["children"])
                for error in _component_errors(child, f"{path}.children[{index}]", depth + 1)
            )
    return errors


def validate_view(components: Any) -> list[str]:
    """Returns readable errors so the model can fix its view, or an empty list."""
    if not _is_children(components):
        return ["components must be a non-empty list"]
    count = _count_components(components)
    if count > MAX_COMPONENTS:
        return [f"too many components ({count}), at most {MAX_COMPONENTS}"]
    return [
        error
        for index, component in enumerate(components)
        for error in _component_errors(component, f"components[{index}]", 1)
    ]


@dataclass
class ViewResult:
    components: list[dict[str, Any]]
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
    return ViewResult(components, [])
