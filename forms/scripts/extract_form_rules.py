"""Derives a CEL rule file from a fillable PDF: which AcroForm fields form one question, what
they mean, and under which condition each question applies. The AcroForm fields are the ground
truth: Gemini sees each page with every field's number drawn onto its box, and every field must
end up in a group or explicitly out of scope. A field the model names that the PDF doesn't
have, or a condition that doesn't type-check against the declared fields, is sent back to the
model to fix.

    uv run forms/scripts/extract_form_rules.py forms/pdfs/antrag_grundsicherung_im_alter.pdf \
        --attachments forms/pdfs/anlage_1_grusi.pdf forms/pdfs/anlage_2_grusi.pdf forms/pdfs/anlage_3_grusi.pdf \
        forms/pdfs/anlage_6_grusi.pdf --context forms/pdfs/merkblatt_grundsicherung_im_alter.pdf
"""

import argparse
import asyncio
import base64
import datetime
import hashlib
import json
import os
import re
import sys
import unicodedata
from pathlib import Path
from typing import Literal, Optional

import google.auth
import pymupdf
from cel_expr_python import cel
from litellm import acompletion
from pydantic import BaseModel, Field, ValidationError

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "services/forms-filling-service"))
from src.pdfs.pdf_fields import get_pdf_fields  # noqa: E402
from src.pdfs.utils import generate_id  # noqa: E402

RULES_DIR = REPO_ROOT / "schemas/rules"
MAX_FIX_ROUNDS = 2
RENDER_DPI = 150

AnswerType = Literal[
    "text",
    "number",
    "money",
    "date",
    "name",
    "address",
    "phone_number",
    "email",
    "iban",
    "single_choice",
    "multiple_choice",
    "yes_no",
]


class Option(BaseModel):
    value: str = Field(description="The field's export value, exactly as listed in the field table")
    label: str = Field(description="The text printed next to this box on the page")


class GroupField(BaseModel):
    var: str = Field(description="The field's var from the field table")
    meaning: str = Field(
        description="What this one field holds, in the form's own German wording, e.g. 'verheiratet' for one "
        "box of a marital status question or 'Postleitzahl' for one line of an address"
    )
    options: list[Option] = Field(
        default_factory=list,
        description="Only for radio and choice fields: one entry per export value, labelled with the printed "
        "text next to it. Never invent an option.",
    )
    optional: bool = Field(
        description="True only if the form itself marks this field as optional, e.g. 'ggf. Geburtsname' or "
        "'falls vorhanden'. Never because another field can answer the question instead: such alternatives "
        "belong in a single_choice or multiple_choice group."
    )


class Document(BaseModel):
    name: str = Field(description="The attachment or proof the form asks for, e.g. 'Anlage 2' or 'Bestallung'")
    condition: str = Field(description="CEL expression over the vars; when it is true the document is needed")
    form_id: Optional[str] = Field(
        description="If the document is one of the attachment forms listed in the prompt, its form_id, else null"
    )


class Group(BaseModel):
    id: str = Field(description="snake_case id for this question, unique on the page")
    section: str = Field(description="The heading of the form section, e.g. 'I. Antragsteller/in'")
    person: Optional[str] = Field(
        description="The Personenziffer column this question is about, e.g. 'Personenziffer 2', or null"
    )
    topic: str = Field(description="The question title, usually bigger or bolder than the text around it")
    hint: Optional[str] = Field(description="Hint text next to the question, e.g. 'Zutreffendes bitte ankreuzen'")
    answer_type: AnswerType = Field(
        description="single_choice/multiple_choice if the user ticks boxes, yes_no for a Ja/Nein pair, "
        "money for amounts in euro, otherwise what the text fields hold. A choice group holds only checkbox, "
        "radio and choice fields; a text field that belongs to one option, e.g. the name of another nationality, "
        "is its own group whose ask_if checks that option."
    )
    ask_if: str = Field(
        description="CEL expression over the vars: when the question applies. 'true' if always. Example: "
        "the partner's columns only apply when the applicant has a spouse or partner."
    )
    required: bool = Field(
        description="False only when leaving all of the question's fields empty is a valid answer, e.g. a "
        "list of boxes of which none may apply"
    )
    fields: list[GroupField]
    reason: Optional[str] = Field(
        description="Why the form asks this question, e.g. its legal basis, in German and only as the "
        "explanations below state it; null if they don't"
    )
    documents: list[Document] = Field(
        default_factory=list,
        description="Attachments the question routes to, e.g. '→ Bitte Anlage 2 ausfüllen'",
    )


