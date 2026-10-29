import datetime
import re
from typing import Any, Callable, Dict, Iterable, List

from src.models import (
    INCOME_TYPE_DE,
    MARITAL_STATUS_DE,
    NATIONALITY_DE,
    PENSION_INCOME_TYPES,
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


_DATE_RE = re.compile(r"\d{2}\.\d{2}\.\d{4}")
_ZIP_CITY_RE = re.compile(r"^(\d{5})\s+(.+)$")
_STREET_RE = re.compile(r"^(.+?)\s+(\d+\s*[a-zA-Z]?(?:\s*[-/]\s*\d+\s*[a-zA-Z]?)?)$")


def previous_benefits_context(user_row: Dict[str, Any]) -> Dict[str, Any]:
    """Splits the free-text period and authority the form asks for field by field. A period
    with a single date is read as its end, matching how the demo personas record an ongoing
    claim. The authority is "Name, ..., Straße Nr, PLZ Ort"; whatever does not parse stays
    whole in the name rather than being guessed into a wrong field."""
    dates = _DATE_RE.findall(user_row.get("previous_benefits_period") or "")
    parts = [part.strip() for part in (user_row.get("previous_benefits_authority") or "").split(",") if part.strip()]
    zip_code = city = street = house_number = None
    if len(parts) > 2 and (zip_city := _ZIP_CITY_RE.match(parts[-1])) and (street_nr := _STREET_RE.match(parts[-2])):
        zip_code, city = zip_city.groups()
        street, house_number = street_nr.groups()
        parts = parts[:-2]
    # The profile only says *that* benefits were received, while the Jobcenter form asks
    # about Bürgergeld/Sozialhilfe specifically. The awarding office is the only hint at the
    # kind: an unrecognised office stays unknown instead of being read either way.
    authority = (user_row.get("previous_benefits_authority") or "").lower()
    if not user_row.get("has_received_previous_benefits"):
        previous_kind = None
    elif "jobcenter" in authority:
        previous_kind = "Bürgergeld"
    elif "sozialamt" in authority or "amt für soziales" in authority:
        previous_kind = "Sozialhilfe"
    elif "wohngeld" in authority:
        previous_kind = "Wohngeld"
    else:
        previous_kind = None
    # The form asks about the last three years; a claim counts if it ended inside that window
    # or is still running. No parseable end date leaves the answer open.
    within_three_years = None
    if dates:
        try:
            until = datetime.datetime.strptime(dates[-1], "%d.%m.%Y").date()
        except ValueError:
            until = None
        if until is not None:
            today = datetime.date.today()
            cutoff = today.replace(year=today.year - 3, day=28 if (today.month, today.day) == (2, 29) else today.day)
            within_three_years = until >= cutoff
    return {
        "previous_benefits_kind": previous_kind,
        "previous_benefits_from": dates[0] if len(dates) > 1 else None,
        "previous_benefits_until": dates[-1] if dates else None,
        "previous_benefits_period_within_last_three_years": within_three_years,
        "previous_benefits_authority_name": ", ".join(parts) or None,
        "previous_benefits_authority_street": street,
        "previous_benefits_authority_house_number": house_number,
        "previous_benefits_authority_zip_code": zip_code,
        "previous_benefits_authority_city": city,
    }


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
        # `monthly_pension_income` predates the per-person money grid; without this a pension
        # recorded only there reaches Wohngeld (which reads the column) but not the forms
        # that read `income`.
        if person.get("monthly_pension_income") is not None and "Pension" not in person["income"]:
            person["income"] = {**person["income"], "Pension": person["monthly_pension_income"]}
            person["has_any_income"] = True
        people.append(person)

    partners = [person for person in people if person["association_type"] in PARTNER_TYPES]
    household = [person for person in people if person["lives_in_household"]]
    household_children = [person for person in household if person["association_type"] == AssociationType.CHILD]
    return {
        "associated_persons": people,
        "household_members": household,
        "household_children": household_children,
        # pyjexl 0.3 has no length function.
        "household_members_count": len(household),
        "household_children_count": len(household_children),
        # pyjexl has no `.some`/lambdas, so the "any household member" test happens here.
        "household_has_disability": any(
            person["has_disability_id"] or person["is_care_dependent"] or person["care_level"] is not None
            for person in household
        ),
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


_PENSION_KEYS = frozenset(pension_type.value for pension_type in PENSION_INCOME_TYPES)


def _with_pension_line(by_type: Dict[str, Any], combine: Callable[[List[Any]], Any]) -> Dict[str, Any]:
    """Folds every pension kind into `Pension`, the form's single "Renten/Pensionen" line."""
    values = [value for key, value in by_type.items() if key in _PENSION_KEYS and value not in (None, "")]
    if not values:
        return by_type
    return {**by_type, "Pension": combine(values)}


def _join_distinct(values: List[Any]) -> str:
    return ", ".join(dict.fromkeys(str(value) for value in values))


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
        "income": _with_pension_line(_entries_by_type(income, "income_type", "monthly_amount"), sum),
        "income_office": _with_pension_line(
            _entries_by_type(all_income, "income_type", "awarding_office"), _join_distinct
        ),
        "income_reference": _with_pension_line(
            _entries_by_type(all_income, "income_type", "reference_no"), _join_distinct
        ),
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


def free_housing_right_context(holder: Any) -> Dict[str, Any]:
    """The form asks for the holder's first name and surname separately; the profile keeps
    one name, read as first names followed by the surname."""
    *first_names, last_name = (holder or "").split() or [""]
    return {
        "free_housing_right_holder_first_name": " ".join(first_names),
        "free_housing_right_holder_last_name": last_name,
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
        **previous_benefits_context(user_row),
        **free_housing_right_context(user_row.get("free_housing_right_holder")),
        **label_context(user_row),
        **money_context(money_entries, None),
        **person_context(people, money_entries),
    }
