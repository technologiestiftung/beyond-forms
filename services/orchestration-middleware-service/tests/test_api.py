import io
import uuid
import json
import decimal
from datetime import date
from types import SimpleNamespace
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from beyondforms.auth import User as AuthUser, get_current_user, require_authenticated_user
from src.routes.llm import update_user_data, get_user_data, get_conversation_service
from src.services.user_service import get_user_service
from src.services.conversation_service import ConversationService
from src.models import Users as DbUser, GenderType
from src.db import get_db
from src.main import app

client = TestClient(app)


@pytest.fixture
def mock_db():
    mock = MagicMock(spec=Session)
    return mock


@pytest.fixture
def mock_conv_service():
    mock = MagicMock(spec=ConversationService)
    return mock


@pytest.fixture(autouse=True)
def override_dependencies(mock_db, mock_conv_service):
    def override_get_current_user():
        return AuthUser(
            user_id="test-auth-id",
            user_name="1234567890",
            session_id="test-session-id",
            is_authenticated=True,
        )

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[require_authenticated_user] = override_get_current_user
    app.dependency_overrides[get_conversation_service] = lambda: mock_conv_service
    yield
    app.dependency_overrides.clear()


# ── App-level routes ──────────────────────────────────────────────────


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy!"}


def test_verify_auth_authenticated():
    response = client.get("/verify_auth")
    assert response.status_code == 200
    data = response.json()
    assert data["is_authenticated"] is True
    assert data["user_id"] == "test-auth-id"
    assert data["session_id"] == "test-session-id"


def test_verify_auth_unauthenticated():
    app.dependency_overrides[get_current_user] = lambda: None

    response = client.get("/verify_auth")
    assert response.status_code == 200
    data = response.json()
    assert data["is_authenticated"] is False


# ── User routes ────────────────────────────────────────────────────────


def test_get_profile_unauthenticated():
    async def raise_401():
        from fastapi import HTTPException

        raise HTTPException(status_code=401, detail="Missing authentication token")

    app.dependency_overrides[require_authenticated_user] = raise_401

    response = client.get("/profile")
    assert response.status_code == 401


def test_login_not_implemented():
    response = client.post("/login")
    assert response.status_code == 200


def test_register_not_implemented():
    response = client.post("/register")
    assert response.status_code == 200


# ── Files routes ───────────────────────────────────────────────────────


def test_list_files_unauthenticated():
    async def raise_401():
        from fastapi import HTTPException

        raise HTTPException(status_code=401, detail="Missing authentication token")

    app.dependency_overrides[require_authenticated_user] = raise_401

    response = client.get("/files")
    assert response.status_code == 401


def test_upload_invalid_file_type(mock_db, mock_conv_service):
    file = io.BytesIO(b"some content")
    response = client.post("/upload", files={"file": ("test.txt", file, "text/plain")})

    assert response.status_code == 400
    assert "Invalid file type" in response.json()["detail"]


@patch("google.cloud.storage.Client")
def test_upload_file_too_large(mock_storage_client, mock_db, mock_conv_service):
    large_size = 50 * 1024 * 1024 + 1
    file = io.BytesIO(b"x" * large_size)

    response = client.post(
        "/upload",
        files={"file": ("test.png", file, "image/png")},
    )

    assert response.status_code == 400
    assert "File too large" in response.json()["detail"]


@patch("google.cloud.storage.Client")
def test_upload_gcs_failure(mock_storage_client, mock_db, mock_conv_service):
    import src.gcs

    src.gcs._gcs_client = None

    mock_storage_client.return_value.bucket.side_effect = Exception("GCS unavailable")

    file = io.BytesIO(b"test content")
    response = client.post(
        "/upload",
        files={"file": ("test.png", file, "image/png")},
    )

    assert response.status_code == 500
    assert "GCS" in response.json()["detail"]


