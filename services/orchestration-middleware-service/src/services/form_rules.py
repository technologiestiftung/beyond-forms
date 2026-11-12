"""
The rule files `forms/scripts/extract_form_rules.py` derives from a PDF (`schemas/rules/<form>.rules.json`):
which PDF fields form one question, what each means and when the question applies, as CEL over the
values `FormService.resolve_field_values` resolves. A document with a `form_id` links an attachment
form (Anlage) whose questions are asked whenever its condition holds. The chat asks the first open
group next: as a card where there are options to pick from, otherwise in the chat.
"""

import datetime
import json
import logging
import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional

from cel_expr_python import cel

from src.chat_cards import CardInput

logger = logging.getLogger(__name__)
RULES_DIR = Path(os.environ.get("FORM_RULES_DIR") or Path(__file__).resolve().parents[4] / "schemas" / "rules")
CHOICE_TYPES = frozenset({"single_choice", "multiple_choice", "yes_no"})
CARD_PREFIX = "form:"
# the input of a choice card, and the option for "none of these" on a question that may stay empty
ANSWER_KEY = "answer"
NONE_OPTION = "none"
_KIND_BY_ANSWER_TYPE = {"money": "amount", "number": "number", "date": "date", "text": "text"}


class FormRules:
    def __init__(self, rules: dict):
        self.form_id = rules["form_id"]
        self.groups = {group["id"]: group for group in rules["groups"]}
        var_types = {f["var"]: f["type"] for group in rules["groups"] for f in group["fields"]}
        env = cel.NewEnv(
            variables={var: cel.Type.BOOL if t == "bool" else cel.Type.STRING for var, t in var_types.items()}
        )
        documents = [(group["ask_if"], d) for group in rules["groups"] for d in group["documents"]]
        expressions = {group["ask_if"] for group in rules["groups"]} | {d["condition"] for _, d in documents}
        self._compiled = {expression: env.compile(expression) for expression in expressions}
        self._documents = documents
        self.attachments = [d["form_id"] for _, d in documents if d.get("form_id")]

    def _activation(self, values: dict[str, Any]) -> dict[str, Any]:
        activation = {}
        for group in self.groups.values():
            for f in group["fields"]:
                value = values.get(f["field_id"])
                activation[f["var"]] = bool(value) if f["type"] == "bool" else ("" if value is None else str(value))
        return activation

    def _holds(self, expression: str, activation: dict[str, Any]) -> bool:
        return self._compiled[expression].eval(data=activation).value() is True

    def open_groups(self, values: dict[str, Any], answered_field_ids: set[str]) -> list[dict]:
        """The groups that apply but are not answered yet, each with only its missing fields. `values` decide
        which groups apply; `answered_field_ids` which fields are answered, by the profile or by the chat,
        even with an empty answer, so a question that may stay empty is asked once and its card offers "none"."""
        activation = self._activation(values)
        open_groups = []
        for group in self.groups.values():
            if not self._holds(group["ask_if"], activation):
                continue
            filled = [f["field_id"] in answered_field_ids for f in group["fields"]]
            if not any(filled):
                missing = group["fields"]
            elif group["answer_type"] != "multiple_choice" and (
                group["answer_type"] in CHOICE_TYPES or not group["required"]
            ):
                missing = []
            else:
                missing = [f for f, is_filled in zip(group["fields"], filled) if not is_filled and not f["optional"]]
            if missing:
                open_groups.append({**group, "fields": missing, "partial": len(missing) < len(group["fields"])})
        return open_groups

    def _due_documents(self, values: dict[str, Any]) -> list[dict]:
        activation = self._activation(values)
        return [
            d
            for ask_if, d in self._documents
            if self._holds(ask_if, activation) and self._holds(d["condition"], activation)
        ]

    def required_attachments(self, values: dict[str, Any]) -> list[str]:
        return list(dict.fromkeys(d["form_id"] for d in self._due_documents(values) if d.get("form_id")))


@lru_cache(maxsize=None)
def load_form_rules(form_id: str) -> Optional[FormRules]:
    path = RULES_DIR / f"{form_id}.rules.json"
    if not path.exists():
        return None
    return FormRules(json.loads(path.read_text(encoding="utf-8")))


@lru_cache(maxsize=1)
def attachment_parents() -> dict[str, str]:
    """Each attachment form and the form that links it; the attachment is filled from that form's application.
    Reads the rule files without compiling them, so one broken file leaves the other forms working."""
    parents: dict[str, str] = {}
    for path in sorted(RULES_DIR.glob("*.rules.json")):
        try:
            rules = json.loads(path.read_text(encoding="utf-8"))
            links = [d["form_id"] for g in rules["groups"] for d in g["documents"] if d.get("form_id")]
        except (OSError, ValueError, KeyError, TypeError):
            logger.warning("Skipping unreadable rule file %s", path.name, exc_info=True)
            continue
        for form_id in links:
            parents.setdefault(form_id, rules["form_id"])
    return parents


