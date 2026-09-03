#!/usr/bin/env python3
"""Exports the Pydantic document-schemas models as JSON Schema, keyed by document_type.

Documents `user_documents.raw_data`, which holds one of these shapes depending on
that row's `document_type` (see libs/document-schemas).
"""
import json
from pathlib import Path

from beyondforms.document_schemas.document_registry import document_registry

OUT_FILE = Path(__file__).parent.parent / "libs/db-schema/raw_data.schema.json"

schemas = {
    slug: document_registry.get_or_raise(slug).model_json_schema()
    for slug in sorted(document_registry.list_keys())
}

OUT_FILE.write_text(json.dumps(schemas, indent=2, ensure_ascii=False) + "\n")
print(f"Wrote {len(schemas)} document schemas to {OUT_FILE}")
