import datetime
import decimal
import importlib.util
import os
import sys
import types
import typing
import uuid
from typing import Any, Dict, Optional, Tuple

_MODULE_CACHE: Dict[str, Any] = {}


def _clean_type_repr(annotation: Any) -> str:
    """A concise type string (e.g. "Optional[Decimal]") for a pydantic field's raw
    annotation"""
    origin = typing.get_origin(annotation)

    if origin is typing.Annotated:
        return _clean_type_repr(typing.get_args(annotation)[0])

    if origin is typing.Union:
        args = typing.get_args(annotation)
        non_none = [a for a in args if a is not type(None)]
        if len(non_none) == 1 and len(args) == 2:
            return f"Optional[{_clean_type_repr(non_none[0])}]"
        return " | ".join(_clean_type_repr(a) for a in args)

    if origin is list:
        args = typing.get_args(annotation)
        inner = _clean_type_repr(args[0]) if args else "Any"
        return f"List[{inner}]"

    if origin is typing.Literal:
        return f"Literal[{', '.join(repr(a) for a in typing.get_args(annotation))}]"

    if origin is not None:
        return str(annotation)

    if isinstance(annotation, type):
        return annotation.__name__

    return str(annotation)


def _load_module_from_path(cache_key: str, module_name: str, file_path: str):
    """Loads a .py file as a module under an explicit name (not via sys.path), caching by
    file path so repeated calls in one process don't re-execute it - SQLAlchemy's
    declarative registry is global per Base class, so loading models.py twice raises
    "table already defined"."""
    if cache_key in _MODULE_CACHE:
        return _MODULE_CACHE[cache_key]
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    _MODULE_CACHE[cache_key] = module
    return module


def _load_models(models_path: str):
    return _load_module_from_path(models_path, "src.models", models_path)


def _load_schemas(schemas_path: str, models_path: str):
    """schemas.py does `from src.models import (...)` - this monorepo has many unrelated
    src/ directories across services, so resolving that import via sys.path could
    silently pick up the wrong one. Instead, register a synthetic "src" namespace package
    and preload "src.models" under that exact name, so the import resolves to precisely
    the module we already loaded, with no path manipulation at all."""
    if "src" not in sys.modules:
        pkg = types.ModuleType("src")
        pkg.__path__ = []
        sys.modules["src"] = pkg
    models_module = _load_models(models_path)
    sys.modules["src"].models = models_module
    return _load_module_from_path(schemas_path, "src.schemas", schemas_path)


def _load_form_context(project_root: str):
    """form_context.py is the single source of truth for the context keys that are not
    Users columns, so it is loaded and *called* rather than having its key list restated
    here - a new derived key shows up in the generator's schema view automatically."""
    _, models_path, _ = default_paths(project_root)
    if "src" not in sys.modules:
        pkg = types.ModuleType("src")
        pkg.__path__ = []
        sys.modules["src"] = pkg
    sys.modules["src"].models = _load_models(models_path)
    services_dir = os.path.join(os.path.dirname(models_path), "services")
    _load_module_from_path(
        os.path.join(services_dir, "__init__.py"), "src.services", os.path.join(services_dir, "__init__.py")
    )
    return _load_module_from_path(
        os.path.join(services_dir, "form_context.py"),
        "src.services.form_context",
        os.path.join(services_dir, "form_context.py"),
    )


def parse_schemas(file_path: str) -> Dict[str, Any]:
    if not os.path.exists(file_path):
        return {}

    models_path = os.path.join(os.path.dirname(file_path), "models.py")
    module = _load_schemas(file_path, models_path)
    cls = getattr(module, "UserInformationUpdateSchema", None)
    if cls is None:
        return {}

    schema_fields = {}
    for field_name, field_info in cls.model_fields.items():
        schema_fields[field_name] = {
            "type": str(field_info.annotation),
            "description": field_info.description or "",
        }
    return schema_fields


def parse_models(file_path: str) -> Tuple[Dict[str, Any], Dict[str, list]]:
    """Returns ({column_name: Column}, {enum_class_name: [allowed values]}) - Column
    objects, not type strings, so callers get real SQLAlchemy type info directly."""
    if not os.path.exists(file_path):
        return {}, {}

    module = _load_models(file_path)
    users_fields = {column.name: column for column in module.Users.__table__.columns}

    enums: Dict[str, list] = {}
    for name, obj in vars(module).items():
        if isinstance(obj, type) and issubclass(obj, __import__("enum").Enum) and obj.__module__ == module.__name__:
            values = [member.value for member in obj]
            if values:
                enums[name] = values

    return users_fields, enums


