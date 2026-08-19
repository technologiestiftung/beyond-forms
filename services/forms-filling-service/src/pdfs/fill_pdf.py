import io
import re
import pdfrw
from typing import Any, Dict, Tuple
from src.pdfs.pdf_fields import discover_fields


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
    return output_stream.getvalue()
