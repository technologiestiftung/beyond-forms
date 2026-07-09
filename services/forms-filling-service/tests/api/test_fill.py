import base64
import os
import pdfrw
from fastapi.testclient import TestClient
from src.main import app
from src.pdfs.utils import get_full_name

client = TestClient(app)

# Path to the sample PDF in api/test_data
TEST_DATA_DIR = os.path.join(os.path.dirname(__file__), "test_data")
SAMPLE_PDF_PATH = os.path.join(TEST_DATA_DIR, "fillable_test_input.pdf")


def get_pdf_b64():
    with open(SAMPLE_PDF_PATH, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def _find_values(pdf):
    """Helper to find logical field values in the AcroForm tree."""
    results = {}

    def walk(fields):
        for f in fields:
            name = get_full_name(f)
            if name:
                val = f.get("/V")
                if val:
                    str_val = str(val)
                    if str_val.startswith("("):
                        str_val = str_val[1:-1]
                    if str_val.startswith("/"):
                        str_val = str_val[1:]
                    results[name] = str_val
            if f.get("/Kids"):
                walk(f.get("/Kids"))

    if pdf.Root.AcroForm and pdf.Root.AcroForm.Fields:
        walk(pdf.Root.AcroForm.Fields)
    return results


def test_fill_endpoint_e2e():
    pdf_b64 = get_pdf_b64()
    field_values = {
        "visible_text_1": "End-to-End Test",
        "visible_checkbox_1": True,
        "visible_radio_1": "Radio Mode B",
        "hidden_text_1": "I am hidden but filled",
    }

    payload = {
        "pdf_base64": pdf_b64,
        "field_values": field_values,
        "ignore_read_only": False,
    }

    response = client.post("/api/fill", json=payload)

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"

    # Verify the values in the returned PDF
    reader = pdfrw.PdfReader(fdata=response.content)
    found_values = _find_values(reader)

    assert found_values["visible_text_1"] == "End-to-End Test"
    assert found_values["hidden_text_1"] == "I am hidden but filled"
    # Checkbox 'True' maps to 'Yes'
    assert found_values["visible_checkbox_1"] == "Yes"
    # Radio group maps to the specific option name
    assert found_values["visible_radio_1"] == "Radio Mode B"


def test_fill_endpoint_validation_error():
    pdf_b64 = get_pdf_b64()

    # Attempt to fill a read-only field without override
    payload = {
        "pdf_base64": pdf_b64,
        "field_values": {"status_hidden_text_1": "Forbidden"},
        "ignore_read_only": False,
    }

    response = client.post("/api/fill", json=payload)
    assert response.status_code == 400
    assert "Cannot fill read-only field" in response.json()["detail"]


def test_fill_endpoint_checkbox_type_error():
    pdf_b64 = get_pdf_b64()

    # Attempt to fill a checkbox with a string instead of a boolean
    payload = {
        "pdf_base64": pdf_b64,
        "field_values": {"visible_checkbox_1": "Yes"},
        "ignore_read_only": False,
    }

    response = client.post("/api/fill", json=payload)
    assert response.status_code == 400
    assert "requires a boolean value" in response.json()["detail"]


def test_fill_endpoint_radio_invalid_option():
    pdf_b64 = get_pdf_b64()

    # Attempt to fill a radio group with an invalid option string
    payload = {
        "pdf_base64": pdf_b64,
        "field_values": {"visible_radio_1": "Invalid Option"},
        "ignore_read_only": False,
    }

    response = client.post("/api/fill", json=payload)
    assert response.status_code == 400
    assert "Valid options are" in response.json()["detail"]


def test_fill_endpoint_too_large():
    from src.models.api_models import MAX_BASE64_BYTES

    # Create a string that exceeds the MAX_BASE64_BYTES
    large_payload = "a" * (MAX_BASE64_BYTES + 1)
    payload = {
        "pdf_base64": large_payload,
        "field_values": {"visible_text_1": "too large"},
    }
    response = client.post("/api/fill", json=payload)

    assert response.status_code == 422  # Pydantic validation error
    assert "PDF payload too large" in response.json()["detail"][0]["msg"]
