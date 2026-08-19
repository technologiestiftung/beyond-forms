import pdfrw
import pymupdf
from typing import Dict, List, Tuple


def extract_option_labels(
    pdf_bytes: bytes,
    widget_map: Dict[str, List[pdfrw.PdfDict]],
    widget_page_num: Dict[int, int],
    on_values: Dict[int, str],
) -> Dict[str, Dict[str, str]]:
    """Reads the label text printed next to each radio widget on the page, keyed by the
    widget's internal PDF export value (e.g. {"Auswahl1": "für die Bewohnerparkzone..."}).

    Some source PDFs give radio widgets meaningless internal export values (Auswahl1,
    Auswahl2, ...) with no /TU tooltip anywhere that says what each option means - the
    text is only present as visible page content next to the checkbox glyph. This reads
    that text directly: for each widget, everything in a rect immediately to the right
    of its own bounding box, spanning only that widget's own row height (so adjacent
    options on the rows above/below aren't picked up).

    Only meaningful for real option *groups* (>1 widget sharing a field name) - a lone
    checkbox's meaning already comes from its /TU tooltip or the field's own name.
    Best-effort: returns {} for a field on any extraction failure rather than raising,
    since a missing label is a no-op, not a fatal error for /api/fields as a whole.
    """
    try:
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    except Exception:
        return {}

    result: Dict[str, Dict[str, str]] = {}
    try:
        for full_name, widgets in widget_map.items():
            if len(widgets) <= 1:
                continue

            labels: Dict[str, str] = {}
            for widget in widgets:
                on_val = on_values.get(id(widget))
                rect = widget.get("/Rect")
                page_num = widget_page_num.get(id(widget))
                if not on_val or not rect or page_num is None or page_num - 1 >= len(doc):
                    continue

                text = _label_right_of_rect(doc[page_num - 1], rect)
                if text:
                    labels[on_val] = text

            if labels:
                result[full_name] = labels
    finally:
        doc.close()

    return result


def extract_nearby_labels(
    pdf_bytes: bytes,
    field_map: Dict[str, Dict[str, object]],
    widget_map: Dict[str, List[pdfrw.PdfDict]],
    widget_page_num: Dict[int, int],
) -> Dict[str, str]:
    """Best-effort description fallback for fields with no /TU tooltip at all: reads the
    label text printed immediately to the LEFT of the field's first widget (the common
    "Label: ___input___" row layout), falling back to the RIGHT (the common
    "[ ] Label text" layout for a standalone checkbox) if the left probe comes up empty.

    This is a heuristic, not authoritative PDF metadata like /TU - it can misfire on an
    unusual layout (multi-column pages, a label positioned above rather than beside the
    field). Exposed as a separate "nearby_label" key rather than silently overwriting
    `description`, so a human reviewing a generated mapping can tell a real tooltip from
    a guessed one.
    """
    try:
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    except Exception:
        return {}

    result: Dict[str, str] = {}
    try:
        for full_name, meta in field_map.items():
            if meta.get("description"):
                continue
            widgets = widget_map.get(full_name)
            if not widgets:
                continue

            widget = widgets[0]
            rect = widget.get("/Rect")
            page_num = widget_page_num.get(id(widget))
            if not rect or page_num is None or page_num - 1 >= len(doc):
                continue

            page = doc[page_num - 1]
            text = _label_left_of_rect(page, rect) or _label_right_of_rect(page, rect)
            if text:
                result[full_name] = text
    finally:
        doc.close()

    return result


def _label_left_of_rect(page: "pymupdf.Page", rect: List[str]) -> str:
    try:
        x0, y0, x1, y1 = (float(v) for v in rect)
    except (TypeError, ValueError):
        return ""

    page_height = page.rect.height
    top = page_height - y1
    bottom = page_height - y0
    left = max(0.0, x0 - 250)

    search_rect = pymupdf.Rect(left, top, x0, bottom)
    return _clean_text(page.get_textbox(search_rect))


def _label_right_of_rect(page: "pymupdf.Page", rect: List[str]) -> str:
    try:
        x0, y0, x1, y1 = (float(v) for v in rect)
    except (TypeError, ValueError):
        return ""

    page_height = page.rect.height
    page_width = page.rect.width
    top = page_height - y1
    bottom = page_height - y0
    right = min(x1 + 400, page_width - 5)

    search_rect = pymupdf.Rect(x1, top, right, bottom)
    return _clean_text(page.get_textbox(search_rect))


def _clean_text(text: str) -> str:
    # Strip the checkbox glyph itself: symbol-font checkbox marks PyMuPDF can't map to
    # a real codepoint decode as U+FFFD (the replacement character).
    text = text.replace("�", "")
    return " ".join(text.split())
