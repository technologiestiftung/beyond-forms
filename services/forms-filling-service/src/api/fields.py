from fastapi import APIRouter, HTTPException
import base64
import binascii

from src.models.api_models import FieldsRequest, FieldsResponse
from src.pdfs.pdf_fields import get_pdf_fields

router = APIRouter()


@router.post("/fields", response_model=FieldsResponse)
async def list_fields(request: FieldsRequest) -> FieldsResponse:
    """
    Accepts a Base64 encoded PDF and returns a list of its fillable fields.
    """
    try:
        pdf_bytes = base64.b64decode(request.pdf_base64, validate=True)
    except binascii.Error as e:
        raise HTTPException(detail=f"Invalid Base64 encoding: {str(e)}", status_code=400)

    fields = get_pdf_fields(pdf_bytes)
    return FieldsResponse(fields=fields)
