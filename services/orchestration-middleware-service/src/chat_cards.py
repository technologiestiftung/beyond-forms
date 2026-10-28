"""
Chat cards: a step of the wizard rules shown as an input card inside the chat. The step's
`columns` say what it asks; each input's type follows its `users` column, so the model only
writes the texts: the question, a hint and the labels.
"""

import datetime
import decimal
from dataclasses import dataclass
from typing import Any, Optional

import sqlalchemy as sa
from pydantic import ValidationError

from src.models import Users
from src.schemas import UserProfileValidationSchema

MAX_TEXT_LENGTH = 300


@dataclass(frozen=True)
class CardInput:
    # the `users` column, or a snake_case name for an income row
    key: str
    # "choice", "select", "amount", "number", "date" or "text"
    kind: str
    options: tuple[Any, ...] = ()
    options_source: Optional[str] = None
    optional: bool = False
    income_type: Optional[str] = None


def _income_key(income_type: str) -> str:
    return income_type.lower().replace("-", "_").replace(" ", "_")


def _options(entry: dict, column_type: sa.types.TypeEngine) -> tuple[Any, ...]:
    """The rules' own options win over the ones the column allows."""
    if "options" in entry:
        return tuple(entry["options"])
    if isinstance(column_type, sa.Enum):
        return tuple(column_type.enums)
    if isinstance(column_type, sa.Boolean):
        return (True, False)
    return ()


_KIND_BY_COLUMN_TYPE = ((sa.Date, "date"), (sa.Numeric, "amount"), (sa.Integer, "number"))


def _free_input_kind(column_type: sa.types.TypeEngine) -> str:
    return next((kind for type_, kind in _KIND_BY_COLUMN_TYPE if isinstance(column_type, type_)), "text")


def _card_input(entry: dict) -> CardInput:
    if "income_type" in entry:
        # an income line left empty is stored as 0
        income_type = entry["income_type"]
        return CardInput(_income_key(income_type), "amount", optional=True, income_type=income_type)
    name = entry["column"]
    optional = entry.get("optional", False)
    if entry.get("options_source"):
        return CardInput(name, "select", options_source=entry["options_source"], optional=optional)
    column_type = Users.__table__.columns[name].type
    options = _options(entry, column_type)
    kind = entry.get("input", "choice") if options else _free_input_kind(column_type)
    return CardInput(name, kind, options, optional=optional)


def card_inputs(step: dict) -> list[CardInput]:
    return [_card_input(entry) for entry in step.get("columns", [])]


def option_key(value: Any) -> str:
    """Options are keyed by their JSON text, so booleans read "true"/"false"."""
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


APPLICATION_DONE_PROMPT = (
    "Every card of the user's Grundsicherungsantrag is answered, so there is no card to show. If they ask to "
    "continue, tell them their answers are complete and that they can review them under Antrag."
)


def card_prompt(step_id: str, step: dict) -> str:
    """Tells the model which card is next and which texts `show_card` needs for it."""
    lines = []
    for i in card_inputs(step):
        if i.options_source:
            detail = f"dropdown filled from the {i.options_source} list, no option labels"
        elif i.options:
            detail = "choice; option_labels keys: " + ", ".join(option_key(o) for o in i.options)
        else:
            detail = i.kind
        lines.append(f'- "{i.key}": {detail}{" (optional)" if i.optional else ""}')
    about = step.get("description") or step.get("title", "")
    return (
        "When the user wants to start or continue their Grundsicherungsantrag (Grundsicherung im Alter und bei "
        "Erwerbsminderung), or after they answered a card, show the next card with `show_card` instead of asking "
        "in text, with one short sentence before it.\n"
        f'Next card: card_id "{step_id}" - {step.get("title", "")}: {about}\n'
        "Write the question, an optional hint, a label for each input key and a label for each option value:\n"
        + "\n".join(lines)
    )


def _text_errors(value: Any, name: str, required: bool = True) -> list[str]:
    if value is None and not required:
        return []
    if not isinstance(value, str) or not 0 < len(value.strip()) <= MAX_TEXT_LENGTH:
        return [f"{name} must be a text of 1 to {MAX_TEXT_LENGTH} characters"]
    return []


def build_card_view(step_id: str, step: dict, args: dict) -> tuple[Optional[dict], list[str]]:
    """The card the frontend renders, from the model's texts. Returns readable errors so the
    model can call again with fixed texts."""
    labels = args.get("labels") if isinstance(args.get("labels"), dict) else {}
    option_labels = args.get("option_labels") if isinstance(args.get("option_labels"), dict) else {}
    errors = _text_errors(args.get("question"), "question") + _text_errors(args.get("hint"), "hint", required=False)
    rendered = []
    for i in card_inputs(step):
        errors += _text_errors(labels.get(i.key), f"labels.{i.key}")
        item: dict[str, Any] = {"field": i.key, "kind": i.kind, "label": labels.get(i.key)}
        if i.optional:
            item["optional"] = True
        if i.options_source:
            item["options_source"] = i.options_source
        elif i.options:
            given = option_labels.get(i.key) if isinstance(option_labels.get(i.key), dict) else {}
            for o in i.options:
                errors += _text_errors(given.get(option_key(o)), f"option_labels.{i.key}.{option_key(o)}")
            item["options"] = [{"value": o, "label": given.get(option_key(o))} for o in i.options]
        rendered.append(item)
    if errors:
        return None, errors
    view = {"card_id": step_id, "question": args["question"], "inputs": rendered}
    if args.get("hint"):
        view["hint"] = args["hint"]
    return view, []


def _matches_kind(card_input: CardInput, value: Any) -> bool:
    if card_input.options:
        return any(value == o and type(value) is type(o) for o in card_input.options)
    if card_input.kind in ("amount", "number"):
        return isinstance(value, (int, float, decimal.Decimal)) and not isinstance(value, bool) and value >= 0
    if card_input.kind == "date":
        try:
            datetime.date.fromisoformat(value)
            return True
        except (TypeError, ValueError):
            return False
    return isinstance(value, str) and 0 < len(value.strip()) <= 255


def validate_card_answer(step: dict, values: Any) -> tuple[Optional[UserProfileValidationSchema], list[str]]:
    """Checks a submitted card against its step and the profile schema; income lines become
    `income_entries` rows."""
    if not isinstance(values, dict):
        return None, ["values must be an object"]
    inputs = {i.key: i for i in card_inputs(step)}
    errors = [f"{key} is not part of this card" for key in values if key not in inputs]
    errors += [f"{key} is missing" for key, i in inputs.items() if not i.optional and values.get(key) is None]
    errors += [
        f"invalid value for {key}"
        for key, value in values.items()
        if key in inputs and value is not None and not _matches_kind(inputs[key], value)
    ]
    if errors:
        return None, errors
    payload: dict[str, Any] = {key: value for key, value in values.items() if not inputs[key].income_type}
    income = [i for i in inputs.values() if i.income_type]
    if income:
        payload["income_entries"] = [
            {"income_type": i.income_type, "monthly_amount": values.get(i.key) or 0} for i in income
        ]
    try:
        return UserProfileValidationSchema.model_validate(payload), []
    except ValidationError as error:
        return None, [f"{'.'.join(map(str, e['loc']))}: {e['msg']}" for e in error.errors()]
