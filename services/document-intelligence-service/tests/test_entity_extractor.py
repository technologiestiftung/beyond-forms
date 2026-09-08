import pytest
from typing import Optional
from unittest.mock import patch

from pydantic import Field
from beyondforms.document_schemas.document_registry import (
    BaseDocument,
    DocumentRegistry,
)
from entity_extractor.extractor import (
    init_entity_extractor,
    generate_structured_output_configuration,
)
from domain.classified_document import ClassifiedDocument


# --- Mock Document for Testing ---


class MockInvoice(BaseDocument):
    """A mock document for extraction testing."""

    description: str = "A mock invoice for testing."
    invoice_number: Optional[str] = Field(None, description="The unique invoice ID.")
    amount_due: Optional[float] = Field(None, description="Total monetary amount.")


class DummyClass(BaseDocument):
    description: str = "A dummy document for testing."
    dummy_variable: Optional[str] = Field(None, description="Dummy variable.")


# --- Tests ---


def test_schema_generation_removes_description():
    """
    Ensure the structured output configuration correctly pops the 'description'
    field to avoid confusing the LLM with metadata.
    """
    config = generate_structured_output_configuration(MockInvoice)

    schema = config["json_schema"]["schema"]
    properties = schema["properties"]

    # Assertions
    assert config["json_schema"]["strict"] is True
    assert "invoice_number" in properties
    assert "description" not in properties
    assert config["json_schema"]["name"] == "MockInvoice"


@pytest.mark.asyncio
@patch("entity_extractor.extractor.acompletion")
async def test_entity_extractor_success(mock_acompletion):
    """
    Verify that the extractor takes a ClassifiedDocument, calls the LLM,
    and returns schema-filtered extracted data.
    """
    # 1. Setup Registry and Extractor
    registry = DocumentRegistry()
    registry.register("mock_invoice", MockInvoice)

    extractor_func = init_entity_extractor(model_name="test-model", document_registry=registry)

    # 2. Setup Input and Mock LLM Response
    classified_doc = ClassifiedDocument(document_type="mock_invoice", system_label="A")

    class MockMessage:
        def __init__(self, content):
            self.content = content

    class MockChoice:
        def __init__(self, content):
            self.message = MockMessage(content)

    class MockResponse:
        def __init__(self, content):
            self.choices = [MockChoice(content)]

    mock_json_response = '{"extracted_data": {"invoice_number": "INV-001", "amount_due": 99.99}}'

    async def mock_async_call(*args, **kwargs):
        return MockResponse(mock_json_response)

    mock_acompletion.side_effect = mock_async_call

    # 3. Execution
    result = await extractor_func(document=classified_doc, base64_data="dummy_data", mime_type="application/pdf")

    assert result == {"invoice_number": "INV-001", "amount_due": 99.99}
    assert isinstance(result, dict)


@pytest.mark.asyncio
@patch("entity_extractor.extractor.acompletion")
async def test_extractor_handles_unknown_type_safely(mock_acompletion):
    """
    Ensure that if the document type is 'UNKNOWN', the extractor
    returns the original document without triggering a Registry ValueError
    or calling the LLM.
    """
    from app.document_classifier.system_prompts import UNKNOWN_TYPE

    # Use a real registry (empty) to ensure get_or_404 would fail if called
    registry = DocumentRegistry()
    extractor_func = init_entity_extractor("test-model", registry)

    classified_doc = ClassifiedDocument(document_type=UNKNOWN_TYPE, system_label="?")

    # This should now return gracefully instead of raising ValueError
    result = await extractor_func(classified_doc, "data", "image/png")

    assert result == classified_doc
    mock_acompletion.assert_not_called()


@pytest.mark.asyncio
@patch("entity_extractor.extractor.acompletion")
async def test_extractor_returns_none_on_llm_failure(mock_acompletion):
    """
    Ensure that if the LLM response structure is broken, the function
    gracefully returns None as per the new implementation.
    """
    registry = DocumentRegistry()
    extractor = init_entity_extractor("test-model", registry)

    registry.register("dummy_class", DummyClass)

    doc = ClassifiedDocument(document_type="dummy_class", system_label="A")

    async def mock_async_fail(*args, **kwargs):
        raise RuntimeError("Broken connection mock")

    mock_acompletion.side_effect = mock_async_fail

    result = await extractor(doc, "base64", "image/png")

    assert result is None


@pytest.mark.asyncio
@patch("entity_extractor.extractor.acompletion")
async def test_extract_data_from_document_strips_null_and_empty(mock_acompletion):
    """
    Verify that fields evaluating to null or empty strings are omitted from outcome.
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

    mock_json_response = '{"extracted_data": {"invoice_number": "INV-001", "amount_due": null, "customer_name": ""}}'

    async def mock_async_call(*args, **kwargs):
        return MockResponse(mock_json_response)

    mock_acompletion.side_effect = mock_async_call

    from entity_extractor.extractor import extract_data_from_document

    res = await extract_data_from_document(
        base64_data="dummy_base64",
        mime_type="image/jpeg",
        schema_dict={
            "type": "object",
            "properties": {"invoice_number": {"type": "string"}},
        },
        model_name="test-model",
    )

    data = res.get("extracted_data", {})
    assert "invoice_number" in data
    assert "amount_due" not in data
    assert "customer_name" not in data
