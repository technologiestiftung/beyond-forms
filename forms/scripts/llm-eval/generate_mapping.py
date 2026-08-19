"""generate_mapping.py - Fills in JEXL *values* for a PDF field mapping TOML produced by
forms/scripts/extract_to_mapping.sh, using an LLM grounded in the live Users/documents
schema. Fields with no plausible data source are left blank.

Usage:
    uv run forms/scripts/llm-eval/generate_mapping.py --form antrag_bewohnerparkausweis
"""

import argparse
import datetime
import os
import re
import sys
from typing import Any, Dict, Optional, Tuple

import tomllib
from pyjexl import JEXL

sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
from schema_context import build_schema_context, StrictDict, dummy_value
from evaluate import (
    load_boilerplate,
    resolve_jexl_value,
    run_llm_chunk,
    run_self_correction,
)

_DOCUMENT_REF_RE = re.compile(r"documents\.([a-zA-Z_][a-zA-Z0-9_]*)(?:\.([a-zA-Z_][a-zA-Z0-9_]*))?")
_HEADER_RE = re.compile(r"^\[(.+)\]\s*$")

_HEADER_BLOCK_START = "# !! AI-DRAFTED MAPPING - NEEDS HUMAN REVIEW BEFORE USE !!"


class MappingValidator:
    """No LLM, no DB: checks a generated JEXL expression against the parsed schema
    context alone. Anything that fails is reset to a blank value rather than shipped."""

    def __init__(self, user_columns: Dict[str, Any], documents: Dict[str, Any]):
        self.user_columns = user_columns
        self.documents = documents
        self._jexl = JEXL()
        self._dummy_ctx = StrictDict({name: dummy_value(info) for name, info in user_columns.items()})
        self._dummy_ctx["documents"] = {}

    def check(self, expr: str) -> Tuple[bool, Optional[str]]:
        if not isinstance(expr, str) or not expr.strip():
            return True, None

        for match in _DOCUMENT_REF_RE.finditer(expr):
            slug, field = match.group(1), match.group(2)
            if slug not in self.documents:
                return False, f"unknown document type '{slug}'"
            if field is not None and field not in self.documents[slug]["fields"]:
                return False, f"unknown field '{field}' on document type '{slug}'"

        _, syntax_ok, err_msg = resolve_jexl_value(expr, self._dummy_ctx, self._jexl)
        if not syntax_ok:
            return False, err_msg

        return True, None


def load_prompt(script_dir: str, name: str) -> str:
    prompt_path = os.path.join(script_dir, f"prompts/{name}.txt")
    if not os.path.exists(prompt_path):
        print(f"Error: Prompt template not found at {prompt_path}", file=sys.stderr)
        sys.exit(1)
    with open(prompt_path, "r", encoding="utf-8") as f:
        return f.read()


def load_current_values(toml_path: str) -> Dict[str, Any]:
    with open(toml_path, "rb") as f:
        mapping = tomllib.load(f)
    values = {}
    for field_id, field_info in mapping.items():
        if isinstance(field_info, dict):
            values[field_id] = field_info.get("value", "")
        else:
            values[field_id] = field_info
    return values


def _is_blank(current_value: Any, field_type: str) -> bool:
    if field_type == "checkbox":
        return current_value in ("", False)
    return current_value in ("", None)


