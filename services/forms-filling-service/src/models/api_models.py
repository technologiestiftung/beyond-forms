from pydantic import BaseModel, Field, field_validator
from typing import List, Dict, Any, Optional

# Limit Base64 input to 20MB to avoid OOM issues
MAX_BASE64_BYTES = 20 * 1024 * 1024


class FormField(BaseModel):
    """Represents metadata for a single logical PDF form field."""

    id: str = Field(..., description="Unique deterministic identifier (p{page}_{name})")
    name: str = Field(..., description="Full hierarchical logical name of the field")
    page: Optional[int] = Field(None, description="Physical page number of the first widget")
    type: str = Field(..., description="Field type (string, checkbox, radio, choice, etc.)")
    options: List[str] = Field(default_factory=list, description="Possible values for radio/choice fields")
    read_only: bool = Field(False, description="Whether the field is flagged as read-only in the PDF")
    multiline: bool = Field(False, description="Whether the field supports multiple lines of text")
    description: Optional[str] = Field(None, description="Human-readable description or tooltip for the field")
    option_labels: Optional[Dict[str, str]] = Field(
        None,
        description="Maps each radio option's internal export value to its on-page label text, "
        "for option groups whose export values (e.g. Auswahl1, Auswahl2) carry no inherent meaning",
    )
    nearby_label: Optional[str] = Field(
        None,
        description="Best-effort description fallback for fields with no /TU tooltip at all: text "
        "read from the page immediately beside the field (left, then right). Heuristic, not "
        "authoritative PDF metadata - only ever set when `description` is otherwise empty",
    )
    default_value: Optional[str] = Field(
        None,
        description="The PDF's own baked-in /V default value, for string-type fields only. An empty "
        "string means the field ships genuinely blank - useful for read-only fields, where 'read-only' "
        "alone doesn't tell you whether the field actually holds real static content or was never filled",
    )


class FieldsRequest(BaseModel):
    """Request schema for extracting fields from a PDF."""

    pdf_base64: str = Field(..., description="Base64 encoded PDF document")

    @field_validator("pdf_base64")
    @classmethod
    def validate_pdf_size(cls, v: str) -> str:
        if len(v) > MAX_BASE64_BYTES:
            raise ValueError(f"PDF payload too large. Max size is {MAX_BASE64_BYTES} bytes.")
        return v


class FieldsResponse(BaseModel):
    """Response containing a list of all fields found in a PDF."""

    fields: List[FormField]


class FillRequest(BaseModel):
    """Request schema for filling a PDF form."""

    pdf_base64: str = Field(..., description="Base64 encoded PDF document")
    field_values: Dict[str, Any] = Field(..., description="Map of field names to values")
    ignore_read_only: bool = Field(False, description="Bypass read-only protection if true")

    @field_validator("pdf_base64")
    @classmethod
    def validate_pdf_size(cls, v: str) -> str:
        if len(v) > MAX_BASE64_BYTES:
            raise ValueError(f"PDF payload too large. Max size is {MAX_BASE64_BYTES} bytes.")
        return v