@patch("src.routes.files.publish_document_event")
@patch("google.cloud.storage.Client")
def test_upload_db_error_rollback(mock_storage_client, _mock_publish_event, mock_db):
    import src.gcs

    src.gcs._gcs_client = None

    mock_bucket = MagicMock()
    mock_blob = MagicMock()
    mock_storage_client.return_value.bucket.return_value = mock_bucket
    mock_bucket.blob.return_value = mock_blob

    mock_db.commit.side_effect = Exception("DB commit failed")

    file = io.BytesIO(b"test content")
    response = client.post(
        "/upload",
        files={"file": ("test.png", file, "image/png")},
    )

    assert response.status_code == 500
    mock_db.rollback.assert_called()


def test_download_not_implemented():
    response = client.get("/download", params={"file_uri": "gs://bucket/file.pdf"})
    assert response.status_code == 200


def test_llm_health_check():
    response = client.get("/llm/health")
    assert response.status_code == 200
    assert response.json() == {"status": "LLM healthy"}


def _chat_request_body(user_text: str) -> dict:
    return {"content": user_text}


@patch("src.routes.llm.acompletion", new_callable=AsyncMock)
def test_chat_no_tool_call(mock_completion, mock_conv_service):
    mock_message = MagicMock()
    mock_message.content = "Hello! How can I help you?"
    mock_message.tool_calls = None

    mock_choice = MagicMock()
    mock_choice.message = mock_message

    mock_completion.return_value = MagicMock(choices=[mock_choice], usage=None)

    mock_conv = MagicMock()
    mock_conv.id = uuid.uuid4()
    mock_conv_service.get_or_create_in_progress_conversation.return_value = mock_conv
    mock_conv_service.get_conversation_context.return_value = []

    response = client.post("/chat", json=_chat_request_body("Hello"))

    assert response.status_code == 200
    data = response.json()
    assert data["response"] == "Hello! How can I help you?"
    assert data["tool_calls"] == []
    assert data["conversation_id"] == str(mock_conv.id)
    assert mock_completion.call_count == 1
    mock_conv_service.add_message.assert_called()


@patch("src.routes.llm.check_progress_status", new_callable=AsyncMock)
@patch("src.routes.llm.update_user_data", new_callable=AsyncMock)
@patch("src.routes.llm.acompletion", new_callable=AsyncMock)
def test_chat_with_tool_call(mock_completion, mock_update_user_data, mock_check_progress, mock_conv_service):
    mock_check_progress.return_value = {
        "progress_percentage": 50,
        "missing_fields": ["name", "email"],
    }

    tool_call_id = "call_123"

    first_message = MagicMock()
    first_message.content = None
    mock_function = MagicMock()
    mock_function.name = "check_progress_status"
    mock_function.arguments = "{}"
    mock_tool_call = MagicMock()
    mock_tool_call.id = tool_call_id
    mock_tool_call.function = mock_function
    mock_tool_call.model_dump.return_value = {
        "id": tool_call_id,
        "type": "function",
        "function": {"name": "check_progress_status", "arguments": "{}"},
    }
    first_message.tool_calls = [mock_tool_call]

    first_choice = MagicMock()
    first_choice.message = first_message

    second_message = MagicMock()
    second_message.content = "You are 50% done."
    second_message.tool_calls = None

    second_choice = MagicMock()
    second_choice.message = second_message

    mock_completion.side_effect = [
        MagicMock(choices=[first_choice], usage=None),
        MagicMock(choices=[second_choice], usage=None),
    ]

    mock_conv = MagicMock()
    mock_conv.id = uuid.uuid4()
    mock_conv_service.get_or_create_in_progress_conversation.return_value = mock_conv
    mock_conv_service.get_conversation_context.return_value = []

    response = client.post("/chat", json=_chat_request_body("What's my progress?"))

    assert response.status_code == 200
    data = response.json()
    assert data["response"] == "You are 50% done."
    assert len(data["tool_calls"]) == 1
    assert data["tool_calls"][0]["name"] == "check_progress_status"
    mock_check_progress.assert_awaited_once()
    assert mock_completion.call_count == 2
    mock_conv_service.add_message.assert_called()


