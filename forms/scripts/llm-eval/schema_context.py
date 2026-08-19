import datetime
import decimal
import importlib.util
import os
import sys
import types
import typing
from typing import Any, Dict, Tuple

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
    columns - any typo'd/hallucinated identifier surfaces as an error immediately."""

    def __getitem__(self, key):
        if key not in self:
            raise NameError(f"Undefined identifier: {key}")
        return super().__getitem__(key)


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
        return "2024-01-01"  # ISO format sorts lexicographically, so >/< still behave
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
        if include_field_descriptions and field_name in schema_fields:
            description = schema_fields[field_name].get("description", "")
        user_columns[field_name] = {"type": clean_type, "description": description}
        if allowed_values:
            user_columns[field_name]["allowed_values"] = allowed_values

    return user_columns


def build_schema_context(
    project_root: str,
    include_documents: bool = True,
    include_field_descriptions: bool = True,
) -> Dict[str, Any]:
    """When include_documents=False, returns the flat {name: {type, description,
    [allowed_values]}} dict exactly as evaluate.py originally built it inline — this
    preserves byte-for-byte reproducibility of the recorded 86.3% benchmark control run.
    When include_documents=True, nests the same data under "user_columns" alongside a
    new "documents" key, since the model needs the two namespaces disambiguated.

    Excludes internal/audit fields (see _IGNORED_LLM_FIELDS) that the LLM should never
    be offered as a mappable identifier - use all_user_columns() instead when you need
    every real column, e.g. for validating an existing hand-written expression."""
    _, _, document_types_path = default_paths(project_root)

    full_columns = all_user_columns(project_root, include_field_descriptions)
    user_columns = {name: info for name, info in full_columns.items() if name not in _IGNORED_LLM_FIELDS}

    if not include_documents:
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

    return {"user_columns": user_columns, "documents": documents}
