import uuid
from unittest.mock import MagicMock
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.main import app
from src.db import get_db
from src.models import Conversations, ConversationStatusType
from src.services.conversation_service import ConversationService, get_conversation_service
from beyondforms.auth import User as AuthUser, require_authenticated_user

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
            user_id="test-auth-id", user_name="1234567890", session_id="test-session-id", is_authenticated=True
        )

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[require_authenticated_user] = override_get_current_user
    app.dependency_overrides[get_conversation_service] = lambda: mock_conv_service
    yield
    app.dependency_overrides.clear()


def test_system_prompt_unbolding():
    from src.prompts import SYSTEM_PROMPT

    assert (
        "NEVER format these personal pronouns in bold or markdown emphasis" in SYSTEM_PROMPT
        or "MUST NOT format these pronouns in bold" in SYSTEM_PROMPT
    )


def test_get_in_progress_conversation():
    user_id = uuid.uuid4()
    mock_session = MagicMock(spec=Session)
    conv_service = ConversationService(mock_session, user_id)

    mock_conv = Conversations(id=uuid.uuid4(), fk_user_id=user_id, status=ConversationStatusType.IN_PROGRESS)
    mock_session.query.return_value.filter.return_value.first.return_value = mock_conv

    res = conv_service.get_in_progress_conversation()
    assert res == mock_conv
    mock_session.query.assert_called_with(Conversations)


def test_handle_new_chat(mock_conv_service, mock_db):
    response = client.post("/chat/new")

    assert response.status_code == 200
    assert response.json() == {"status": "success", "message": "Started new chat session"}
    mock_conv_service.close_all_in_progress_conversations.assert_called_once()
    mock_db.commit.assert_called_once()