@patch("src.routes.llm.acompletion", new_callable=AsyncMock)
def test_chat_with_update_user_data_tool_call(mock_completion, mock_conv_service, mock_db):
    tool_call_id = "call_456"

    first_message = MagicMock()
    first_message.content = None
    mock_function = MagicMock()
    mock_function.name = "update_user_data"
    mock_function.arguments = json.dumps({"updates": {"rent_total": 550.0}})
    mock_tool_call = MagicMock()
    mock_tool_call.id = tool_call_id
    mock_tool_call.function = mock_function
    mock_tool_call.model_dump.return_value = {
        "id": tool_call_id,
        "type": "function",
        "function": {"name": "update_user_data", "arguments": json.dumps({"updates": {"rent_total": 550.0}})},
    }
    first_message.tool_calls = [mock_tool_call]

    first_choice = MagicMock()
    first_choice.message = first_message

    second_message = MagicMock()
    second_message.content = "I've updated your rent information."
    second_message.tool_calls = None

    second_choice = MagicMock()
    second_choice.message = second_message

    mock_completion.side_effect = [
        MagicMock(choices=[first_choice], usage=None),
        MagicMock(choices=[second_choice], usage=None),
    ]

    mock_conv = MagicMock()
    mock_conv.id = uuid.uuid4()
    mock_conv_service.get_or_create_in_progress_conversation.return_value = mock_conv
    mock_conv_service.get_conversation_context.return_value = []

    mock_user_service = MagicMock()
    app.dependency_overrides[get_user_service] = lambda: mock_user_service

    with patch("src.routes.llm.update_user_data", new_callable=AsyncMock) as mock_update_user_data:
        mock_update_user_data.return_value = {"status": "success", "message": "User data updated successfully"}
        response = client.post("/chat", json=_chat_request_body("My rent is 550"))

        assert response.status_code == 200
        data = response.json()
        assert data["response"] == "I've updated your rent information."
        assert len(data["tool_calls"]) == 1
        assert data["tool_calls"][0]["name"] == "update_user_data"
        assert data["tool_calls"][0]["args"] == {"updates": {"rent_total": 550.0}}
        mock_update_user_data.assert_called_once()


@patch("src.routes.llm.acompletion", new_callable=AsyncMock)
def test_chat_with_get_user_data_tool_call(mock_completion, mock_conv_service, mock_db):
    tool_call_id = "call_get_data"

    first_message = MagicMock()
    first_message.content = None
    mock_function = MagicMock()
    mock_function.name = "get_user_data"
    mock_function.arguments = "{}"
    mock_tool_call = MagicMock()
    mock_tool_call.id = tool_call_id
    mock_tool_call.function = mock_function
    mock_tool_call.model_dump.return_value = {
        "id": tool_call_id,
        "type": "function",
        "function": {"name": "get_user_data", "arguments": "{}"},
    }
    first_message.tool_calls = [mock_tool_call]

    first_choice = MagicMock()
    first_choice.message = first_message

    second_message = MagicMock()
    second_message.content = "You have Anna as your first name on file."
    second_message.tool_calls = None

    second_choice = MagicMock()
    second_choice.message = second_message

    mock_completion.side_effect = [
        MagicMock(choices=[first_choice], usage=None),
        MagicMock(choices=[second_choice], usage=None),
    ]

    mock_conv = MagicMock()
    mock_conv.id = uuid.uuid4()
    mock_conv_service.get_or_create_in_progress_conversation.return_value = mock_conv
    mock_conv_service.get_conversation_context.return_value = []

    mock_user_service = MagicMock()
    app.dependency_overrides[get_user_service] = lambda: mock_user_service

    stored_data = {"first_name": "Anna"}
    with patch("src.routes.llm.get_user_data", new_callable=AsyncMock) as mock_get_user_data:
        mock_get_user_data.return_value = stored_data
        response = client.post("/chat", json=_chat_request_body("What do you already know about me?"))

        assert response.status_code == 200
        data = response.json()
        assert data["response"] == "You have Anna as your first name on file."
        assert len(data["tool_calls"]) == 1
        assert data["tool_calls"][0]["name"] == "get_user_data"
        assert data["tool_calls"][0]["args"] == {}
        mock_get_user_data.assert_called_once()


