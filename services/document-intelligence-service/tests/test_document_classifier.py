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
    assert result.confidence > 0.8


@pytest.mark.asyncio
@patch("app.document_classifier.classifier.aembedding")
async def test_classifier_api_failure(mock_aembedding):
    mock_aembedding.side_effect = Exception("API Error")

    classify_func = init_document_classifier(model_name="test-model", candidate_counts=1)
    result = await classify_func("base64_data", "image/png")

    assert result.document_type == FAILED_EXTRACTION.document_type
    assert result.confidence == 0.0


def test_log_probability_calculation():
    """
    Unit test for the math utility that converts logprobs to linear confidence.
    Keep this test as the utility function might still be used elsewhere or needed.
    """
    from app.utils.llm_calls import log_probability_to_confidence

    # e^-0.6931... is approx 0.5
    half_confidence = log_probability_to_confidence(-0.69314718056)
    assert round(half_confidence, 2) == 0.5

    # e^0 is 1.0
    full_confidence = log_probability_to_confidence(0.0)
    assert full_confidence == 1.0


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


def test_scale_confidence():
    from app.document_classifier.classifier import scale_confidence

    # Test range >= 0.6
    assert scale_confidence(0.6) == 0.95
    assert scale_confidence(0.7) == 0.99
    assert scale_confidence(1.0) == 0.99

    # Test range 0.3 <= score < 0.6
    assert scale_confidence(0.3) == 0.70
    assert pytest.approx(scale_confidence(0.41), 0.001) == 0.7916

    # Test range < 0.3
    assert scale_confidence(0.0) == 0.0
    assert pytest.approx(scale_confidence(0.15), 0.001) == 0.35