def parse_document_types(file_path: str) -> Dict[str, Dict[str, Any]]:
    """Ignores `file_path` in favor of a normal package import - libs/document-schemas is
    a real installable package (beyondforms.document_schemas), not service-internal code
    like models.py/schemas.py, so there's no path-collision risk to guard against here."""
    try:
        from beyondforms.document_schemas.document_registry import document_registry
    except ImportError:
        return {}

    document_types: Dict[str, Dict[str, Any]] = {}
    for slug in document_registry.list_keys():
        model_cls = document_registry.get_or_raise(slug)

        class_description = ""
        description_field = model_cls.model_fields.get("description")
        if description_field is not None and description_field.default is not None:
            class_description = description_field.default

        fields: Dict[str, Any] = {}
        for field_name, field_info in model_cls.model_fields.items():
            if field_name == "description":
                continue
            fields[field_name] = {
                "type": str(field_info.annotation),
                "description": field_info.description or "",
            }

        for field_name, field_info in model_cls.model_computed_fields.items():
            fields[field_name] = {
                "type": str(field_info.return_type),
                "description": field_info.description or "",
                "computed": True,
            }

        document_types[slug] = {"description": class_description, "fields": fields}

    return document_types


class StrictDict(dict):
    """Raises on lookup of any key it doesn't hold, instead of returning None like a
    plain dict would. Used to validate a generated JEXL expression only references real
    columns - any typo'd/hallucinated identifier surfaces as an error immediately.

    pyjexl resolves the top-level context through its own Context wrapper (which routes
    to __getitem__) but reads nested attribute access - `partner.first_name` - straight
    off the subject dict via .get(), so both need overriding or a hallucinated field on a
    person object would silently resolve to None."""

    def __getitem__(self, key):
        if key not in self:
            raise NameError(f"Undefined identifier: {key}")
        return super().__getitem__(key)

    def get(self, key, default=None):
        return self[key]


def dummy_value(column_info: Dict[str, Any]) -> Any:
    """A type-appropriate stand-in for validating an expression's syntax/references
    without real data. Using the string "dummy" for every column regardless of type
    makes numeric comparisons (`some_decimal_column > 0`) fail validation with a
    TypeError even though the expression is perfectly valid once real data flows in -
    a false rejection, not a real bug in the generated JEXL."""
    col_type = column_info.get("type", "String")
    if col_type == "Boolean":
        return True
    if col_type in ("Decimal", "Integer"):
        return 0
    if col_type.startswith("Date"):
        return datetime.date(2024, 1, 1)
    return "dummy"


def default_paths(project_root: str) -> Tuple[str, str, str]:
    """(schemas.py, models.py, document_types.py) at their conventional locations."""
    return (
        os.path.join(project_root, "services/orchestration-middleware-service/src/schemas.py"),
        os.path.join(project_root, "services/orchestration-middleware-service/src/models.py"),
        os.path.join(
            project_root, "libs/document-schemas/src/beyondforms/document_schemas/document_types.py"
        ),
    )


def list_document_types(project_root: str) -> list:
    """Slugs only — used by validate_mappings.sh to pre-fill the `documents` namespace."""
    _, _, document_types_path = default_paths(project_root)
    return list(parse_document_types(document_types_path).keys())


# Columns kept out of the write schemas on purpose, so there is no pydantic description
# to lift, but which a mapping still needs to be told about.
_COLUMN_DESCRIPTION_OVERRIDES = {
    "monthly_expenses_total": (
        "The sum of this person's monthly expense rows, maintained by a database trigger. "
        "Use it for a form's 'Ausgaben monatlich Betrag' total; the individual lines are in `expenses`. "
        "Read-only - never the target of a write."
    ),
}

_IGNORED_LLM_FIELDS = {
    "conversations",
    "user_applications",
    "user_tutorial_states",
    "user_documents",
    "created_at",
    "updated_at",
    "fcm_token",
    "authentik_id",
}


