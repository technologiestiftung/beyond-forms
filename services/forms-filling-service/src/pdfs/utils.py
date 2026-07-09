import pdfrw
from typing import Optional


def get_full_name(field: pdfrw.PdfDict) -> Optional[str]:
    """Reconstructs the full hierarchical name of a field."""
    names = []
    curr = field
    while curr:
        if curr.get("/T"):
            names.append(curr["/T"][1:-1])
        curr = curr.get("/Parent")
    if not names:
        return None
    return ".".join(reversed(names))


def get_field_type(field: pdfrw.PdfDict) -> Optional[str]:
    """Traces up the parent chain to find the field type (/FT)."""
    curr = field
    while curr:
        if curr.get("/FT"):
            return curr["/FT"]
        curr = curr.get("/Parent")
    return None


def generate_id(page_num: Optional[int], full_name: str) -> str:
    """Generates a consistent normalized identifier for a PDF field."""
    prefix = f"p{page_num}" if page_num is not None else "pX"
    raw_id = f"{prefix}_{full_name}"
    return raw_id.lower().replace(" ", "_")
