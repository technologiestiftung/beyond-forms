"""
Chat cards: an open group of a form's rules (see `form_rules`) shown as an input card inside the
chat when it has options to pick from; a group of free inputs is asked in the chat instead. The
group's PDF fields say what it asks; the model only writes the texts: the question, a hint and the
labels.
"""

import datetime
import decimal
from dataclasses import dataclass
from typing import Any, Optional

MAX_TEXT_LENGTH = 255


@dataclass(frozen=True)
class CardInput:
    # the PDF field's CEL var, or `answer` for a choice over several fields
    key: str
    # "choice", "select", "amount", "number", "date" or "text"
    kind: str
    options: tuple[Any, ...] = ()
    options_source: Optional[str] = None
    optional: bool = False
    max_length: int = MAX_TEXT_LENGTH
    # what the input and each of its options stand for, for the model to word the labels
    about: str = ""
    option_about: tuple[str, ...] = ()


def option_key(value: Any) -> str:
    """Options are keyed by their JSON text, so booleans read "true"/"false"."""
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


APPLICATION_DONE_PROMPT = (
    "Every question of the user's Grundsicherungsantrag is answered, so there is no card to show. If they ask to "
    "continue, tell them their answers are complete and that they can review them under Antrag."
)

_CHAT_VALUE_FORMAT = {"date": "a date as YYYY-MM-DD", "amount": "a number", "number": "a number", "text": "text"}


def asked_in_chat(inputs: list[CardInput]) -> bool:
    """A card helps where there are options to pick from; free inputs are simply answered in the chat."""
    return all(not i.options and not i.options_source for i in inputs)


def inputs_prompt(card_id: str, about: str, inputs: list[CardInput]) -> str:
    """Tells the model which question is next, and how to ask it and save the answer."""
    intro = (
        "When the user wants to start or continue their Grundsicherungsantrag (Grundsicherung im Alter und bei "
        "Erwerbsminderung), or after they answered a question, "
    )
    if asked_in_chat(inputs):
        lines = [
            f'- "{i.key}": {_CHAT_VALUE_FORMAT.get(i.kind, "text")}{" (optional)" if i.optional else ""}'
            + (f" - {i.about}" if i.about else "")
            for i in inputs
        ]
        return (
            intro + "ask the next question in the chat, in your own words and without a card, so the user can "
            "simply reply.\n"
            f'Next question: card_id "{card_id}" - {about}\n'
            "When the user answers it, call `save_answer` with this card_id and their answer per key; leave out "
            "an optional key they have nothing for:\n" + "\n".join(lines)
        )
    lines = []
    for i in inputs:
        if i.options_source:
            detail = f"dropdown filled from the {i.options_source} list, no option labels"
        elif i.options:
            keys = [option_key(o) for o in i.options]
            if i.option_about:
                keys = [f"{key} ({meaning})" for key, meaning in zip(keys, i.option_about)]
            detail = "choice; option_labels keys: " + ", ".join(keys)
        else:
            detail = i.kind
        meaning = f" - {i.about}" if i.about else ""
        lines.append(f'- "{i.key}": {detail}{" (optional)" if i.optional else ""}{meaning}')
    return (
        intro + "show the next card with `show_card` instead of asking in text, with one short sentence before it.\n"
        f'Next card: card_id "{card_id}" - {about}\n'
        "Write the question, an optional hint, a label for each input key and a label for each option value:\n"
        + "\n".join(lines)
    )


def _text_errors(value: Any, name: str, required: bool = True) -> list[str]:
    if value is None and not required:
        return []
    if not isinstance(value, str) or not 0 < len(value.strip()) <= MAX_TEXT_LENGTH:
        return [f"{name} must be a text of 1 to {MAX_TEXT_LENGTH} characters"]
    return []


def build_inputs_view(card_id: str, inputs: list[CardInput], args: dict) -> tuple[Optional[dict], list[str]]:
    """The card the frontend renders, from the model's texts. Returns readable errors so the
    model can call again with fixed texts."""
    labels = args.get("labels") if isinstance(args.get("labels"), dict) else {}
    option_labels = args.get("option_labels") if isinstance(args.get("option_labels"), dict) else {}
    errors = _text_errors(args.get("question"), "question") + _text_errors(args.get("hint"), "hint", required=False)
    rendered = []
    for i in inputs:
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
    view = {"card_id": card_id, "question": args["question"], "inputs": rendered}
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
    return isinstance(value, str) and 0 < len(value) <= card_input.max_length


def input_errors(inputs: list[CardInput], values: Any) -> tuple[dict, list[str]]:
    """The submitted values with text trimmed, and what is wrong with them for these inputs."""
    if not isinstance(values, dict):
        return {}, ["values must be an object"]
    values = {key: value.strip() if isinstance(value, str) else value for key, value in values.items()}
    by_key = {i.key: i for i in inputs}
    errors = [f"{key} is not part of this card" for key in values if key not in by_key]
    errors += [f"{key} is missing" for key, i in by_key.items() if not i.optional and values.get(key) is None]
    errors += [
        f"invalid value for {key}"
        for key, value in values.items()
        if key in by_key and value is not None and not _matches_kind(by_key[key], value)
    ]
    return values, errors