def _infer_clean_type_from_column(column) -> Tuple[str, list]:
    """Maps a real SQLAlchemy Column to the simplified type label used in the schema
    context, plus allowed enum values - straight from the column's own type object, not
    string-matched off an unparsed type annotation."""
    enum_values = getattr(column.type, "enums", None)
    if enum_values:
        return f"Enum ({', '.join(enum_values)})", list(enum_values)

    py_type = column.type.python_type
    if py_type is bool:
        return "Boolean", []
    if py_type in (datetime.date, datetime.datetime):
        return "Date (ISO YYYY-MM-DD)", []
    if py_type is decimal.Decimal:
        return "Decimal", []
    if py_type is int:
        return "Integer", []
    return "String", []


def all_user_columns(project_root: str, include_field_descriptions: bool = True) -> Dict[str, Any]:
    """Every Users column, UNFILTERED - including internal/audit fields (authentik_id,
    created_at, ...) that build_schema_context() deliberately hides from the LLM prompt.
    Use this for *validating* an existing JEXL expression (is this identifier real at
    all?), not for what the LLM should be offered to reference - a hand-written mapping
    may legitimately reference an internal field even though we'd never want the LLM
    inventing new references to one."""
    schemas_path, models_path, _ = default_paths(project_root)
    schema_fields = parse_schemas(schemas_path) if include_field_descriptions else {}
    columns, _ = parse_models(models_path)

    user_columns: Dict[str, Any] = {}
    for field_name, column in columns.items():
        clean_type, allowed_values = _infer_clean_type_from_column(column)
        description = ""
        if include_field_descriptions:
            description = _COLUMN_DESCRIPTION_OVERRIDES.get(
                field_name, schema_fields.get(field_name, {}).get("description", "")
            )
        user_columns[field_name] = {"type": clean_type, "description": description}
        if allowed_values:
            user_columns[field_name]["allowed_values"] = allowed_values

    return user_columns


_PERSON_IGNORED_FIELDS = {"id", "user_id", "sort_order", "created_at", "updated_at"}

# The derived context keys carry no pydantic/SQLAlchemy description to lift, so their
# meaning is spelled out here.
_DERIVED_DESCRIPTIONS = {
    "today": "Today's date - for 'Datum'/'Ort, Datum' signature fields.",
    "age": "The applicant's age in whole years, derived from date_of_birth.",
    "is_adult": "True when the applicant is 18 or older.",
    "has_reached_retirement_age": "True when the applicant is 67 or older (Grundsicherung age eligibility).",
    "marital_status_de": "The applicant's marital_status as the German word a form prints: "
    "'ledig', 'verheiratet', 'in eheähnlicher Gemeinschaft', 'dauernd getrennt lebend', "
    "'eingetragene Lebenspartnerschaft', 'geschieden', 'verwitwet'. Use this for a free-text "
    "'Familienstand' field instead of a ternary chain over marital_status.",
    "nationality_de": "The applicant's nationality as the German adjective ('deutsch', 'türkisch', ...), "
    "falling back to the raw ISO code. Use this for a free-text 'Staatsangehörigkeit' field.",
    "partner": "The applicant's spouse, registered partner or cohabiting partner as a SINGLE person "
    "object, or null when there is none. Deliberately ignores lives_in_household: a separated spouse "
    "still belongs in a form's partner block.",
    "associated_persons": "EVERY person associated with the applicant, in sort_order, household or not - "
    "use this only where the form asks about someone who need not live here (an alimony-obligated child, a "
    "separated spouse); prefer household_members for a household roster slot.",
    "associated_persons_count": "How many people associated_persons holds (the applicant not counted).",
    "household_members": "Every associated person who lives in the applicant's household, ordered by "
    "sort_order - the list a form's Person 2..N / hhm1..hhmN slots are filled from. The APPLICANT IS NOT "
    "IN THIS LIST, so household_members[0] is the first *other* person.",
    "household_members_count": "How many people household_members holds (the applicant not counted).",
    "income": "The APPLICANT's monthly income per income line, keyed by income type - e.g. "
    "`{{ income.Pension ? income.Pension : '' }}` for the 'Renten/Pensionen' row. A type the citizen has no "
    "income of is simply absent, which the usual guard reads as falsy. Each person object carries its own "
    "`income` map for that person's column: `{{ partner && partner.income.Pension ? partner.income.Pension : '' }}`.",
    "income_office": "Bewilligungsstelle per income type. One column per form row, shared by every person "
    "column, so this is NOT per person.",
    "income_reference": "Geschäftszeichen / Rentenabrechnungsnummer per income type. Also one per form row, "
    "not per person.",
    "expenses": "The APPLICANT's monthly expenses per expense line, keyed by expense type. Types whose name "
    "contains a space need bracket syntax: `{{ expenses['Health Insurance'] ? expenses['Health Insurance'] : '' }}`. "
    "Per person via `partner.expenses` / `household_members[i].expenses`.",
    "expense_notes": "Free-text note per expense type, e.g. the 'Nähere Begründung zu Sonstiges' line.",
    "assets": "The APPLICANT's asset amounts keyed by asset type. Per person via `partner.assets` etc.",
    "asset_descriptions": "Free-text description per asset type - the kind of valuables, a vehicle's estimated "
    "value, what was gifted away.",
    "income_list": "The same income rows as `income`, ordered instead of keyed, for a form that prints a "
    "numbered 'n. Art der Einnahme' list. Each row has `income_type_de` (the German wording to print), "
    "`income_type`, `monthly_amount`, `awarding_office` and `reference_no`. Index it: "
    "`{{ income_list[0] ? income_list[0].income_type_de : '' }}`. Per person via `partner.income_list` / "
    "`household_members[i].income_list`.",
    "has_any_income": "True when the person has at least one income row with an amount. Use it for the form's "
    "'Kein Einkommen' row: `{{ has_any_income ? 'Nein' : 'Ja' }}`.",
    "pending_benefit_claims": "Benefits applied for and still being decided, in form-row order, each with "
    "`benefit_type`, `event_date` (the application date) and `office_reference`. The form prints blank numbered "
    "rows, so index them: `{{ pending_benefit_claims[0] ? pending_benefit_claims[0].benefit_type : '' }}`.",
    "expected_one_time_payments": "Expected lump-sum payments, in form-row order, each with `benefit_type`, "
    "`event_date` (when it is expected) and `amount`.",
}

