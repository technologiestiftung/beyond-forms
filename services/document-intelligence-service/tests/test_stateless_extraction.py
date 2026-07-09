import json
import os
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch

from app.main import app

client = TestClient(app)


def convert_generic_block_to_json_schema(program_json: dict, block_id: int) -> dict:
    """
    Converts a questionnaire block definition into a flat standard JSON schema.
    """
    questions_data = program_json.get("questions", [])
    q_dict = {q.get("config", {}).get("id"): q for q in questions_data if "config" in q}

    blocks = program_json.get("program", {}).get("blockDefinitions", [])
    target_block = next((b for b in blocks if b.get("id") == block_id), None)

    if not target_block:
        return {"type": "object", "properties": {}}

    properties = {}
    for q_ref in target_block.get("questionDefinitions", []):
        q_id = q_ref.get("id")
        q_info = q_dict.get(q_id)

        if not q_info:
            continue

        config = q_info.get("config", {})
        name = config.get("name", f"question_{q_id}")
        q_type = q_info.get("type", "string")

        json_type = "string"
        if q_type == "number":
            json_type = "number"

        translations = config.get("questionText", {}).get("translations", {})
        text_label = translations.get("en_US", config.get("name", str(q_id)))

        properties[name] = {"type": json_type, "description": text_label}

    return {"type": "object", "properties": properties}


@pytest.mark.asyncio
@patch("app.entity_extractor.extractor.acompletion")
async def test_stateless_extract_with_metadata_envelope(mock_acompletion):
    """
    Test that the POST /api/v1/stateless/extract route correctly parses schemas
    and outputs the dynamic self-correction metadata envelope.
    """
    json_path = os.path.join(os.path.dirname(__file__), "data", "generic_business_grant_schema.json")
    assert os.path.exists(json_path), f"Test data not found at {json_path}"

    with open(json_path, "r", encoding="utf-8-sig") as f:
        program_json = json.load(f)

    # Convert Block 2 (Universal Applicant Information) to standard schema
    schema = convert_generic_block_to_json_schema(program_json, block_id=2)

    # Setup mock response matching full envelope contract
    class MockMessage:
        def __init__(self, content):
            self.content = content

    class MockChoice:
        def __init__(self, content):
            self.message = MockMessage(content)

    class MockResponse:
        def __init__(self, content):
            self.choices = [MockChoice(content)]

    mock_json_payload = {
        "extracted_data": {
            "business_legal_name": "Acme Corp",
            "business_tax_id": "12-3456789",
        },
        "extraction_metadata": {
            "business_legal_name": {
                "status": "SUCCESS",
                "confidence": "HIGH",
                "reason": "Extracted clearly from header.",
            },
            "business_tax_id": {
                "status": "SUCCESS",
                "confidence": "HIGH",
                "reason": "Found in Tax ID block.",
            },
        },
    }

    async def mock_async_call(*args, **kwargs):
        return MockResponse(json.dumps(mock_json_payload))

    mock_acompletion.side_effect = mock_async_call

    # Perform API Call using standard TestClient
    payload_data = {"schema": json.dumps(schema), "wrap-metadata": "true"}

    # Dynamic mock binary file upload streams
    dummy_file = ("test_doc.jpg", b"dummybinarycontent", "image/jpeg")
    response = client.post("/api/v1/stateless/extract", files={"file": dummy_file}, data=payload_data)

    assert response.status_code == 200
    res_json = response.json()
    assert res_json["status"] == "success"

    data_envelope = res_json["data"]
    assert "extracted_data" in data_envelope
    assert "extraction_metadata" in data_envelope

    assert data_envelope["extracted_data"]["business_legal_name"] == "Acme Corp"
    assert data_envelope["extraction_metadata"]["business_legal_name"]["status"] == "SUCCESS"
    assert data_envelope["extraction_metadata"]["business_legal_name"]["confidence"] == "HIGH"
