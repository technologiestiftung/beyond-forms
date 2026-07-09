from typing import Any

from pydantic import BaseModel


class FormRequestBody(BaseModel):
    form_type: str
    form_content: dict


class FieldTypeRequest(BaseModel):
    field_type: str
    field_value: Any
