import pdfrw
from typing import List, Dict, Any, Optional, Set, NamedTuple
from src.pdfs.utils import get_full_name, get_field_type, generate_id


class DiscoveredField(NamedTuple):
    """Internal representation of a discovered field, coupling metadata with PDF objects."""

    metadata: Dict[str, Any]
    widgets: List[pdfrw.PdfDict]
    root: pdfrw.PdfDict  # The logical root field dictionary (holds /V)
    on_values: Dict[int, str]  # id(widget) -> internal PDF export value


def _get_root(field: pdfrw.PdfDict) -> pdfrw.PdfDict:
    """Finds the root logical field dictionary by tracing up the parent chain."""
    curr = field
    while curr.get("/Parent"):
        curr = curr["/Parent"]
    return curr


def _process_field(
    field: pdfrw.PdfDict,
    field_map: Dict[str, Dict[str, Any]],
    widget_map: Dict[str, List[pdfrw.PdfDict]],
    root_map: Dict[str, pdfrw.PdfDict],
    on_values: Dict[int, str],
    processed_widgets: Set[int],
    page_num: Optional[int] = None,
) -> None:
    """Helper to process a single PDF field or widget and update the maps."""
    full_name = get_full_name(field)
    if not full_name:
        return

    # 1. Logical Metadata Extraction
    if full_name not in field_map:
        ft = get_field_type(field)
        root = _get_root(field)
        root_map[full_name] = root

        # Extract Field Flags (/Ff)
        # Bit 1: ReadOnly (value 1)
        # Bit 13: Multiline (value 4096)
        # Bit 16: Radio (value 32768)
        ff = field.get("/Ff") or (field.get("/Parent") and field["/Parent"].get("/Ff"))
        ff_val = int(ff) if ff else 0
        is_read_only = bool(ff_val & 1)
        is_multiline = bool(ff_val & 4096)
        is_radio = bool(ff_val & 32768)

        field_type = "unknown"
        options = []
        if ft == "/Tx":
            field_type = "string"
        elif ft == "/Btn":
            field_type = "radio" if is_radio else "checkbox"
        elif ft == "/Ch":
            field_type = "choice"
            opt = field.get("/Opt") or (field.get("/Parent") and field["/Parent"].get("/Opt"))
            if opt:
                options = [(o[-1] if isinstance(o, pdfrw.PdfArray) else o).to_unicode() for o in opt]
        elif ft == "/Sig":
            field_type = "signature"

        # Extract Description (Tooltip) from /TU
        tooltip = field.get("/TU") or (field.get("/Parent") and field["/Parent"].get("/TU"))
        description = tooltip.to_unicode() if tooltip else None

        field_map[full_name] = {
            "id": generate_id(page_num, full_name),
            "name": full_name,
            "page": page_num,
            "type": field_type,
            "options": options,
            "read_only": is_read_only,
            "multiline": is_multiline,
            "description": description,
        }
        widget_map[full_name] = []

    # 2. Physical Widget Processing
    if field.get("/Subtype") == "/Widget":
        if page_num is None and id(field) not in processed_widgets:
            return  # Ignore 'phantom' widgets not on any page

        if id(field) not in processed_widgets:
            processed_widgets.add(id(field))
            widget_map[full_name].append(field)

        # RATIONALE: If multiple widgets share a name and aren't explicitly flagged
        # as radio buttons, we upgrade the type to 'radio' as they functionally
        # act as a selection group.
        if field_map[full_name]["type"] == "checkbox" and len(widget_map[full_name]) > 1:
            field_map[full_name]["type"] = "radio"

        # Capture internal PDF export value for buttons
        if get_field_type(field) == "/Btn":
            on_val = "Yes"
            if field.get("/AP") and field["/AP"].get("/N"):
                for key in field["/AP"]["/N"].keys():
                    if key != "/Off":
                        on_val = key[1:]
                        break
            on_values[id(field)] = on_val

            if field_map[full_name]["type"] == "radio":
                if on_val not in field_map[full_name]["options"]:
                    field_map[full_name]["options"].append(on_val)

        # Update metadata if this is the first time we found a valid page for this field
        if page_num and field_map[full_name]["page"] is None:
            field_map[full_name]["page"] = page_num
            field_map[full_name]["id"] = generate_id(page_num, full_name)


def _walk_tree(
    fields: List[pdfrw.PdfDict],
    field_map: Dict[str, Dict[str, Any]],
    widget_map: Dict[str, List[pdfrw.PdfDict]],
    root_map: Dict[str, pdfrw.PdfDict],
    on_values: Dict[int, str],
    processed_widgets: Set[int],
) -> None:
    """Recursively traverses the AcroForm field tree."""
    for f in fields:
        _process_field(f, field_map, widget_map, root_map, on_values, processed_widgets)
        if f.get("/Kids"):
            _walk_tree(
                f.get("/Kids"),
                field_map,
                widget_map,
                root_map,
                on_values,
                processed_widgets,
            )


def discover_fields(reader: pdfrw.PdfReader) -> Dict[str, DiscoveredField]:
    """
    Internal engine that performs an exhaustive scan of the PDF and returns
    a mapping from logical name to metadata, physical widgets, and the root logical field.
    """
    field_map = {}  # logical_name -> field_info
    widget_map = {}  # logical_name -> list of PdfDict (widgets ONLY)
    root_map = {}  # logical_name -> PdfDict (Root logical field)
    on_values = {}  # id(widget) -> export_value
    processed_widgets = set()

    # Scan pages for widgets
    for page_num, page in enumerate(reader.pages, start=1):
        annots = page.get("/Annots")
        if annots:
            for annot in annots:
                if annot.get("/Subtype") == "/Widget":
                    _process_field(
                        annot,
                        field_map,
                        widget_map,
                        root_map,
                        on_values,
                        processed_widgets,
                        page_num,
                    )

    # Scan AcroForm tree for any hidden/missed logical fields
    if reader.Root.AcroForm and reader.Root.AcroForm.Fields:
        _walk_tree(
            reader.Root.AcroForm.Fields,
            field_map,
            widget_map,
            root_map,
            on_values,
            processed_widgets,
        )

    # Final Cleanup: Checkboxes should not expose options in the API.
    for _, meta in field_map.items():
        if meta["type"] == "checkbox":
            meta["options"] = []

    return {
        name: DiscoveredField(
            metadata=meta,
            widgets=widget_map[name],
            root=root_map[name],
            on_values=on_values,
        )
        for name, meta in field_map.items()
    }


def get_pdf_fields(pdf_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Parses PDF bytes and returns a list of all fillable fields.
    """
    reader = pdfrw.PdfReader(fdata=pdf_bytes)
    discovered = discover_fields(reader)
    return [df.metadata for df in discovered.values()]
