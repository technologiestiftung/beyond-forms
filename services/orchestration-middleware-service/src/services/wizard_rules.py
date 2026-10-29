"""
The Grundsicherung wizard rules (`schemas/rules/basic-welfare-rules.jsonc`): which step asks
what, which `users` column or income row answers each field, and the payload the rules engine
walks to find the next step. The payload holds the stored values as they are, so an empty
column stays a missing field.
"""

import datetime
import decimal
import enum
import logging
import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional

import json5
import requests

from src.models import Users
from src.utils import get_google_id_token

logger = logging.getLogger(__name__)

RULES_PATH = Path(
    os.environ.get("WIZARD_RULES_PATH")
    or Path(__file__).resolve().parents[4] / "schemas" / "rules" / "basic-welfare-rules.jsonc"
)
ENDPOINT_RULES_ENGINE = os.environ.get("ENDPOINT_RULES_ENGINE", "http://rules-engine:8080")


@lru_cache(maxsize=1)
def load_rules() -> dict:
    return json5.loads(RULES_PATH.read_text(encoding="utf-8"))


def rules_steps() -> dict[str, dict]:
    return load_rules()["steps"]


def application_start_step() -> str:
    """The first step after the anonymous eligibility check."""
    sections = [section for section in load_rules()["sections"] if section["id"] != "eligibility_check"]
    return sections[0]["steps"][0]


def _path_parts(path: str) -> list[str]:
    # the same normalisation as the rules engine's resolve_path: a['b'].c -> a.b.c
    normalized = path.replace("['", ".").replace("']", "").replace("[", ".").replace("]", "")
    return [part for part in normalized.split(".") if part]


def _set_path(payload: dict, path: str, value: Any) -> None:
    *parents, leaf = _path_parts(path)
    node = payload
    for part in parents:
        node = node.setdefault(part, {})
    node[leaf] = value


def _json_value(value: Any) -> Any:
    if isinstance(value, enum.Enum):
        return value.value
    if isinstance(value, (datetime.date, datetime.datetime)):
        return value.isoformat()
    if isinstance(value, decimal.Decimal):
        return float(value)
    return value


def evaluation_payload(user: Users) -> dict:
    """The form content the rules engine evaluates, built from the columns the rules name."""
    payload: dict = {}
    income_types_by_field: dict[str, set[str]] = {}
    for step in rules_steps().values():
        for entry in step.get("columns", []):
            field = entry.get("field")
            if not field:
                continue
            if "income_type" in entry:
                income_types_by_field.setdefault(field, set()).add(entry["income_type"])
                continue
            value = _json_value(getattr(user, entry["column"]))
            if value is not None:
                _set_path(payload, field, value)

    applicant_income = [row for row in user.income_entries if row.person_id is None]
    for field, income_types in income_types_by_field.items():
        rows = [row for row in applicant_income if _json_value(row.income_type) in income_types]
        # a row with amount 0 answers the line as "none"
        if rows:
            _set_path(payload, field, float(sum(row.monthly_amount or 0 for row in rows)))
    return payload


def evaluate(user: Users) -> Optional[dict]:
    """The rules engine's walk from the start of the application, or None if it can't be reached."""
    headers = {}
    token = get_google_id_token(ENDPOINT_RULES_ENGINE)
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        response = requests.post(
            f"{ENDPOINT_RULES_ENGINE}/wizard/evaluate",
            json={"form_content": evaluation_payload(user), "current_step_id": application_start_step()},
            headers=headers,
            timeout=10,
        )
        response.raise_for_status()
        return response.json().get("evaluation") or {}
    except requests.exceptions.RequestException:
        logger.warning("Rules engine /wizard/evaluate is unavailable", exc_info=True)
        return None
