import datetime
from typing import Any, Dict, Iterable, List

from src.models import (
    INCOME_TYPE_DE,
    MARITAL_STATUS_DE,
    NATIONALITY_DE,
    AssociatedPersons,
    AssociationType,
    BenefitClaimKindType,
)

PARTNER_TYPES = frozenset(
    {AssociationType.SPOUSE, AssociationType.REGISTERED_PARTNER, AssociationType.COHABITING_PARTNER}
)

RETIREMENT_AGE = 67


def _blz_from_iban(iban: Any) -> Any:
    """The Bankleitzahl is positions 5-12 of a German IBAN - the form asks for it
    separately even though it is fully implied by the IBAN the user already gave."""
    if not isinstance(iban, str):
        return None
    cleaned = iban.replace(" ", "")
    if cleaned[:2] != "DE" or len(cleaned) != 22:
        return None
    return cleaned[4:12]


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


def person_context(people: List[AssociatedPersons], money_entries: Iterable[Any] = ()) -> Dict[str, Any]:
    """`partner` ignores `lives_in_household`: a spouse living elsewhere still belongs in a
    form's partner block. `associated_persons` keeps everyone for the same reason - the
    Grundsicherung alimony blocks ask about children and parents who need not live here."""
    money_entries = list(money_entries)
    ordered = sorted(people, key=lambda person: person.sort_order)
    people = []
    for row in ordered:
        person = row_to_dict(row)
        person.update(label_context(person))
        person.update(money_context(money_entries if row.id is not None else (), row.id))
        people.append(person)
    partners = [person for person in people if person["association_type"] in PARTNER_TYPES]
    household = [person for person in people if person["lives_in_household"]]
    return {
        "associated_persons": people,
        "household_members": household,
        # pyjexl 0.3 has no length function.
        "household_members_count": len(household),
        "associated_persons_count": len(people),
        "partner": partners[0] if partners else None,
    }


def _entries_by_type(entries: Iterable[Any], type_field: str, value_field: str) -> Dict[str, Any]:
    """{enum value: field} for one person's rows of a money grid, so a mapping addresses a
    form line by name - `income.Pension` - instead of by row index. A type with no row is
    simply absent, which reads as falsy under the guard every mapping already uses.

    The first row that carries a value wins: for the maps that pool every person's rows,
    whichever person recorded the value is the one that counts, and taking the first
    rather than the last keeps the answer the same whatever order the rows loaded in."""
    out: Dict[str, Any] = {}
    for entry in entries:
        entry_type = getattr(entry, type_field)
        key = entry_type.value if hasattr(entry_type, "value") else str(entry_type)
        if out.get(key) is not None:
            continue
        out[key] = getattr(entry, value_field)
    return out


def _claim_rows(claims: Iterable[Any], kind: BenefitClaimKindType) -> List[Dict[str, Any]]:
    rows = [claim for claim in claims if claim.claim_kind == kind]
    return [row_to_dict(row) for row in sorted(rows, key=lambda claim: claim.sort_order)]


def money_context(entries: Iterable[Any], person_id: Any) -> Dict[str, Any]:
    """The money grids for exactly one person. `person_id=None` selects the applicant's
    own rows, matching the `person_id IS NULL` convention in the entry tables."""
    entries = list(entries)
    rows = [entry for entry in entries if entry.person_id == person_id]
    income = [row for row in rows if hasattr(row, "income_type")]
    expenses = [row for row in rows if hasattr(row, "expense_type")]
    assets = [row for row in rows if hasattr(row, "asset_type")]
    claims = [row for row in rows if hasattr(row, "claim_kind")]
    all_income = sorted(
        (row for row in entries if hasattr(row, "income_type")),
        key=lambda row: (row.person_id is not None, str(row.person_id), str(row.id)),
    )
    return {
        "income": _entries_by_type(income, "income_type", "monthly_amount"),
        "income_office": _entries_by_type(all_income, "income_type", "awarding_office"),
        "income_reference": _entries_by_type(all_income, "income_type", "reference_no"),
        "expenses": _entries_by_type(expenses, "expense_type", "monthly_amount"),
        "expense_notes": _entries_by_type(expenses, "expense_type", "note"),
        "assets": _entries_by_type(assets, "asset_type", "amount"),
        "asset_descriptions": _entries_by_type(assets, "asset_type", "description"),
        "has_any_income": any(row.monthly_amount for row in income),
        "income_list": [
            {
                "income_type": row.income_type.value if hasattr(row.income_type, "value") else row.income_type,
                "income_type_de": INCOME_TYPE_DE.get(row.income_type, ""),
                "monthly_amount": row.monthly_amount,
                "awarding_office": row.awarding_office,
                "reference_no": row.reference_no,
            }
            for row in sorted(income, key=lambda entry: str(entry.income_type))
        ],
        "pending_benefit_claims": _claim_rows(claims, BenefitClaimKindType.PENDING_APPLICATION),
        "expected_one_time_payments": _claim_rows(claims, BenefitClaimKindType.EXPECTED_ONE_TIME_PAYMENT),
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


def derived_context(
    user_row: Dict[str, Any],
    people: List[AssociatedPersons],
    money_entries: Iterable[Any] = (),
) -> Dict[str, Any]:
    """Every context key that is not a `users` column. The single source of that list —
    `validate_mappings.py` and the mapping generator both call this with stand-in values
    to learn what a mapping may reference.

    `money_entries` is the flat list of income/expense/asset/benefit-claim rows for this
    user, applicant and associated persons together; it is split per person here rather
    than queried per person."""
    money_entries = list(money_entries)
    return {
        "today": datetime.date.today(),
        "blz": _blz_from_iban(user_row.get("iban")),
        **age_context(user_row.get("date_of_birth")),
        **label_context(user_row),
        **money_context(money_entries, None),
        **person_context(people, money_entries),
    }
