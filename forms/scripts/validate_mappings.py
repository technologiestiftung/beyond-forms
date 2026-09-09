import argparse
import datetime
import decimal
import importlib.util
import re
import sys
import tomllib
import types
import uuid
from pathlib import Path
from typing import Any, Dict, List

from pyjexl import JEXL

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
MAPPING_DIR = SCRIPT_DIR.parent / "mappings"
SERVICE_SRC = REPO_ROOT / "services/orchestration-middleware-service/src"

TEMPLATE_RE = re.compile(r"\{\{\s*(.*?)\s*\}\}", re.DOTALL)


class StrictDict(dict):
    """Raises on any key it does not hold, so a typo'd identifier surfaces as an error
    instead of resolving to None. pyjexl reads dotted access via `.get()` and subscripts
    via `[]`, so both need overriding."""

    def __getitem__(self, key):
        if key not in self:
            raise NameError(f"Undefined identifier: {key}")
        return super().__getitem__(key)

    def get(self, key, default=None):
        return self[key]


class PermissiveDict(dict):
    """The `documents` namespace, where a missing key is legitimate: OCR fields come from
    whichever documents a user happened to upload, so mappings guard them with a ternary
    rather than relying on them existing."""

    def __missing__(self, key):
        return PermissiveDict()

    def __getitem__(self, key):
        if key not in self:
            return PermissiveDict()
        return super().__getitem__(key)


def _load(module_name: str, file_path: Path):
    """Loads a service module by path under an explicit name. The monorepo has many
    unrelated `src/` directories, so a synthetic `src` package is registered rather than
    relying on sys.path, which could resolve to the wrong service."""
    if module_name in sys.modules:
        return sys.modules[module_name]
    if "src" not in sys.modules:
        package = types.ModuleType("src")
        package.__path__ = []
        sys.modules["src"] = package
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    parent, _, leaf = module_name.rpartition(".")
    if parent:
        setattr(sys.modules[parent], leaf, module)
    return module


def _dummy_value(column) -> Any:
    """A type-appropriate stand-in, so a numeric comparison in a mapping does not fail
    validation with a TypeError that says nothing about the expression's correctness."""
    if getattr(column.type, "enums", None):
        return column.type.enums[0]
    python_type = column.type.python_type
    if python_type is bool:
        return True
    if python_type is decimal.Decimal:
        return decimal.Decimal("0")
    if python_type is int:
        return 0
    if python_type in (datetime.date, datetime.datetime):
        return datetime.date(2024, 1, 1)
    if python_type in (dict, list):
        return ["dummy"]
    return "dummy"


def _stand_in_money_entries(models, person) -> List[Any]:
    """One row of every money-grid type, for the applicant and for the stand-in person, so
    `income.Pension` and `partner.income.Pension` both resolve. Driven off the enums, so a
    new income line needs no change here."""
    entries: List[Any] = []
    for owner in (None, person.id):
        for member in models.IncomeTypeType:
            entries.append(
                models.IncomeEntries(
                    person_id=owner,
                    income_type=member,
                    monthly_amount=decimal.Decimal("1"),
                    awarding_office="dummy",
                    reference_no="dummy",
                )
            )
        for member in models.ExpenseTypeType:
            entries.append(
                models.ExpenseEntries(
                    person_id=owner, expense_type=member, monthly_amount=decimal.Decimal("1"), note="dummy"
                )
            )
        for member in models.AssetTypeType:
            entries.append(
                models.AssetEntries(
                    person_id=owner, asset_type=member, amount=decimal.Decimal("1"), description="dummy"
                )
            )
        for member in models.BenefitClaimKindType:
            entries.append(
                models.BenefitClaimEntries(
                    person_id=owner,
                    claim_kind=member,
                    sort_order=0,
                    benefit_type="dummy",
                    event_date=datetime.date(2024, 1, 1),
                    amount=decimal.Decimal("1"),
                    office_reference="dummy",
                )
            )
    return entries


