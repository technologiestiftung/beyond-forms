import pytest
from unittest.mock import patch
from app.document_classifier.classifier import (
    init_document_classifier,
    FAILED_EXTRACTION,
)


@pytest.mark.asyncio
@patch("app.document_classifier.classifier.aembedding")
async def test_classifier_success(mock_aembedding):
    # Mock the global doc_type_embeddings
    from app.document_classifier.classifier import doc_type_embeddings

    doc_type_embeddings.clear()
    doc_type_embeddings["income_declaration"] = [1.0, 0.0, 0.0]
    doc_type_embeddings["identity_document"] = [0.0, 1.0, 0.0]

    # Mock the embedding for the file
    # Let's say the file is closer to income_declaration
    mock_aembedding.return_value = {"data": [{"embedding": [0.9, 0.1, 0.0]}]}

    classify_func = init_document_classifier(model_name="test-model", candidate_counts=1)
    result = await classify_func("base64_data", "image/png")

    assert result.document_type == "income_declaration"


@pytest.mark.asyncio
@patch("app.document_classifier.classifier.aembedding")
async def test_classifier_api_failure(mock_aembedding):
    mock_aembedding.side_effect = Exception("API Error")

    classify_func = init_document_classifier(model_name="test-model", candidate_counts=1)
    result = await classify_func("base64_data", "image/png")

    assert result.document_type == FAILED_EXTRACTION.document_type


@pytest.mark.asyncio
@patch("app.document_classifier.classifier.document_registry")
@patch("app.document_classifier.classifier.aembedding")
async def test_load_doc_type_embeddings(mock_aembedding, mock_registry):
    from app.document_classifier.classifier import (
        load_doc_type_embeddings,
        doc_type_embeddings,
        CACHE_FILE,
    )
    import os
    import json

    mock_registry.list_keys.return_value = ["test_doc"]

    class MockDoc:
        model_fields = {"description": type("obj", (object,), {"default": "test description"})}

    mock_registry.get_or_raise.return_value = MockDoc()

    doc_type_embeddings.clear()
    if CACHE_FILE.exists():
        os.remove(CACHE_FILE)

    mock_aembedding.return_value = {"data": [{"embedding": [0.1, 0.2, 0.3]}]}

    await load_doc_type_embeddings("test-model")

    assert "test_doc" in doc_type_embeddings
    assert doc_type_embeddings["test_doc"] == [0.1, 0.2, 0.3]
    assert CACHE_FILE.exists()

    with open(CACHE_FILE, "r") as f:
        cached_data = json.load(f)
    assert "test_doc" in cached_data
    assert cached_data["test_doc"] == [0.1, 0.2, 0.3]

    # Clean up
    if CACHE_FILE.exists():
        os.remove(CACHE_FILE)