class OutOfScope(BaseModel):
    var: str
    reason: Literal["office_use", "signature", "static_text", "other"]


class PageExtraction(BaseModel):
    alert: Optional[str] = Field(description="Anything that prevented a reliable extraction, otherwise null")
    groups: list[Group]
    out_of_scope: list[OutOfScope]


PROMPT = """You turn one page of a German administrative form into rules for a chat assistant that \
fills the form in conversation. The assistant asks one question at a time and must know which fields \
are still open.

The image shows the page with a red box and a red number (#n) drawn onto every fillable field. A \
radio field with several boxes shows #n=<export value> on each box, so you can read which printed \
option each export value stands for.

Group the fields into the questions a person would answer, the way the form presents them. Every \
field in the table below must appear exactly once: either in one group's fields, or in out_of_scope \
(fields filled by the office, e.g. 'vom Amt auszufüllen', signatures, and fixed text the applicant \
never answers). Use only the vars from the table.

Conditions are CEL expressions (https://cel.dev) over the vars of this whole form. A checkbox var is \
a bool (false when unticked). Every other var is a string: "" when empty, otherwise the text or, for \
radio and choice fields, the export value of the selected option (e.g. `x == "Ja"`). Do not compare a \
bool to a string or use functions outside standard CEL. Conditions may refer to fields on other pages; \
their vars are listed in the catalog. Derive conditions only from what the form says (routing arrows, \
'falls ja', 'nur ausfüllen wenn', columns for a second person); write 'true' when the form gives none.

Write topic, hint, meaning and option labels in German, using the form's own wording.

When the form routes to one of these attachment forms (e.g. '→ Bitte Anlage 2 ausfüllen'), add it to the \
group's documents with its form_id, so its questions are asked whenever the condition holds:
{attachments}

Explanations that come with the form (e.g. its Merkblatt). Where they say why a question is asked, \
put that into the group's reason. Never invent a reason or a paragraph:
{context}

# Fields on this page
{page_fields}

# Page text
{page_text}

# Catalog: fields on the other pages
{catalog}
"""


def cel_var(field_id: str) -> str:
    ascii_id = unicodedata.normalize(
        "NFKD", field_id.translate(str.maketrans({"ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss"}))
    )
    return re.sub(r"_+", "_", re.sub(r"[^a-z0-9]", "_", ascii_id.encode("ascii", "ignore").decode().lower())).strip("_")


def describe(field: dict) -> str:
    parts = [f"#{field['n']}", field["var"], field["type"]]
    if field["type"] in ("radio", "choice") and field["options"]:
        parts.append("options: " + ", ".join(repr(o) for o in field["options"]))
    if field.get("option_labels"):
        parts.append("printed next to options: " + json.dumps(field["option_labels"], ensure_ascii=False))
    parts.append("tooltip: " + (field["description"] or field.get("nearby_label") or field["name"]))
    return " | ".join(parts)


def render_page(doc: pymupdf.Document, page_number: int, numbers: dict[str, int]) -> bytes:
    page = doc[page_number - 1]
    widgets = list(page.widgets())
    names = [w.field_name for w in widgets]
    for widget in widgets:
        n = numbers.get(generate_id(page_number, widget.field_name))
        if n is None:
            continue
        tag = f"#{n}"
        if names.count(widget.field_name) > 1:
            tag += f"={widget.on_state()}"
        page.draw_rect(widget.rect, color=(1, 0, 0), width=0.6)
        page.insert_text(widget.rect.tl + (1, 6), tag, fontsize=6, color=(0.85, 0, 0))
    # the widgets' own appearance would paint over the drawn numbers
    return page.get_pixmap(dpi=RENDER_DPI, annots=False).tobytes("png")


