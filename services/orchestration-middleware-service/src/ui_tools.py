import json
from typing import Any

from pydantic import BaseModel

from src.a2ui import consent_surface
from src.generated_views import build_view, catalog_prompt

ELIGIBILITY_FIELDS: dict[str, str] = {
    "householdComposition": "SINGLE, SINGLE_PARENT, COUPLE_NO_CHILDREN or COUPLE_WITH_CHILDREN",
    "dateOfBirth": "date of birth as YYYY-MM-DD",
    "livesInGermany": "YES or NO",
    "isEmployed": "YES or NO",
    "monthlyGrossIncome": "monthly gross earnings of the household in whole euros",
    "workCapacity": "FULL, TEMPORARILY_REDUCED or PERMANENTLY_REDUCED (able to work at least three hours a day)",
    "monthlyNetHouseholdIncome": "monthly net income of the household in whole euros",
    "monthlyWarmRent": "monthly warm rent in whole euros",
    "assetsBand": "UNDER_5000, FROM_5000_TO_10000, FROM_10000_TO_12500, FROM_12500_TO_20000 or OVER_20000",
    "receivesBenefits": "YES or NO (already receives a social benefit)",
    "citizenship": "GERMAN, EU or NON_EU",
    "hasSecureResidenceStatus": "YES or NO",
}


class UiToolResult(BaseModel):
    """What a UI tool streams to the client: A2UI messages and, for answers, a data event."""

    a2ui_messages: list[dict[str, Any]] = []
    answer: dict[str, str] | None = None
    result: dict[str, Any]


def start_eligibility_check(locale: str) -> UiToolResult:
    return UiToolResult(
        a2ui_messages=consent_surface(locale),
        result={
            "status": "consent card shown",
            "instruction": "Introduce the check in one short sentence. Do not ask the questions yourself, the app shows them as cards.",
        },
    )


def record_eligibility_answer(locale: str, field: str, value: str) -> UiToolResult:
    if field not in ELIGIBILITY_FIELDS:
        return UiToolResult(result={"error": f"Unknown field: {field}"})
    return UiToolResult(
        answer={"field": field, "value": value},
        result={
            "status": "saved as provisional",
            "instruction": "The user confirms provisional answers at the end. Do not ask for this value again.",
        },
    )


def show_view(locale: str, components_json: str) -> UiToolResult:
    view = build_view(components_json)
    if view.errors:
        return UiToolResult(
            result={
                "error": "view rejected",
                "errors": view.errors,
                "instruction": "Fix these problems and call show_view again.",
            }
        )
    return UiToolResult(
        a2ui_messages=view.a2ui_messages,
        result={
            "status": "view shown",
            "instruction": "The user sees the view below your message. Add at most one short sentence, do not repeat its content.",
        },
    )


UI_TOOL_HANDLERS = {
    "start_eligibility_check": start_eligibility_check,
    "record_eligibility_answer": record_eligibility_answer,
    "show_view": show_view,
}

SHOW_VIEW_EXAMPLE = json.dumps(
    [
        {"id": "root", "component": "Card", "child": "content"},
        {"id": "content", "component": "Column", "children": ["title", "list"]},
        {"id": "title", "component": "Text", "variant": "title", "text": "Unterlagen für Wohngeld"},
        {"id": "list", "component": "Checklist", "items": [{"label": "Mietvertrag", "hint": "mit aktueller Miethöhe"}]},
    ],
    ensure_ascii=False,
)

UI_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "start_eligibility_check",
            "description": "Shows the user a card that starts the guided eligibility check, with its goal, scope and a consent button. \
            Call this when the user wants to find out which benefits they may get, or asks whether they are entitled to a benefit.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "record_eligibility_answer",
            "description": "Records a value for the eligibility check that the user mentioned in free text. \
            The app stores it as provisional and asks the user to confirm it at the end. Call it once per value.",
            "parameters": {
                "type": "object",
                "properties": {
                    "field": {"type": "string", "enum": list(ELIGIBILITY_FIELDS)},
                    "value": {
                        "type": "string",
                        "description": "Allowed values per field: "
                        + "; ".join(f"{name}: {allowed}" for name, allowed in ELIGIBILITY_FIELDS.items()),
                    },
                },
                "required": ["field", "value"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "show_view",
            "description": "Shows the user a card you compose yourself, for content that reads better as structure than as text: \
            a checklist of documents, a comparison table, steps, or follow-up questions as buttons. \
            Never use it for the eligibility check questions, the app asks those itself. \
            Write the user-facing texts in the user's language and in plain words.\n"
            'The view is a flat list of components; containers refer to their children by id and one component has the id "root". \
            Only these components and props exist:\n' + catalog_prompt() + "\nExample: " + SHOW_VIEW_EXAMPLE,
            "parameters": {
                "type": "object",
                "properties": {
                    "components_json": {
                        "type": "string",
                        "description": "The components as a JSON array, like the example.",
                    },
                },
                "required": ["components_json"],
            },
        },
    },
]


def guided_check_prompt(current_field: str | None) -> str:
    current = f" The card currently shown asks for `{current_field}`." if current_field else ""
    return f"""

# Guided Eligibility Check

The user is in the guided eligibility check. The app asks the questions as cards and decides their order.{current}
- If the user's message contains a value for any eligibility field, call `record_eligibility_answer` for each value.
- Answer side questions briefly in plain language. The app shows the current question card again after your reply.
- Never ask the eligibility questions yourself and never name the official benefit names before the result.
"""