_PERSON_VALUED_TYPES = ("Person or null", "List[Person]")

_MONEY_KEY_ENUMS = {
    "income": "IncomeTypeType",
    "income_office": "IncomeTypeType",
    "income_reference": "IncomeTypeType",
    "expenses": "ExpenseTypeType",
    "expense_notes": "ExpenseTypeType",
    "assets": "AssetTypeType",
    "asset_descriptions": "AssetTypeType",
}
_MONEY_KEYS = (
    *_MONEY_KEY_ENUMS,
    "income_list",
    "has_any_income",
    "pending_benefit_claims",
    "expected_one_time_payments",
)


def person_columns(project_root: str, include_field_descriptions: bool = True) -> Dict[str, Any]:
    """The associated_persons columns a form may print, in the same {type, description,
    [allowed_values]} shape as user_columns, plus the German label keys that
    form_context.person_context() adds to every person row."""
    _, models_path, _ = default_paths(project_root)
    module = _load_models(models_path)

    columns: Dict[str, Any] = {}
    for column in module.AssociatedPersons.__table__.columns:
        if column.name in _PERSON_IGNORED_FIELDS:
            continue
        clean_type, allowed_values = _infer_clean_type_from_column(column)
        columns[column.name] = {"type": clean_type, "description": ""}
        if allowed_values:
            columns[column.name]["allowed_values"] = allowed_values

    columns["marital_status_de"] = {"type": "String", "description": ""}
    columns["nationality_de"] = {"type": "String", "description": ""}

    if include_field_descriptions:
        columns["association_type"]["description"] = "How this person relates to the applicant."
        columns["lives_in_household"]["description"] = (
            "Whether this person lives in the applicant's household. False for e.g. a separated spouse."
        )
        columns["relationship_to_applicant"]["description"] = (
            "Free text printed verbatim on the form (e.g. 'Ehefrau', 'Sohn'); no enum to map onto."
        )
        columns["marital_status_de"]["description"] = "This person's marital_status as the German word."
        for name, text in _COLUMN_DESCRIPTION_OVERRIDES.items():
            if name in columns:
                columns[name]["description"] = text
        columns["nationality_de"]["description"] = "This person's nationality as the German adjective."

    return columns


