import datetime
from typing import Any, Dict, List

from src.models import (
    MARITAL_STATUS_DE,
    NATIONALITY_DE,
    AssociatedPersons,
    AssociationType,
)

PARTNER_TYPES = frozenset(
    {AssociationType.SPOUSE, AssociationType.REGISTERED_PARTNER, AssociationType.COHABITING_PARTNER}
)

RETIREMENT_AGE = 67


def row_to_dict(row: Any) -> Dict[str, Any]:
    """A mapped row as {column_name: value}, the shape the JEXL context is built from."""
    return {column.name: getattr(row, column.name) for column in row.__table__.columns}


def label_context(row: Dict[str, Any]) -> Dict[str, Any]:
    """German labels for the enums a form prints as free text. Applies to the applicant and
    to each associated person alike, so no mapping carries a translation chain. An unmapped
    country keeps its ISO code rather than getting a guessed adjective."""
    return {
        "marital_status_de": MARITAL_STATUS_DE.get(row.get("marital_status"), ""),
        "nationality_de": NATIONALITY_DE.get(row.get("nationality"), row.get("nationality") or ""),
    }


def person_context(people: List[AssociatedPersons]) -> Dict[str, Any]:
    """`partner` ignores `lives_in_household`: a spouse living elsewhere still belongs in a
    form's partner block."""
    people = [row_to_dict(person) for person in sorted(people, key=lambda person: person.sort_order)]
    for person in people:
        person.update(label_context(person))
    partners = [person for person in people if person["association_type"] in PARTNER_TYPES]
    household = [person for person in people if person["lives_in_household"]]
    return {
        "household_members": household,
        # pyjexl 0.3 has no length function.
        "household_members_count": len(household),
        "partner": partners[0] if partners else None,
    }


def age_context(date_of_birth: Any) -> Dict[str, Any]:
    """Exposes what the dropped `users_age_view` derived, which no mapping could reach
    before: Grundsicherung eligibility turns on `has_reached_retirement_age`. That keeps the
    view's simplified 67 — the real SGB VI staircase is a rules question, not a schema one."""
    if not isinstance(date_of_birth, datetime.date):
        return {"age": None, "is_adult": None, "has_reached_retirement_age": None}
    today = datetime.date.today()
    age = today.year - date_of_birth.year - ((today.month, today.day) < (date_of_birth.month, date_of_birth.day))
    return {"age": age, "is_adult": age >= 18, "has_reached_retirement_age": age >= RETIREMENT_AGE}


def derived_context(user_row: Dict[str, Any], people: List[AssociatedPersons]) -> Dict[str, Any]:
    """Every context key that is not a `users` column. The single source of that list —
    `validate_mappings.py` calls this with stand-in values to learn what a mapping may
    reference."""
    return {
        "today": datetime.date.today(),
        **age_context(user_row.get("date_of_birth")),
        **label_context(user_row),
        **person_context(people),
    }