def build_context() -> Dict[str, Any]:
    models = _load("src.models", SERVICE_SRC / "models.py")
    _load("src.services", SERVICE_SRC / "services/__init__.py")
    form_context = _load("src.services.form_context", SERVICE_SRC / "services/form_context.py")

    from beyondforms.document_schemas.document_registry import document_registry

    context = StrictDict({column.name: _dummy_value(column) for column in models.Users.__table__.columns})

    person_columns = {column.name: _dummy_value(column) for column in models.AssociatedPersons.__table__.columns}

    def strict_person(person_dict: Dict[str, Any]) -> StrictDict:
        """A real person dict - so it carries that person's money grids - with typed
        stand-ins for the columns and strict lookup, so a hallucinated field raises rather
        than resolving to None."""
        return StrictDict({**person_dict, **person_columns})

    dummy_person = models.AssociatedPersons(
        id=uuid.uuid4(),
        association_type=next(iter(form_context.PARTNER_TYPES)),
        lives_in_household=True,
        sort_order=0,
    )
    derived = form_context.derived_context(
        {"date_of_birth": datetime.date(1950, 1, 1)},
        [dummy_person],
        _stand_in_money_entries(models, dummy_person),
    )
    person_shape = set(form_context.row_to_dict(dummy_person)) | set(form_context.label_context({}))
    for key, value in derived.items():
        if isinstance(value, dict) and person_shape.issubset(value):
            context[key] = strict_person(value)
        elif isinstance(value, list) and value and isinstance(value[0], dict) and person_shape.issubset(value[0]):
            context[key] = [strict_person(item) for item in value]
        else:
            context[key] = value

    context["documents"] = {slug: PermissiveDict() for slug in document_registry.list_keys()}
    print(
        f"Loaded {len(models.Users.__table__.columns)} Users columns, "
        f"{len(derived)} derived keys and {len(context['documents'])} document types."
    )
    return context


def build_sparse_context() -> Dict[str, Any]:
    """The other context a mapping has to survive: a citizen who filled in nothing. Every
    Users column null, no documents uploaded, no partner and nobody else in the household.

    A mapping checked only against fully-populated stand-ins passes while still holding
    expressions that raise the moment real, sparse data arrives - `'Stocks' in
    assets_types` (TypeError on a null list), or `documents.X.y` / `partner.first_name`
    (AttributeError on None). Those are exactly the guards the house style requires, so
    this second pass is what actually enforces them."""
    models = _load("src.models", SERVICE_SRC / "models.py")
    _load("src.services", SERVICE_SRC / "services/__init__.py")
    form_context = _load("src.services.form_context", SERVICE_SRC / "services/form_context.py")

    context = StrictDict({column.name: None for column in models.Users.__table__.columns})
    context.update(form_context.derived_context({}, []))
    context["documents"] = {}
    return context


def validate(toml_path: Path, contexts: Dict[str, Dict[str, Any]], jexl: JEXL) -> List[str]:
    try:
        mapping = tomllib.loads(toml_path.read_text())
    except Exception as error:
        return [f"  [ERROR] Failed to parse TOML {toml_path}: {error}"]

    errors = []
    for field_id, field_info in mapping.items():
        value = field_info.get("value") if isinstance(field_info, dict) else field_info
        if not isinstance(value, str):
            continue
        for expr in TEMPLATE_RE.findall(value):
            for label, context in contexts.items():
                try:
                    jexl.evaluate(expr, context)
                except Exception as error:
                    errors.append(
                        f"  [ERROR] In field '{field_id}' ({label} profile): "
                        f"Expression '{{{{ {expr} }}}}' failed: {error}"
                    )
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "mappings",
        nargs="*",
        type=Path,
        help="TOML files to check (default: every file in forms/mappings)",
    )
    args = parser.parse_args()

    contexts = {"populated": build_context(), "empty": build_sparse_context()}
    jexl = JEXL()

    failed = False
    for toml_path in args.mappings or sorted(MAPPING_DIR.glob("*.toml")):
        display = toml_path.resolve()
        display = display.relative_to(REPO_ROOT) if display.is_relative_to(REPO_ROOT) else display
        print(f"Validating {display}...")
        errors = validate(toml_path, contexts, jexl)
        for error in errors:
            print(error)
        failed |= bool(errors)

    print("\nValidation failed with errors." if failed else "\nAll mappings validated successfully!")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