def _looks_like_person(value: Any, person_field_names: set) -> bool:
    """A person object identifies itself by its keys. Checking the shape rather than the
    key name keeps this correct when form_context grows another person-valued key, and
    keeps the money maps - which are also dicts - from being mistaken for people."""
    return isinstance(value, dict) and bool(value) and set(value).issubset(person_field_names)


def _derived_type_label(value: Any, person_field_names: set) -> str:
    if isinstance(value, bool):
        return "Boolean"
    if isinstance(value, datetime.date):
        return "Date (ISO YYYY-MM-DD)"
    if isinstance(value, int):
        return "Integer"
    if isinstance(value, list):
        return "List[Person]" if value and _looks_like_person(value[0], person_field_names) else "List[Object]"
    if isinstance(value, dict):
        return "Person or null" if _looks_like_person(value, person_field_names) else "Map[String -> value]"
    return "String"


def build_derived_context(project_root: str, include_field_descriptions: bool = True) -> Dict[str, Any]:
    """The third namespace: everything the JEXL context holds that is neither a Users
    column nor a document. Built by calling form_context.derived_context() with stand-in
    values, so the key list can never drift from what the running service supplies.

    Shaped as {"person_fields": …, "keys": …} rather than one flat map: `partner` and
    every `household_members[i]` share the same associated_persons columns, so the column
    map is spelled out once and the person-valued keys point at it by type name."""
    form_context = _load_form_context(project_root)
    _, models_path, _ = default_paths(project_root)
    models = _load_models(models_path)

    stand_in = models.AssociatedPersons(
        association_type=next(iter(form_context.PARTNER_TYPES)), lives_in_household=True, sort_order=0
    )
    derived = form_context.derived_context({"date_of_birth": datetime.date(1950, 1, 1)}, [stand_in])
    fields = person_columns(project_root, include_field_descriptions)
    person_field_names = set(fields) | set(_MONEY_KEYS) | _PERSON_IGNORED_FIELDS

    keys: Dict[str, Any] = {}
    for key, value in derived.items():
        entry: Dict[str, Any] = {
            "type": _derived_type_label(value, person_field_names),
            "description": _DERIVED_DESCRIPTIONS.get(key, "") if include_field_descriptions else "",
        }
        enum_name = _MONEY_KEY_ENUMS.get(key)
        if enum_name:
            enum_cls = getattr(models, enum_name)
            entry["allowed_keys"] = [member.value for member in enum_cls]
        keys[key] = entry
    return {"person_fields": fields, "keys": keys, "person_money_keys": sorted(_MONEY_KEYS)}


def _decimal_or_none(value: Any) -> Optional[decimal.Decimal]:
    return decimal.Decimal(str(value)) if value is not None else None


def _money_rows_for_person(models, person_id: Any, data: Dict[str, Any]) -> list:
    """Money-grid rows for one evaluation profile (person_id=None for the applicant), read
    straight off the profile's own `income_entries`/`expense_entries`/
    `asset_entries`/`benefit_claim_entries` lists - their row fields already match the
    ORM column names."""
    rows: list = []

    incomes = data.get("income_entries") or []
    for entry in incomes:
        rows.append(
            models.IncomeEntries(
                person_id=person_id,
                income_type=models.IncomeTypeType(entry["income_type"]),
                monthly_amount=_decimal_or_none(entry.get("monthly_amount")),
                awarding_office=entry.get("awarding_office"),
                reference_no=entry.get("reference_no"),
            )
        )
    if not incomes:
        scalar = data.get("monthly_income") if person_id is None else data.get("monthly_pension_income")
        if scalar:
            rows.append(
                models.IncomeEntries(
                    person_id=person_id, income_type=models.IncomeTypeType.PENSION, monthly_amount=_decimal_or_none(scalar)
                )
            )

    for entry in data.get("expense_entries") or []:
        rows.append(
            models.ExpenseEntries(
                person_id=person_id,
                expense_type=models.ExpenseTypeType(entry["expense_type"]),
                monthly_amount=_decimal_or_none(entry.get("monthly_amount")),
                note=entry.get("note"),
            )
        )

    for entry in data.get("asset_entries") or []:
        rows.append(
            models.AssetEntries(
                person_id=person_id,
                asset_type=models.AssetTypeType(entry["asset_type"]),
                amount=_decimal_or_none(entry.get("amount")),
                description=entry.get("description"),
            )
        )

    for index, entry in enumerate(data.get("benefit_claim_entries") or []):
        rows.append(
            models.BenefitClaimEntries(
                person_id=person_id,
                claim_kind=models.BenefitClaimKindType(entry["claim_kind"]),
                sort_order=entry.get("sort_order", index),
                benefit_type=entry.get("benefit_type"),
                event_date=datetime.date.fromisoformat(entry["event_date"]) if entry.get("event_date") else None,
                amount=_decimal_or_none(entry.get("amount")),
                office_reference=entry.get("office_reference"),
            )
        )

    return rows