@patch("src.routes.llm.acompletion", new_callable=AsyncMock)
def test_chat_multi_round_tool_calls(
    mock_completion,
    mock_conv_service,
    mock_db,
):
    # Round 1: LLM calls get_user_table_schema
    first_function = MagicMock()
    first_function.name = "get_user_table_schema"
    first_function.arguments = "{}"
    first_tool_call = MagicMock()
    first_tool_call.id = "call_001"
    first_tool_call.function = first_function
    first_tool_call.model_dump.return_value = {
        "id": "call_001",
        "type": "function",
        "function": {"name": "get_user_table_schema", "arguments": "{}"},
    }

    first_message = MagicMock()
    first_message.content = None
    first_message.tool_calls = [first_tool_call]

    # Round 2: LLM calls update_user_data with schema knowledge
    second_function = MagicMock()
    second_function.name = "update_user_data"
    second_function.arguments = json.dumps({"updates": {"rent_total": 550.0}})
    second_tool_call = MagicMock()
    second_tool_call.id = "call_002"
    second_tool_call.function = second_function
    second_tool_call.model_dump.return_value = {
        "id": "call_002",
        "type": "function",
        "function": {"name": "update_user_data", "arguments": json.dumps({"updates": {"rent_total": 550.0}})},
    }

    second_message = MagicMock()
    second_message.content = None
    second_message.tool_calls = [second_tool_call]

    # Round 3: LLM returns final text
    third_message = MagicMock()
    third_message.content = "I've updated your rent to 550."
    third_message.tool_calls = None

    mock_completion.side_effect = [
        MagicMock(choices=[MagicMock(message=first_message)], usage=None),
        MagicMock(choices=[MagicMock(message=second_message)], usage=None),
        MagicMock(choices=[MagicMock(message=third_message)], usage=None),
    ]

    mock_conv = MagicMock()
    mock_conv.id = uuid.uuid4()
    mock_conv_service.get_or_create_in_progress_conversation.return_value = mock_conv
    mock_conv_service.get_conversation_context.return_value = []

    mock_user_service = MagicMock()
    app.dependency_overrides[get_user_service] = lambda: mock_user_service

    with patch("src.routes.llm.update_user_data", new_callable=AsyncMock) as mock_update_user_data:
        mock_update_user_data.return_value = {"status": "success", "message": "User data updated successfully"}
        response = client.post("/chat", json=_chat_request_body("My rent is 550"))

        assert response.status_code == 200
        data = response.json()
        assert data["response"] == "I've updated your rent to 550."
        assert len(data["tool_calls"]) == 2
        assert data["tool_calls"][0]["name"] == "get_user_table_schema"
        assert data["tool_calls"][1]["name"] == "update_user_data"
        assert mock_completion.call_count == 3
        mock_update_user_data.assert_called_once()


def test_chat_unauthenticated():
    async def raise_401():
        raise HTTPException(status_code=401, detail="Missing authentication token")

    app.dependency_overrides[require_authenticated_user] = raise_401

    response = client.post("/chat", json=_chat_request_body("Hello"))
    assert response.status_code == 401


