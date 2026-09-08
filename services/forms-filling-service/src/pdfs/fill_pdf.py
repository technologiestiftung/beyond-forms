import io
import logging
import re
import pdfrw
import pymupdf
from typing import Any, Dict, Tuple
from src.pdfs.pdf_fields import discover_fields

logger = logging.getLogger(__name__)


def _pdf_literal_to_unicode(text: str) -> str:
    return re.sub(r"\\([0-7]{1,3})", lambda match: chr(int(match.group(1), 8)), text)


def _resolve_choice_value(value: str, options: list[str]) -> str:
    if value in options or value in ("", "Off"):
        return value
    for option in options:
        if _pdf_literal_to_unicode(option) == value:
            return option
    raise ValueError(f"Invalid value '{value}' for choice field. Valid options are: {options}")


def _opt_entry_str(opt_entry: Any) -> str:
    display = opt_entry[-1] if isinstance(opt_entry, pdfrw.PdfArray) else opt_entry
    return display.to_unicode()


def _get_opt_array(root: pdfrw.PdfDict, widgets: list[pdfrw.PdfDict]) -> list[Any]:
    opt = root.get("/Opt")
    if opt is None and widgets:
        opt = widgets[0].get("/Opt")
    return list(opt) if opt else []


def _match_choice_pdf_value(value: str, options: list[str], opt_array: list[Any]) -> Tuple[Any, int | None]:
    resolved = _resolve_choice_value(value, options)
    for index, entry in enumerate(opt_array):
        entry_str = _opt_entry_str(entry)
        if entry_str == resolved or _pdf_literal_to_unicode(entry_str) == _pdf_literal_to_unicode(resolved):
            pdf_val = entry[0] if isinstance(entry, pdfrw.PdfArray) else entry
            return pdf_val, index
    return pdfrw.PdfString.encode(resolved), None


def _render_text_appearances(
    pdf_bytes: bytes,
    targets: Dict[str, str],
    choice_opt_indices: Dict[str, int],
    choice_pdf_values: Dict[str, str],
) -> bytes:
    """Regenerates /AP appearance streams for string/choice widgets via pymupdf, then
    clears /NeedAppearances so viewers display these baked-in streams as-is instead of
    regenerating their own. Firefox's pdf.js mostly ignores /NeedAppearances and just
    renders whatever /AP already contains; Chrome's PDFium and Safari's PDF viewer instead honor
    the flag and regenerate their own appearance for every widget. Widgets not named in `targets` (checkboxes, radios, and any field
    not being filled) are left untouched.
    """
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    try:
        for page in doc:
            for widget in page.widgets() or []:
                name = widget.field_name
                if name not in targets:
                    continue
                widget.field_value = targets[name]
                widget.update()
                opt_index = choice_opt_indices.get(name)
                if opt_index is not None:
                    # Widget.update() drops /I for choice fields; restore it since
                    # some downstream consumers of the raw PDF read it directly.
                    doc.xref_set_key(widget.xref, "I", str(opt_index))
                choice_pdf_value = choice_pdf_values.get(name)
                if choice_pdf_value is not None:
                    doc.xref_set_key(widget.xref, "V", choice_pdf_value)
                    doc.xref_set_key(widget.xref, "DV", choice_pdf_value)

        catalog_xref = doc.pdf_catalog()
        kind, value = doc.xref_get_key(catalog_xref, "AcroForm")
        if kind == "xref":
            acroform_xref = int(value.split()[0])
            doc.xref_set_key(acroform_xref, "NeedAppearances", "false")

        return doc.tobytes()
    finally:
        doc.close()


def _reconcile_acroform_fields(pdf_bytes: bytes) -> bytes:
    reader = pdfrw.PdfReader(fdata=pdf_bytes)
    discovered = discover_fields(reader)
    reader.Root.AcroForm.Fields = pdfrw.PdfArray(info.root for info in discovered.values())

    output_stream = io.BytesIO()
    pdfrw.PdfWriter().write(output_stream, reader)
    return output_stream.getvalue()


