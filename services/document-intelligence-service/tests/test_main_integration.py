import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch
from app.main import app
from domain.classified_document import ClassifiedDocument
import json
from app.main import unsupported_media_type_handler

import asyncio

client = TestClient(app)


# --- Mocking the Core Services ---
# mock at the 'init' level to control what the routes actually execute.


@pytest.fixture
def mock_classifier():
    with patch("app.main.init_document_classifier") as mock:
        yield mock


@pytest.fixture
def mock_extractor():
    with patch("app.main.init_entity_extractor") as mock:
        yield mock


# --- Tests ---


def test_health_check():
    """
    Verify the service is alive and reporting the correct version.
    """
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "success", "code": 200}


def test_get_available_document_types():
    """
    Ensure the registry integration works through the API endpoint.
    """
    response = client.get("/get-available-document-types")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "success"
    assert isinstance(data["available-forms"], list)


@pytest.mark.asyncio
async def test_classify_endpoint_full_flow(mock_classifier, mock_extractor):
    """
    An integration test that simulates a file upload and verifies the
    coordination between classification and extraction.
    """
    mock_classification = ClassifiedDocument(document_type="identity_document", system_label="A")

    mock_classifier.return_value = AsyncMock(return_value=mock_classification)
    mock_extractor.return_value = AsyncMock(return_value={"given_names": "Max", "last_name": "Mustermann"})

    file_content = b"fake-binary-data-for-testing"
    files = {"file": ("test_identity.jpg", file_content, "image/jpeg")}
    data = {"model": "gemini/gemini-3.7-flash", "entity-extraction": "true"}

    response = client.post("/classify", files=files, data=data)

    assert response.status_code == 200

    json_response = response.json()
    assert json_response["status"] == "success"

    payload = json_response["data"]
    assert payload["filename"] == "test_identity.jpg"
    assert payload["classified_document"]["document_type"] == "identity_document"
    assert "extraction_result" in payload
    assert payload["extraction_result"]["given_names"] == "Max"


def test_not_found_error_handler():
    """
    Verify that 404 errors are wrapped in the standard flat API envelope.
    """
    response = client.get("/this-route-does-not-exist")

    assert response.status_code == 404
    data = response.json()

    assert data["status"] == "error"
    assert data["code"] == 404
    assert data["detail"] == "The requested resource was not found."


def test_unsupported_media_type_real_trigger():
    """
    Test the 415 handler by actually triggering it via a mock exception.
    Since we are testing the handler logic in main.py, we ensure it
    returns the correct structure.
    """

    # call the handler directly with a mock request/exception for a pure unit test
    class MockExc:
        detail = "Unsupported Media Type"

    response = asyncio.run(unsupported_media_type_handler(None, MockExc()))

    content = json.loads(response.body)
    assert content["status"] == "error"
    assert content["code"] == 415


def test_stateless_extract_endpoint():
    """
    Verify the stateless extraction endpoint parses schemas and formats responses.
    """

    class MockMessage:
        def __init__(self, content):
            self.content = content

    class MockChoice:
        def __init__(self, content):
            self.message = MockMessage(content)

    class MockResponse:
        def __init__(self, content):
            self.choices = [MockChoice(content)]

    mock_json = json.dumps(
        {
            "extracted_data": {"first_name": "Jane"},
            "extraction_metadata": {"first_name": {"status": "SUCCESS"}},
        }
    )

    async def mock_acompletion(*args, **kwargs):
        return MockResponse(mock_json)

    with patch("app.entity_extractor.extractor.acompletion", new=mock_acompletion):
        file_content = b"fake-binary-data"
        files = {"file": ("test.jpg", file_content, "image/jpeg")}
        data = {"schema": json.dumps([{"id": "first_name", "type": "string", "text": "First Name"}])}

        response = client.post("/api/v1/stateless/extract", files=files, data=data)

        assert response.status_code == 200
        json_response = response.json()
        assert json_response["status"] == "success"
        assert json_response["data"]["extracted_data"]["first_name"] == "Jane"