def cel_env(var_types: dict[str, str]):
    return cel.NewEnv(
        variables={var: cel.Type.BOOL if t == "bool" else cel.Type.STRING for var, t in var_types.items()}
    )


def cel_error(env, expression: str) -> Optional[str]:
    try:
        compiled = env.compile(expression)
    except RuntimeError as exc:
        return str(exc).splitlines()[0]
    if compiled.return_type() != cel.Type.BOOL:
        return f"returns {compiled.return_type().name()}, not bool"
    return None


CHOICE_TYPES = ("single_choice", "multiple_choice", "yes_no")


def check_page(
    extraction: PageExtraction,
    page: int,
    fields_by_var: dict[str, dict],
    env,
    attachments: dict[str, str],
    context: str,
) -> list[str]:
    errors = []
    seen: dict[str, str] = {}

    def claim(var: str, where: str) -> Optional[dict]:
        field = fields_by_var.get(var)
        if field is None:
            errors.append(f"{where}: '{var}' is not a field of this form")
        elif field["page"] != page:
            errors.append(f"{where}: '{var}' is on page {field['page']}, not on this page")
        elif var in seen:
            errors.append(f"'{var}' appears in both {seen[var]} and {where}")
        else:
            seen[var] = where
            return field
        return None

    for group in extraction.groups:
        for group_field in group.fields:
            field = claim(group_field.var, f"group '{group.id}'")
            if field is None:
                continue
            unknown = {o.value for o in group_field.options} - set(field["options"])
            if unknown:
                errors.append(f"group '{group.id}': {sorted(unknown)} are not export values of '{group_field.var}'")
            if group.answer_type in CHOICE_TYPES and field["type"] not in ("checkbox", "radio", "choice"):
                errors.append(
                    f"group '{group.id}' is a {group.answer_type} but '{group_field.var}' is a text field: "
                    "give it its own group"
                )
        if invented := paragraphs(group.reason or "") - paragraphs(context):
            errors.append(f"group '{group.id}': the reason cites {sorted(invented)}, which the explanations don't")
        if group.required and group.answer_type not in CHOICE_TYPES and all(f.optional for f in group.fields):
            errors.append(
                f"group '{group.id}' is required but all its fields are optional: mark the fields the form "
                "requires, or make it a choice group if one of them answers it"
            )
        for document in group.documents:
            if document.form_id is not None and document.form_id not in attachments:
                errors.append(f"group '{group.id}': '{document.form_id}' is not one of {sorted(attachments)}")
        for label, expression in [("ask_if", group.ask_if)] + [
            (f"document '{d.name}'", d.condition) for d in group.documents
        ]:
            if error := cel_error(env, expression):
                errors.append(f"group '{group.id}' {label} `{expression}`: {error}")
    for entry in extraction.out_of_scope:
        claim(entry.var, "out_of_scope")

    missing = [
        var for var, f in fields_by_var.items() if f["page"] == page and not f.get("out_of_scope") and var not in seen
    ]
    if missing:
        errors.append(f"these fields are neither in a group nor in out_of_scope: {missing}")
    return errors