@patch("src.routes.llm.acompletion", new_callable=AsyncMock)
def test_chat_max_tool_call_rounds(mock_completion, mock_conv_service):
    def make_tool_call_response(name, args, call_id):
        mock_function = MagicMock()
        mock_function.name = name
        mock_function.arguments = args
        mock_tool_call = MagicMock()
        mock_tool_call.id = call_id
        mock_tool_call.function = mock_function
        mock_tool_call.model_dump.return_value = {
            "id": call_id,
            "type": "function",
            "function": {"name": name, "arguments": args},
        }
        message = MagicMock()
        message.content = None
        message.tool_calls = [mock_tool_call]
        return MagicMock(choices=[MagicMock(message=message)], usage=None)

    final_message = MagicMock()
    final_message.content = "Done after max rounds."
    final_message.tool_calls = None

    side_effects = [make_tool_call_response("check_progress_status", "{}", f"call_{i}") for i in range(6)] + [
        MagicMock(choices=[MagicMock(message=final_message)], usage=None)
    ]
    mock_completion.side_effect = side_effects

    mock_conv = MagicMock()
    mock_conv.id = uuid.uuid4()
    mock_conv_service.get_or_create_in_progress_conversation.return_value = mock_conv
    mock_conv_service.get_conversation_context.return_value = []

    with patch("src.routes.llm.check_progress_status", new_callable=AsyncMock) as mock_check:
        mock_check.return_value = {"progress_percentage": 50, "missing_fields": []}
        response = client.post("/chat", json=_chat_request_body("Keep checking"))

    assert response.status_code == 200
    data = response.json()
    assert len(data["tool_calls"]) == 5
    assert mock_completion.call_count == 6


@pytest.mark.asyncio
async def test_update_user_data_updates_users_table(mock_db):
    mock_user_service = MagicMock()
    mock_user_service.get_internal_user_id.return_value = uuid.uuid4()

    mock_user = MagicMock(spec=DbUser)
    mock_user.update = MagicMock()
    mock_db.get.return_value = mock_user

    current_user = AuthUser(
        user_id="test-auth-id", user_name="1234567890", session_id="test-session-id", is_authenticated=True
    )

    result = await update_user_data({"phone_number": "0987654321"}, current_user, mock_db, mock_user_service)

    assert result["status"] == "success"
    mock_db.commit.assert_called_once()


@pytest.mark.asyncio
async def test_update_user_data_unknown_field(mock_db):
    mock_user_service = MagicMock()
    mock_user_service.get_internal_user_id.return_value = uuid.uuid4()

    current_user = AuthUser(
        user_id="test-auth-id", user_name="1234567890", session_id="test-session-id", is_authenticated=True
    )

    result = await update_user_data({"nonexistent_field": "value"}, current_user, mock_db, mock_user_service)

    assert "error" in result
    assert "nonexistent_field" in result["error"]


@pytest.mark.asyncio
async def test_update_user_data_db_error_rollback(mock_db):
    mock_user_service = MagicMock()
    mock_user_service.get_internal_user_id.return_value = uuid.uuid4()

    mock_user = MagicMock(spec=DbUser)
    mock_user.update = MagicMock()
    mock_db.get.return_value = mock_user
    mock_db.commit.side_effect = Exception("DB error")

    current_user = AuthUser(
        user_id="test-auth-id", user_name="1234567890", session_id="test-session-id", is_authenticated=True
    )

    result = await update_user_data({"phone_number": "0987654321"}, current_user, mock_db, mock_user_service)

    assert result == {"error": "Database error during user data update."}
    mock_db.rollback.assert_called()


@pytest.mark.asyncio
async def test_update_user_data_raises_404_if_not_found(mock_db):
    mock_user_service = MagicMock()
    mock_user_service.get_internal_user_id.return_value = uuid.uuid4()

    mock_db.get.return_value = None

    current_user = AuthUser(
        user_id="test-auth-id", user_name="1234567890", session_id="test-session-id", is_authenticated=True
    )

    result = await update_user_data({"first_name": "Test Name"}, current_user, mock_db, mock_user_service)

    assert result == {"error": "Row not found in table 'users' for user."}