def card_id(form_id: str, group_id: str) -> str:
    return f"{CARD_PREFIX}{form_id}:{group_id}"


def parse_card_id(value: Any) -> Optional[tuple[str, str]]:
    if not isinstance(value, str) or not value.startswith(CARD_PREFIX):
        return None
    form_id, _, group_id = value.removeprefix(CARD_PREFIX).partition(":")
    return (form_id, group_id) if group_id else None


def _is_single_box(field: dict) -> bool:
    return field["type"] == "bool" or len(field["options"]) <= 1


def _box_options(group: dict) -> list[tuple[str, dict, Optional[str], str]]:
    """The options of a choice card over the group's boxes: (option key, field, export value, meaning)."""
    fields = group["fields"]
    if len(fields) == 1 and not _is_single_box(fields[0]):
        return [(value, fields[0], value, label) for value, label in fields[0]["options"].items()]
    options = []
    for f in fields:
        if _is_single_box(f):
            options.append((f["var"], f, next(iter(f["options"]), None), f["meaning"]))
        else:
            options += [(f"{f['var']}={value}", f, value, label) for value, label in f["options"].items()]
    return options


def group_inputs(group: dict) -> list[CardInput]:
    """The card inputs for a group's (missing) fields. A choice is one single-choice input, a list of
    boxes that may all apply one yes/no input per box, and each text field its own input."""
    fields = group["fields"]
    if group["answer_type"] in CHOICE_TYPES:
        if len(fields) == 1 and _is_single_box(fields[0]):
            return [CardInput(ANSWER_KEY, "choice", (True, False), about=fields[0]["meaning"])]
        if group["answer_type"] == "multiple_choice":
            return [
                CardInput(f["var"], "choice", (True, False), about=f["meaning"]) for f in fields if _is_single_box(f)
            ]
        options = _box_options(group)
        keys = tuple(key for key, *_ in options)
        about = tuple(meaning for *_, meaning in options)
        if not group["required"]:
            keys, about = keys + (NONE_OPTION,), about + ("none of these applies",)
        return [CardInput(ANSWER_KEY, "choice", keys, about=group["topic"], option_about=about)]
    optional = not group["required"]
    inputs = []
    for f in fields:
        if f["type"] == "bool":
            inputs.append(CardInput(f["var"], "choice", (True, False), optional=optional, about=f["meaning"]))
        elif f["options"]:
            inputs.append(
                CardInput(
                    f["var"],
                    "choice",
                    tuple(f["options"]),
                    optional=optional or f["optional"],
                    about=f["meaning"],
                    option_about=tuple(f["options"].values()),
                )
            )
        else:
            inputs.append(
                CardInput(f["var"], _free_kind(group, f), optional=optional or f["optional"], about=f["meaning"])
            )
    return inputs


def _free_kind(group: dict, field: dict) -> str:
    return _KIND_BY_ANSWER_TYPE.get(field.get("input") or group["answer_type"], "text")


def _box_value(field: dict, export: Optional[str], ticked: bool) -> Any:
    if field["type"] == "bool":
        return ticked
    return (export or "Ja") if ticked else ""


def _text_value(value: Any, kind: str) -> str:
    # the PDF prints dates the way the profile mapping does
    if kind == "date":
        return datetime.date.fromisoformat(value).strftime("%d.%m.%Y")
    return str(value)


def group_answer(group: dict, values: dict[str, Any]) -> dict[str, Any]:
    """The PDF field values a validated card answer sets, keyed by field id."""
    fields = group["fields"]
    by_var = {f["var"]: f for f in fields}
    if group["answer_type"] in CHOICE_TYPES:
        if len(fields) == 1 and _is_single_box(fields[0]):
            f = fields[0]
            return {f["field_id"]: _box_value(f, next(iter(f["options"]), None), values[ANSWER_KEY])}
        if group["answer_type"] == "multiple_choice":
            return {
                f["field_id"]: _box_value(f, next(iter(f["options"]), None), values[var])
                for var, f in by_var.items()
                if var in values
            }
        chosen = values[ANSWER_KEY]
        answer: dict[str, Any] = {}
        for key, f, export, _meaning in _box_options(group):
            if f["field_id"] in answer and answer[f["field_id"]] not in ("", False):
                continue
            answer[f["field_id"]] = _box_value(f, export, key == chosen)
        return answer
    answer = {}
    for var, value in values.items():
        if value is None:
            continue
        f = by_var[var]
        answer[f["field_id"]] = (
            _box_value(f, None, value) if f["type"] == "bool" else _text_value(value, _free_kind(group, f))
        )
    return answer


def group_card_about(group: dict) -> str:
    about = " · ".join(part for part in (group["section"], group["person"], group["topic"]) if part)
    if group["hint"]:
        about += f" (the form adds: {group['hint']})"
    if group.get("reason"):
        about += f" (asked because: {group['reason']} - use it for the hint if the user may wonder why)"
    return about