def fill_pdf_form(pdf_bytes: bytes, field_values: Dict[str, Any], ignore_read_only: bool = False) -> bytes:
    """
    Fills a PDF form using shared field discovery logic and strict type validation.
    """
    reader = pdfrw.PdfReader(fdata=pdf_bytes)
    discovered_fields = discover_fields(reader)

    # Create an ID-to-Name map for flexible lookup
    id_to_name = {df.metadata["id"]: name for name, df in discovered_fields.items()}

    # Validation and Value Resolution
    resolved_values = {}
    for key, value in field_values.items():
        # 1. Try matching by logical name (AcroForm name)
        if key in discovered_fields:
            field_name = key
        # 2. Try matching by normalized ID (e.g. p1_field_name)
        elif key in id_to_name:
            field_name = id_to_name[key]
        else:
            raise ValueError(f"Field '{key}' does not exist in the PDF.")

        field_info = discovered_fields[field_name]
        meta = field_info.metadata

        # Type conversion: Convert string "true"/"false" to boolean for checkboxes
        if meta["type"] == "checkbox" and isinstance(value, str):
            lower_val = value.lower()
            if lower_val == "true":
                value = True
            elif lower_val == "false":
                value = False

        if meta["read_only"] and not ignore_read_only:
            raise ValueError(f"Cannot fill read-only field: {key}")

        if meta["type"] == "checkbox" and not isinstance(value, bool):
            raise ValueError(f"Field '{key}' is a checkbox and requires a boolean value (True/False).")

        if meta["type"] in ("radio", "choice", "string") and not isinstance(value, str):
            raise ValueError(f"Field '{key}' is of type '{meta['type']}' and requires a string value.")

        if meta["type"] in ("radio", "choice"):
            value = _resolve_choice_value(value, meta["options"])

        resolved_values[field_name] = value

    if not reader.Root.AcroForm:
        raise ValueError("PDF is not fillable (no AcroForm found).")

    if not resolved_values:
        raise ValueError("No field values specified.")

    # Ensure compatibility with standard PDF viewers by removing XFA (XML Forms)
    # and forcing the viewer to generate appearances for the new field values.
    if reader.Root.AcroForm.get(pdfrw.PdfName("XFA")):
        del reader.Root.AcroForm[pdfrw.PdfName("XFA")]
    reader.Root.AcroForm.update(pdfrw.PdfDict(NeedAppearances=pdfrw.PdfObject("true")))

    choice_opt_indices: Dict[str, int] = {}
    choice_pdf_values: Dict[str, str] = {}

    for field_name, value in resolved_values.items():
        field_info = discovered_fields[field_name]
        meta = field_info.metadata
        root = field_info.root

        if meta["type"] == "checkbox":
            # Determine the 'on' value for this checkbox (defaults to 'Yes').
            on_val = "Yes"
            if field_info.widgets:
                on_val = field_info.on_values.get(id(field_info.widgets[0]), "Yes")

            pdf_val = pdfrw.PdfName(on_val) if value else pdfrw.PdfName("Off")
            root.update(pdfrw.PdfDict(V=pdf_val))

            for widget in field_info.widgets:
                # Update visual state. We PRESERVE /AP for buttons because it
                # contains the drawing instructions for the checkmark.
                widget.update(pdfrw.PdfDict(AS=pdf_val, V=pdf_val))

        elif meta["type"] == "radio":
            # For radio groups, the root field gets the name of the selected option.
            pdf_selection = pdfrw.PdfName("Off")
            for widget in field_info.widgets:
                widget_on_val = field_info.on_values.get(id(widget), "Yes")
                is_selected = value == widget_on_val

                state_val = pdfrw.PdfName(widget_on_val) if is_selected else pdfrw.PdfName("Off")
                widget.update(pdfrw.PdfDict(AS=state_val, V=state_val))

                if is_selected:
                    pdf_selection = state_val

            root.update(pdfrw.PdfDict(V=pdf_selection))

        elif meta["type"] == "choice":
            opt_array = _get_opt_array(root, field_info.widgets)
            pdf_val, opt_index = _match_choice_pdf_value(value, meta["options"], opt_array)
            if opt_index is not None:
                choice_opt_indices[field_name] = opt_index
            choice_pdf_values[field_name] = str(pdf_val)
            update_dict: Dict[Any, Any] = {
                pdfrw.PdfName("V"): pdf_val,
                pdfrw.PdfName("DV"): pdf_val,
            }
            if opt_index is not None:
                update_dict[pdfrw.PdfName("I")] = pdfrw.PdfObject(opt_index)
            root.update(pdfrw.PdfDict(update_dict))
            for widget in field_info.widgets:
                widget.update(pdfrw.PdfDict(V=pdf_val))

        else:
            pdf_val = pdfrw.PdfString.encode(str(value))
            root.update(pdfrw.PdfDict(V=pdf_val))

            # Update widgets and CLEAR appearances to force viewer-side rendering.
            for widget in field_info.widgets:
                widget.update(pdfrw.PdfDict(V=pdf_val))
                if widget.get("/AP"):
                    del widget["/AP"]

    output_stream = io.BytesIO()
    writer = pdfrw.PdfWriter()
    writer.write(output_stream, reader)
    pdf_out = output_stream.getvalue()

    # Text and choice fields don't ship pre-baked /AP sub-appearances the way
    # checkboxes/radios do, so /V alone leaves them blank in viewers that don't
    # honor /NeedAppearances.
    # Regenerate real appearance streams for just those widgets with pymupdf.
    appearance_targets = {
        name: value
        for name, value in resolved_values.items()
        if discovered_fields[name].metadata["type"] in ("string", "choice")
    }
    if appearance_targets:
        try:
            pdf_out = _render_text_appearances(
                pdf_out, appearance_targets, choice_opt_indices, choice_pdf_values
            )
            pdf_out = _reconcile_acroform_fields(pdf_out)
        except Exception:
            logger.warning(
                "Falling back to /NeedAppearances-only rendering: pymupdf appearance "
                "generation failed for one or more fields.",
                exc_info=True,
            )

    return pdf_out
