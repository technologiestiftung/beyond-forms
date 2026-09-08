import json
from unittest.mock import MagicMock, patch
import pytest

from src.models import DocumentStatusType
from src.worker import process_message


@pytest.fixture
def mock_db_session():
    with patch("src.worker.SessionLocal") as mock:
        session = MagicMock()
        mock.return_value = session
        yield session


@pytest.fixture
def mock_httpx():
    with patch("src.worker.httpx.Client") as mock:
        yield mock


def test_process_message_with_soft_validations(mock_db_session, mock_httpx):
    mock_db_session.execute.return_value.fetchone.return_value = ("processing", None)
    mock_db_session.execute.return_value.rowcount = 1

    message = MagicMock()
    message.data = json.dumps({"document_id": "test-doc-id", "gcs_uri": "gs://test-bucket/test-object.pdf"}).encode(
        "utf-8"
    )

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "status": "success",
        "data": {
            "classified_document": {"document_type": "Identity Document"},
            "extraction_result": {"first_name": "Max", "warnings": ["PAGINATION_MISSING_PAGES", "LEGIBILITY_ISSUES"]},
        },
    }

    mock_client_instance = MagicMock()
    mock_client_instance.post.return_value = mock_response
    mock_httpx.return_value.__enter__.return_value = mock_client_instance

    process_message(message)

    message.ack.assert_called_once()

    classify_call = mock_client_instance.post.call_args_list[0]
    assert "/classify" in classify_call[0][0]
    assert classify_call[1]["data"]["gcs_uri"] == "gs://test-bucket/test-object.pdf"

    update_calls = [
        call for call in mock_db_session.execute.call_args_list if "UPDATE user_documents" in str(call[0][0])
    ]
    assert len(update_calls) == 1

    update_args = update_calls[0][0][1]
    assert update_args["new_status"] == DocumentStatusType.READY_FOR_REVIEW.value
    assert update_args.get("user_error_code") == "PAGINATION_MISSING_PAGES"


def test_process_message_without_warnings(mock_db_session, mock_httpx):
    mock_db_session.execute.return_value.fetchone.return_value = ("processing", None)
    mock_db_session.execute.return_value.rowcount = 1

    message = MagicMock()
    message.data = json.dumps({"document_id": "test-doc-id", "gcs_uri": "gs://test-bucket/test-object.pdf"}).encode(
        "utf-8"
    )

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "status": "success",
        "data": {
            "classified_document": {"document_type": "Identity Document"},
            "extraction_result": {"first_name": "Max"},
        },
    }
    mock_client_instance = MagicMock()
    mock_client_instance.post.return_value = mock_response
    mock_httpx.return_value.__enter__.return_value = mock_client_instance

    process_message(message)

    update_calls = [
        call for call in mock_db_session.execute.call_args_list if "UPDATE user_documents" in str(call[0][0])
    ]
    assert len(update_calls) == 1

    update_args = update_calls[0][0][1]
    assert update_args["new_status"] == DocumentStatusType.READY_FOR_REVIEW.value
    assert update_args.get("user_error_code") is None


def test_process_message_with_user_selected_type_uses_stateless_extract(mock_db_session, mock_httpx):
    mock_db_session.execute.return_value.fetchone.return_value = ("processing", "stmt3")
    mock_db_session.execute.return_value.rowcount = 1

    message = MagicMock()
    message.data = json.dumps({"document_id": "test-doc-id", "gcs_uri": "gs://test-bucket/test-object"}).encode("utf-8")

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "status": "success",
        "data": {
            "extracted_data": {"iban": "DE89370400440532013000", "account_balance": "1234.56"},
        },
    }

    mock_client_instance = MagicMock()
    mock_client_instance.post.return_value = mock_response
    mock_httpx.return_value.__enter__.return_value = mock_client_instance

    process_message(message)

    message.ack.assert_called_once()

    dis_call = mock_client_instance.post.call_args_list[0]
    assert "/api/v1/stateless/extract" in dis_call[0][0]
    assert dis_call[1]["data"]["document_type"] == "bank_statements"
    assert dis_call[1]["data"]["gcs_uri"] == "gs://test-bucket/test-object"

    update_calls = [
        call for call in mock_db_session.execute.call_args_list if "UPDATE user_documents" in str(call[0][0])
    ]
    assert len(update_calls) == 1

    update_args = update_calls[0][0][1]
    assert update_args["new_status"] == DocumentStatusType.READY_FOR_REVIEW.value
    assert update_args["doc_type"] == "stmt3"
    assert json.loads(update_args["raw_data"]) == {"iban": "DE89370400440532013000", "account_balance": "1234.56"}