def generate_values(
    prompt_template: str,
    self_correct_template: Optional[str],
    schema_context: dict,
    boilerplate: Dict[str, Any],
    model_name: str,
    chunk_size: int,
    execute_self_correct: bool,
    validator: MappingValidator,
) -> Tuple[Dict[str, Any], Dict[str, str], Dict[str, str]]:
    """
    Returns (values, rejected_notes).
    """
    items = list(boilerplate.items())
    values: Dict[str, Any] = {}
    rejected_notes: Dict[str, str] = {}
    jexl = JEXL()

    for i in range(0, len(items), chunk_size):
        chunk_items = dict(items[i : i + chunk_size])
        print(f"  Processing batch {i + 1} to {min(i + chunk_size, len(items))}...")

        try:
            chunk_result = run_llm_chunk(prompt_template, schema_context, chunk_items, model_name)
        except Exception as e:
            print(f"  Error processing chunk {i + 1}-{min(i + chunk_size, len(items))}: {e}", file=sys.stderr)
            continue

        for fid, expr in chunk_result.items():
            if fid not in chunk_items:
                continue
            norm_expr = expr.strip() if isinstance(expr, str) else expr

            if execute_self_correct and self_correct_template and isinstance(norm_expr, str):
                _, syntax_ok, err_msg = resolve_jexl_value(norm_expr, {"documents": {}}, jexl)
                if not syntax_ok and err_msg:
                    print(f"    [Self-Correct Loop] Triggered for '{fid}': {err_msg}")
                    norm_expr = run_self_correction(
                        self_correct_template, schema_context, fid, norm_expr, err_msg, model_name
                    )

            ok, reason = validator.check(norm_expr)
            if ok:
                values[fid] = norm_expr
            else:
                rejected_notes[fid] = reason or "validator rejected expression"
                values[fid] = False if chunk_items[fid].get("type") == "checkbox" else ""

    return values, rejected_notes


def _decode_header_key(header_line: str) -> Optional[str]:
    m = _HEADER_RE.match(header_line.strip())
    if not m:
        return None
    try:
        parsed = tomllib.loads(f"{header_line.strip()}\nx = 1\n")
    except tomllib.TOMLDecodeError:
        return None
    for key in parsed:
        if key != "x":
            return key
    return None


def _value_span_end(lines, value_line_idx: int, table_end: int) -> int:
    """Returns the last line index (inclusive) of the `value = ...` assignment starting
    at value_line_idx - value_line_idx itself for a normal single-line value, or the
    closing-quote line's index for a TOML multi-line basic/literal string (`\"\"\"`/`'''`),
    so callers can replace the whole span instead of corrupting a multi-line block."""
    stripped = lines[value_line_idx].lstrip()
    m = re.match(r"^value\s*=\s*(.*)$", stripped, re.DOTALL)
    rest = m.group(1) if m else ""
    for quote in ('"""', "'''"):
        if rest.startswith(quote):
            # Single-line triple-quoted (e.g. value = """foo""") closes on the same line.
            if quote in rest[3:]:
                return value_line_idx
            for idx in range(value_line_idx + 1, table_end):
                if quote in lines[idx]:
                    return idx
            return table_end - 1  # malformed/unterminated - best effort, caller will just overwrite it
    return value_line_idx