async def extract_page(
    page: int,
    image: bytes,
    page_text: str,
    fields: list[dict],
    fields_by_var: dict[str, dict],
    var_types: dict[str, str],
    model: str,
    project: Optional[str],
    attachments: dict[str, str],
    context: str,
) -> PageExtraction:
    own = [f for f in fields if f["page"] == page and not f.get("out_of_scope")]
    others = [f for f in fields if f["page"] != page and not f.get("out_of_scope")]
    prompt = PROMPT.format(
        page_fields="\n".join(describe(f) for f in own),
        page_text=page_text,
        catalog="\n".join(f"{f['var']} ({var_types[f['var']]}) - {f['description'] or f['name']}" for f in others),
        attachments="\n".join(f"- {form_id}: {title}" for form_id, title in attachments.items()) or "(none)",
        context=context or "(none)",
    )
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {
                    "type": "image_url",
                    "image_url": {"url": "data:image/png;base64," + base64.b64encode(image).decode()},
                },
            ],
        }
    ]
    for round_number in range(MAX_FIX_ROUNDS + 1):
        response = await acompletion(
            model=model,
            messages=messages,
            response_format=PageExtraction,
            vertex_project=project,
            vertex_location="global",
            num_retries=2,
        )
        raw = response.choices[0].message.content
        try:
            extraction = PageExtraction.model_validate_json(raw)
        except ValidationError as exc:
            errors = [f"the answer does not match the schema: {exc}"]
        else:
            # conditions may only read fields that are answered, so this page's own out-of-scope vars drop out
            in_scope = {v: t for v, t in var_types.items() if v not in {o.var for o in extraction.out_of_scope}}
            errors = check_page(extraction, page, fields_by_var, cel_env(in_scope), attachments, context)
            if not errors:
                if extraction.alert:
                    print(f"page {page}: model alert: {extraction.alert}", file=sys.stderr)
                return extraction
        print(f"page {page}: round {round_number + 1} has {len(errors)} problems", file=sys.stderr)
        messages += [
            {"role": "assistant", "content": raw},
            {"role": "user", "content": "Fix these problems and answer again in full:\n- " + "\n- ".join(errors)},
        ]
    raise RuntimeError(f"page {page} still fails after {MAX_FIX_ROUNDS} fixes:\n- " + "\n- ".join(errors))


def paragraphs(text: str) -> set[str]:
    """The paragraph numbers cited, e.g. {"90", "91"} for "§§ 90/91"."""
    return {n for cited in re.findall(r"§§?\s*[\d/, a-z]+", text) for n in re.findall(r"\d+[a-z]?", cited)}


def document_text(paths: list[Path]) -> str:
    return "\n\n".join("".join(page.get_text() for page in pymupdf.open(path)) for path in paths)


def attachment_titles(paths: list[Path]) -> dict[str, str]:
    titles = {}
    for path in paths:
        lines = [line.strip() for line in pymupdf.open(path)[0].get_text().splitlines() if line.strip()]
        titles[path.stem] = " ".join(lines[:4])
    return titles


