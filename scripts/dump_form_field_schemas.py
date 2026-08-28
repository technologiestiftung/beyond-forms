"""Transcribes each form's AcroForm field structure into JSON Schema, 1:1, per form_type.

This is not a schema of `user_applications.form_data` — that JSONB column has no
formal schema because different form_types have different fields. This instead 
documents the actual PDF fields that gets filled for each form_type — field id, 
PDF widget type, and any options — read directly from forms/mappings/<form_type>.toml.
"""
import json
import tomllib
from pathlib import Path

ROOT = Path(__file__).parent.parent
MAPPINGS_DIR = ROOT / "forms/mappings"
OUT_FILE = ROOT / "libs/db-schema/form_fields.schema.json"

# AcroForm widget type -> JSON Schema type. "unknown" fields are left untyped.
TYPE_MAP = {
    "checkbox": "boolean",
    "string": "string",
    "choice": "string",
    "radio": "string",
}


def field_schema(field_id: str, info: dict) -> dict:
    acroform_type = info.get("type", "unknown") if isinstance(info, dict) else "unknown"
    schema = {"x-acroform-type": acroform_type}
    if acroform_type in TYPE_MAP:
        schema["type"] = TYPE_MAP[acroform_type]
    if isinstance(info, dict):
        if info.get("description"):
            schema["description"] = info["description"]
        if info.get("nearby_label"):
            schema["x-nearby-label"] = info["nearby_label"]
        if info.get("options"):
            schema["enum"] = info["options"]
        if info.get("option_labels"):
            schema["x-option-labels"] = info["option_labels"]
        if info.get("read_only"):
            schema["readOnly"] = True
    return schema


def derive_schema(raw_mapping: dict) -> dict:
    return {
        "type": "object",
        "properties": {field_id: field_schema(field_id, info) for field_id, info in raw_mapping.items()},
    }


def main() -> None:
    schemas = {
        toml_file.stem: derive_schema(tomllib.loads(toml_file.read_text()))
        for toml_file in sorted(MAPPINGS_DIR.glob("*.toml"))
    }

    OUT_FILE.write_text(json.dumps({
        "$comment": (
            "PDF AcroForm field structure per form_type, transcribed 1:1 from "
            "forms/mappings/*.toml by scripts/dump_form_field_schemas.py. This is "
            "what actually gets filled in each PDF; it is NOT the schema of "
            "user_applications.form_data (that column has no formal schema)."
        ),
        "schemas": schemas,
    }, indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote AcroForm field schemas for {len(schemas)} forms to {OUT_FILE}")


if __name__ == "__main__":
    main()
