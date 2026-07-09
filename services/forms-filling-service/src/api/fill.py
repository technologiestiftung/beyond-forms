from fastapi import APIRouter, Response, HTTPException
import base64
import binascii

from src.models.api_models import FillRequest
from src.pdfs.fill_pdf import fill_pdf_form

router = APIRouter()


@router.post("/fill")
async def fill_form(request: FillRequest) -> Response:
    """
    Accepts a FillRequest with Base64 encoded PDF and field values,
    returns the filled PDF as binary.
    """
    try:
        pdf_bytes = base64.b64decode(request.pdf_base64, validate=True)
    except binascii.Error as e:
        raise HTTPException(detail=f"Invalid Base64 encoding for PDF: {str(e)}", status_code=400)

    try:
        filled_pdf = fill_pdf_form(pdf_bytes, request.field_values, ignore_read_only=request.ignore_read_only)
    except ValueError as e:
        raise HTTPException(detail=str(e), status_code=400)

    return Response(content=filled_pdf, media_type="application/pdf")
