import base64
import os
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

# Path to the sample PDF in api/test_data
TEST_DATA_DIR = os.path.join(os.path.dirname(__file__), "test_data")
SAMPLE_PDF_PATH = os.path.join(TEST_DATA_DIR, "fillable_test_input.pdf")


def get_pdf_b64():
    with open(SAMPLE_PDF_PATH, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def test_fields_endpoint():
    pdf_b64 = get_pdf_b64()
    response = client.post("/api/fields", json={"pdf_base64": pdf_b64})

    assert response.status_code == 200
    data = response.json()
    assert "fields" in data
    assert len(data["fields"]) == 16

    # Check for a few specific fields
    names = [f["name"] for f in data["fields"]]
    assert "visible_text_1" in names
    assert "hidden_checkbox_1" in names


def test_fields_endpoint_too_large():
    from src.models.api_models import MAX_BASE64_BYTES

    # Create a string that exceeds the MAX_BASE64_BYTES
    large_payload = "a" * (MAX_BASE64_BYTES + 1)
    response = client.post("/api/fields", json={"pdf_base64": large_payload})

    assert response.status_code == 422  # Pydantic validation error
    assert "PDF payload too large" in response.json()["detail"][0]["msg"]