def profile_derived_context(project_root: str, profile: Dict[str, Any]) -> Dict[str, Any]:
    """The derived context keys for one evaluation profile, computed by the very same
    form_context code the service runs, from the profile's own `associated_persons` list
    (absent or empty means a single-person household: `partner` null, `household_members`
    empty). Without this an evaluation profile is a flat Users row, and every generated
    `partner.…` / `household_members[…]` expression scores as a syntax crash rather than
    being evaluated."""
    form_context = _load_form_context(project_root)
    _, models_path, _ = default_paths(project_root)
    models = _load_models(models_path)
    person_names = {column.name for column in models.AssociatedPersons.__table__.columns}

    people = []
    money_entries = _money_rows_for_person(models, None, profile)
    for index, row in enumerate(profile.get("associated_persons") or []):
        kwargs = {name: value for name, value in row.items() if name in person_names}
        kwargs.setdefault("lives_in_household", True)
        kwargs.setdefault("sort_order", index)
        kwargs.setdefault("id", uuid.uuid4())
        for date_field in ("date_of_birth",):
            if isinstance(kwargs.get(date_field), str):
                kwargs[date_field] = datetime.date.fromisoformat(kwargs[date_field])
        person = models.AssociatedPersons(**kwargs)
        people.append(person)
        money_entries.extend(_money_rows_for_person(models, person.id, row))

    user_row = dict(profile)
    if isinstance(user_row.get("date_of_birth"), str):
        user_row["date_of_birth"] = datetime.date.fromisoformat(user_row["date_of_birth"])
    return form_context.derived_context(user_row, people, money_entries)


def build_schema_context(
    project_root: str,
    include_documents: bool = True,
    include_field_descriptions: bool = True,
    include_derived: bool = False,
) -> Dict[str, Any]:
    """When include_documents=False, returns the flat {name: {type, description,
    [allowed_values]}} dict exactly as evaluate.py originally built it inline — this
    preserves byte-for-byte reproducibility of the recorded 86.3% benchmark control run.
    When include_documents=True, nests the same data under "user_columns" alongside a
    new "documents" key, since the model needs the two namespaces disambiguated.

    include_derived adds a third "derived_context" namespace (`partner`,
    `household_members`, `today`, `age`, …). It defaults to off so the control run stays
    reproducible; generate_mapping.py turns it on, because without it no generated mapping
    can ever reach a form's Person 2..N slots.

    Excludes internal/audit fields (see _IGNORED_LLM_FIELDS) that the LLM should never
    be offered as a mappable identifier - use all_user_columns() instead when you need
    every real column, e.g. for validating an existing hand-written expression."""
    _, _, document_types_path = default_paths(project_root)

    full_columns = all_user_columns(project_root, include_field_descriptions)
    user_columns = {name: info for name, info in full_columns.items() if name not in _IGNORED_LLM_FIELDS}

    if not include_documents:
        if include_derived:
            raise ValueError("include_derived requires include_documents (the flat shape has no namespaces)")
        return user_columns

    document_types = parse_document_types(document_types_path)
    documents: Dict[str, Any] = {}
    for slug, info in document_types.items():
        fields = {}
        for fname, finfo in info["fields"].items():
            fields[fname] = (
                {"type": finfo["type"], "description": finfo["description"]}
                if include_field_descriptions
                else {"type": finfo["type"]}
            )
        documents[slug] = {
            "description": info["description"] if include_field_descriptions else "",
            "fields": fields,
        }

    context = {"user_columns": user_columns, "documents": documents}
    if include_derived:
        context["derived_context"] = build_derived_context(project_root, include_field_descriptions)
    return context