async def build_rules(pdf_path: Path, model: str, attachments: dict[str, str], context: str) -> dict:
    original = pdf_path.read_bytes()
    doc = pymupdf.open(stream=original, filetype="pdf")
    # pdfrw can't read encrypted PDFs; some forms ship encrypted with an empty user password
    pdf_bytes = doc.tobytes(encryption=pymupdf.PDF_ENCRYPT_NONE) if doc.metadata.get("encryption") else original
    fields = get_pdf_fields(pdf_bytes)
    if not fields:
        raise RuntimeError(f"{pdf_path} has no AcroForm fields")

    var_counts: dict[str, int] = {}
    for n, field in enumerate(fields, start=1):
        base = cel_var(field["id"])
        var_counts[base] = var_counts.get(base, 0) + 1
        field["var"] = base if var_counts[base] == 1 else f"{base}_{var_counts[base]}"
        field["n"] = n
        if field["page"] is None:
            field["out_of_scope"] = "no_widget"
        elif field["type"] == "signature":
            field["out_of_scope"] = "signature"
        elif field["read_only"] and field["default_value"]:
            field["out_of_scope"] = "static_text"
    fields_by_var = {f["var"]: f for f in fields}
    var_types = {f["var"]: "bool" if f["type"] == "checkbox" else "string" for f in fields if not f.get("out_of_scope")}

    project = os.getenv("GCLOUD_PROJECT") or (google.auth.default()[1] if model.startswith("vertex_ai/") else None)
    numbers = {f["id"]: f["n"] for f in fields}
    pages = sorted({f["page"] for f in fields if f["page"] is not None and not f.get("out_of_scope")})
    extractions = await asyncio.gather(
        *(
            extract_page(
                page,
                render_page(doc, page, numbers),
                doc[page - 1].get_text(),
                fields,
                fields_by_var,
                var_types,
                model,
                project,
                attachments,
                context,
            )
            for page in pages
        )
    )

    groups = []
    out_of_scope = [{"field_id": f["id"], "reason": f["out_of_scope"]} for f in fields if f.get("out_of_scope")]
    for page, extraction in zip(pages, extractions):
        for group in extraction.groups:
            group_id = cel_var(group.id)
            groups.append(
                {
                    "id": group_id if group_id.startswith(f"p{page}_") else f"p{page}_{group_id}",
                    "page": page,
                    "section": group.section,
                    "person": group.person,
                    "topic": group.topic,
                    "hint": group.hint,
                    "answer_type": group.answer_type,
                    "ask_if": group.ask_if,
                    "required": group.required,
                    "fields": [
                        {
                            "field_id": fields_by_var[gf.var]["id"],
                            "var": gf.var,
                            "type": var_types[gf.var],
                            "meaning": gf.meaning,
                            "options": {o.value: o.label for o in gf.options},
                            "optional": gf.optional,
                        }
                        for gf in group.fields
                    ],
                    "reason": group.reason,
                    "documents": [d.model_dump() for d in group.documents],
                }
            )
        out_of_scope += [{"field_id": fields_by_var[o.var]["id"], "reason": o.reason} for o in extraction.out_of_scope]

    errors = []
    group_ids = [g["id"] for g in groups]
    if duplicates := sorted({i for i in group_ids if group_ids.count(i) > 1}):
        errors.append(f"duplicate group ids: {duplicates}")
    # a condition may read a field that another page put out of scope
    answered_types = {f["var"]: f["type"] for g in groups for f in g["fields"]}
    env = cel_env(answered_types)
    for group in groups:
        for expression in [group["ask_if"]] + [d["condition"] for d in group["documents"]]:
            if error := cel_error(env, expression):
                errors.append(f"group '{group['id']}' `{expression}`: {error}")
    covered = {f["field_id"] for g in groups for f in g["fields"]} | {o["field_id"] for o in out_of_scope}
    if missing := [f["id"] for f in fields if f["id"] not in covered]:
        errors.append(f"fields without a rule: {missing}")
    if errors:
        raise RuntimeError("the merged rules are inconsistent:\n- " + "\n- ".join(errors))

    return {
        "form_id": pdf_path.stem,
        "source": {
            "pdf": str(pdf_path.resolve().relative_to(REPO_ROOT)),
            "sha256": hashlib.sha256(original).hexdigest(),
            "model": model,
            "generated_at": datetime.datetime.now(datetime.UTC).isoformat(timespec="seconds"),
        },
        "groups": groups,
        "out_of_scope": out_of_scope,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--model", default="vertex_ai/gemini-3.8-flash", help="litellm model name")
    parser.add_argument("--out", type=Path, help="defaults to schemas/rules/<pdf name>.rules.json")
    parser.add_argument(
        "--attachments",
        type=Path,
        nargs="*",
        default=[],
        help="PDFs of the attachment forms (Anlagen) this form routes to; their questions become required "
        "when the routing condition holds",
    )
    parser.add_argument(
        "--context",
        type=Path,
        nargs="*",
        default=[],
        help="PDFs explaining the form, e.g. its Merkblatt; groups take their reason from them",
    )
    args = parser.parse_args()

    try:
        rules = asyncio.run(
            build_rules(args.pdf, args.model, attachment_titles(args.attachments), document_text(args.context))
        )
    except RuntimeError as exc:
        sys.exit(str(exc))
    out = args.out or RULES_DIR / f"{args.pdf.stem}.rules.json"
    out.write_text(json.dumps(rules, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    fields = sum(len(g["fields"]) for g in rules["groups"])
    print(f"{out}: {len(rules['groups'])} groups over {fields} fields, {len(rules['out_of_scope'])} out of scope")


if __name__ == "__main__":
    main()