def _toml_quote(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    escaped = str(value).replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def render_toml_in_place(
    toml_path: str,
    values: Dict[str, Any],
    model_name: str,
    dry_run: bool,
) -> Dict[str, int]:
    with open(toml_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    # Strip a pre-existing header block (idempotent re-run) before reinserting one.
    if lines and lines[0].startswith(_HEADER_BLOCK_START):
        end = 0
        while end < len(lines) and lines[end].startswith("#"):
            end += 1
        while end < len(lines) and lines[end].strip() == "":
            end += 1
        lines = lines[end:]

    current_key: Optional[str] = None
    table_bounds: Dict[str, Tuple[int, int]] = {}  # key -> (start_line_idx_after_header, end_line_idx_exclusive)
    start_idx = None
    for idx, line in enumerate(lines):
        if _HEADER_RE.match(line.strip()):
            if current_key is not None:
                table_bounds[current_key] = (start_idx, idx)
            current_key = _decode_header_key(line)
            start_idx = idx + 1
    if current_key is not None:
        table_bounds[current_key] = (start_idx, len(lines))

    missing_keys = [k for k in values if k not in table_bounds]
    if missing_keys:
        raise RuntimeError(f"Could not locate header(s) for: {missing_keys[:5]} (aborting, no write performed)")

    stats = {"mapped": 0, "left_empty": 0}

    # Apply edits bottom-to-top so line indices for tables above remain valid.
    edits = []
    for key, (start, end) in table_bounds.items():
        has_new_value = key in values
        new_value = values.get(key)

        value_span = None  # (first_line_idx, last_line_idx) inclusive - covers multi-line """ values
        for i in range(start, end):
            if re.match(r"^value\s*=", lines[i].lstrip()):
                value_span = (i, _value_span_end(lines, i, end))
                break

        if value_span is None:
            raise RuntimeError(f"Table '{key}' has no `value` line (aborting, no write performed)")

        edits.append((start, end, value_span, key, has_new_value, new_value))

    edits.sort(key=lambda e: e[2][0], reverse=True)

    for start, end, value_span, key, has_new_value, new_value in edits:
        value_line_idx, value_span_end = value_span
        if has_new_value:
            lines[value_line_idx : value_span_end + 1] = [f"value = {_toml_quote(new_value)}\n"]
            is_blank = new_value in ("", False, None)

            if is_blank:
                stats["left_empty"] += 1
            else:
                stats["mapped"] += 1

    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    header = (
        f"{_HEADER_BLOCK_START}\n"
        f"# Generated by forms/scripts/llm-eval/generate_mapping.py on {now} with {model_name}.\n"
        f"# Values below are LLM-proposed JEXL, NOT verified against a real citizen record.\n"
    )
    lines = [header] + lines

    if not dry_run:
        with open(toml_path, "w", encoding="utf-8") as f:
            f.writelines(lines)

    return stats


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fill in JEXL mapping values for a PDF field mapping TOML, using an LLM grounded in the "
        "live Users/documents schema. Fields with no plausible data source are left blank."
    )
    parser.add_argument("--form", required=True, help="Path to the form mapping to fill")
    parser.add_argument("--model", default="gemini-3.5-flash-lite", help="LLM model name")
    parser.add_argument("--prompt", default="rich_schema_documents", help="Prompt template file name")
    parser.add_argument("--chunk-size", type=int, default=100, help="Fields submitted per LLM request chunk")
    parser.add_argument(
        "--self-correct", action="store_true", help="Run a self-correction pass on JEXL syntax crashes"
    )
    parser.add_argument(
        "--overwrite-existing",
        action="store_true",
        help="Also regenerate fields that already have a non-empty value (default: only fill blanks)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Print the plan without writing the file")
    args = parser.parse_args()

    script_dir = os.path.dirname(os.path.realpath(__file__))
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(script_dir)))

    toml_path = args.form
    if not os.path.exists(toml_path):
        print(f"Error: Mapping file not found at {toml_path}", file=sys.stderr)
        sys.exit(1)

    boilerplate = load_boilerplate(toml_path)
    current_values = load_current_values(toml_path)
    schema_context = build_schema_context(project_root, include_documents=True)
    validator = MappingValidator(schema_context["user_columns"], schema_context["documents"])

    if args.overwrite_existing:
        to_generate = boilerplate
    else:
        to_generate = {
            fid: info
            for fid, info in boilerplate.items()
            if _is_blank(current_values.get(fid, ""), info.get("type", "string"))
        }

    print(
        f"{args.form}: {len(boilerplate)} fields total, {len(to_generate)} submitted to the model "
        f"({'all, --overwrite-existing set' if args.overwrite_existing else 'blank only'})"
    )

    if not to_generate:
        print("Nothing to generate - every field already has a value. Pass --overwrite-existing to regenerate.")
        return

    prompt_template = load_prompt(script_dir, args.prompt)
    self_correct_template = load_prompt(script_dir, "self_correction") if args.self_correct else None

    values, rejected_notes = generate_values(
        prompt_template=prompt_template,
        self_correct_template=self_correct_template,
        schema_context=schema_context,
        boilerplate=to_generate,
        model_name=args.model,
        chunk_size=args.chunk_size,
        execute_self_correct=args.self_correct,
        validator=validator,
    )

    if args.dry_run:
        print(f"\n[dry-run] Would update {len(values)} field(s) in {toml_path}:")
        for fid, val in values.items():
            print(f"  {fid} = {val!r}")
        return

    stats = render_toml_in_place(toml_path, values, args.model, dry_run=False)

    print(f"\nWrote {toml_path} ({len(boilerplate)} fields)")
    print(f"  mapped:        {stats['mapped']}")
    print(f"  left empty:    {stats['left_empty']}  (generic/non-semantic labels)")
    if rejected_notes:
        print(f"  rejected by validator: {len(rejected_notes)} (hallucinated/invalid, reset to blank)")


if __name__ == "__main__":
    main()