@pytest.mark.asyncio
async def test_get_user_data_returns_serialized_fields(mock_db):
    mock_user_service = MagicMock()
    mock_user_service.get_internal_user_id.return_value = uuid.uuid4()

    mock_user = SimpleNamespace(
        first_name="Anna",
        legal_gender=GenderType.FEMALE,
        date_of_birth=date(1990, 5, 15),
        rent_total=decimal.Decimal("550.00"),
        zip_code="10178",
        city="Berlin",
        street="Rathausstraße",
    )
    mock_db.get.return_value = mock_user

    current_user = AuthUser(
        user_id="test-auth-id", user_name="1234567890", session_id="test-session-id", is_authenticated=True
    )

    result = await get_user_data(current_user, mock_db, mock_user_service)

    assert result["first_name"] == "Anna"
    assert result["legal_gender"] == "Female"
    assert result["date_of_birth"] == "1990-05-15"
    assert result["rent_total"] == "550.00"
    assert result["zip_code"] == "10178"
    assert result["city"] == "Berlin"
    assert result["street"] == "Rathausstraße"
    mock_user_service.get_internal_user_id.assert_called_once_with("1234567890")


@pytest.mark.asyncio
async def test_get_user_data_returns_error_when_user_missing(mock_db):
    mock_user_service = MagicMock()
    mock_user_service.get_internal_user_id.return_value = uuid.uuid4()
    mock_db.get.return_value = None

    current_user = AuthUser(
        user_id="test-auth-id", user_name="1234567890", session_id="test-session-id", is_authenticated=True
    )

    result = await get_user_data(current_user, mock_db, mock_user_service)

    assert result == {"error": "User not found in the database."}


@pytest.mark.asyncio
async def test_get_user_data_returns_error_when_internal_lookup_fails(mock_db):
    mock_user_service = MagicMock()
    mock_user_service.get_internal_user_id.side_effect = HTTPException(
        status_code=404, detail="User not found in internal database"
    )

    current_user = AuthUser(
        user_id="test-auth-id", user_name="1234567890", session_id="test-session-id", is_authenticated=True
    )

    result = await get_user_data(current_user, mock_db, mock_user_service)

    assert result == {"error": "User not found in the database."}


def test_list_conversations(mock_conv_service):
    """Test listing all conversations for the current user."""
    user_id = uuid.uuid4()

    conv1 = MagicMock()
    conv1.id = uuid.uuid4()
    conv1.user_id = user_id
    conv1.status.value = "in_progress"
    conv1.created_at = MagicMock()
    conv1.created_at.isoformat.return_value = "2024-01-01T00:00:00"
    conv1.updated_at = MagicMock()
    conv1.updated_at.isoformat.return_value = "2024-01-02T00:00:00"

    mock_conv_service.get_user_conversations.return_value = [conv1]

    response = client.get("/conversations")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["status"] == "in_progress"


def test_get_conversation_messages(mock_conv_service):
    """Test getting messages for a specific conversation."""
    conversation_id = uuid.uuid4()

    msg1 = MagicMock()
    msg1.id = uuid.uuid4()
    msg1.message_role.value = "user"
    msg1.content = "Hello"
    msg1.message_metadata = {}
    msg1.created_at = MagicMock()
    msg1.created_at.isoformat.return_value = "2024-01-01T00:00:00"

    mock_conv_service.get_conversation_messages.return_value = [msg1]

    response = client.get(f"/conversations/{conversation_id}/messages")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["message_role"] == "user"
    assert data[0]["content"] == "Hello"


def test_close_conversation(mock_conv_service):
    """Test closing a conversation."""
    user_id = uuid.uuid4()
    conversation_id = uuid.uuid4()

    closed_conv = MagicMock()
    closed_conv.id = conversation_id
    closed_conv.user_id = user_id
    closed_conv.status.value = "closed"
    closed_conv.created_at = MagicMock()
    closed_conv.created_at.isoformat.return_value = "2024-01-01T00:00:00"
    closed_conv.updated_at = MagicMock()
    closed_conv.updated_at.isoformat.return_value = "2024-01-02T00:00:00"

    mock_conv_service.close_conversation.return_value = closed_conv

    response = client.post(f"/conversations/{conversation_id}/close")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "closed"


def test_delete_conversation(mock_conv_service):
    """Test deleting a conversation."""
    conversation_id = uuid.uuid4()

    response = client.delete(f"/conversations/{conversation_id}")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    mock_conv_service.delete_conversation.assert_called_once_with(conversation_id)
