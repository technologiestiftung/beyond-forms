import uuid
import pytest
from unittest.mock import MagicMock
from fastapi import HTTPException

from src.services.conversation_service import ConversationService
from src.models import Conversations, ConversationMessages, ConversationStatusType, ChatMessageRoleType


@pytest.fixture
def mock_db():
    """Create a mock database session."""
    mock = MagicMock()
    return mock


@pytest.fixture
def conv_service(mock_db):
    """Create a ConversationService instance."""
    user_id = uuid.uuid4()
    return ConversationService(mock_db, user_id)


class TestGetOrCreateInProgressConversation:
    """Tests for get_or_create_in_progress_conversation function."""

    def test_returns_existing_in_progress_conversation(self, mock_db, conv_service):
        """Should return existing in-progress conversation for user."""
        existing_conv = MagicMock(spec=Conversations)
        existing_conv.fk_user_id = conv_service.user_id
        existing_conv.status = ConversationStatusType.IN_PROGRESS

        mock_db.query.return_value.filter.return_value.first.return_value = existing_conv

        result = conv_service.get_or_create_in_progress_conversation()

        assert result == existing_conv
        mock_db.add.assert_not_called()

    def test_creates_new_conversation_if_none_exists(self, mock_db, conv_service):
        """Should create a new conversation if no in-progress one exists."""
        mock_db.query.return_value.filter.return_value.first.return_value = None

        result = conv_service.get_or_create_in_progress_conversation()

        assert result.fk_user_id == conv_service.user_id
        assert result.status == ConversationStatusType.IN_PROGRESS
        mock_db.add.assert_called_once_with(result)
        mock_db.flush.assert_called_once()


class TestAddMessage:
    """Tests for add_message function."""

    def test_adds_message_successfully(self, mock_db, conv_service):
        """Should add a message to an in-progress conversation."""
        conversation_id = uuid.uuid4()

        conv = MagicMock(spec=Conversations)
        conv.id = conversation_id
        conv.fk_user_id = conv_service.user_id
        conv.status = ConversationStatusType.IN_PROGRESS
        mock_db.query.return_value.filter.return_value.first.return_value = conv

        result = conv_service.add_message(
            conversation_id=conversation_id,
            role=ChatMessageRoleType.USER,
            content="Hello, bot!",
        )

        assert result.fk_conversation_id == conversation_id
        assert result.message_role == ChatMessageRoleType.USER
        assert result.content == "Hello, bot!"
        mock_db.add.assert_called_once_with(result)
        mock_db.flush.assert_called_once()

    def test_adds_message_with_metadata(self, mock_db, conv_service):
        """Should add a message with metadata."""
        conversation_id = uuid.uuid4()
        metadata = {"token_usage": {"total_tokens": 100}}

        conv = MagicMock(spec=Conversations)
        conv.id = conversation_id
        conv.fk_user_id = conv_service.user_id
        conv.status = ConversationStatusType.IN_PROGRESS
        mock_db.query.return_value.filter.return_value.first.return_value = conv

        result = conv_service.add_message(
            conversation_id=conversation_id,
            role=ChatMessageRoleType.ASSISTANT,
            content="Hello!",
            metadata=metadata,
        )

        assert result.message_metadata == metadata

    def test_raises_on_closed_conversation(self, mock_db, conv_service):
        """Should raise HTTPException when adding to closed conversation."""
        conversation_id = uuid.uuid4()

        conv = MagicMock(spec=Conversations)
        conv.id = conversation_id
        conv.fk_user_id = conv_service.user_id
        conv.status = ConversationStatusType.IN_PROGRESS
        mock_db.query.return_value.filter.return_value.first.return_value = conv

        # Simulate DB trigger raising an error on flush
        error_msg = "Cannot add messages to a closed conversation"
        mock_db.flush.side_effect = Exception(error_msg)
        mock_db.rollback = MagicMock()

        with pytest.raises(HTTPException) as exc_info:
            conv_service.add_message(
                conversation_id=conversation_id,
                role=ChatMessageRoleType.USER,
                content="Hello!",
            )

        assert exc_info.value.status_code == 409
        assert "closed conversation" in exc_info.value.detail.lower()
        mock_db.rollback.assert_called_once()


class TestGetConversationContext:
    """Tests for get_conversation_context function."""

    def test_returns_empty_list_for_new_conversation(self, mock_db, conv_service):
        """Should return empty list when conversation has no messages."""
        conversation_id = uuid.uuid4()

        # Mock conversation lookup (in_progress)
        conv = MagicMock(spec=Conversations)
        conv.id = conversation_id
        conv.fk_user_id = conv_service.user_id
        conv.status = ConversationStatusType.IN_PROGRESS

        # Set up mock chain: first query returns conversation, second returns empty list
        query_mock = MagicMock()
        query_mock.filter.return_value.first.return_value = conv
        query_mock.filter.return_value.order_by.return_value.limit.return_value.all.return_value = []
        mock_db.query.return_value = query_mock

        result = conv_service.get_conversation_context(conversation_id)

        assert result == []

    def test_returns_messages_in_chronological_order(self, mock_db, conv_service):
        """Should return messages in chronological order (oldest first for LLM context)."""
        conversation_id = uuid.uuid4()

        # Mock conversation lookup (in_progress)
        conv = MagicMock(spec=Conversations)
        conv.id = conversation_id
        conv.fk_user_id = conv_service.user_id
        conv.status = ConversationStatusType.IN_PROGRESS

        msg1 = MagicMock()
        msg1.message_role = ChatMessageRoleType.USER
        msg1.content = "First message"
        msg1.message_metadata = {}

        msg2 = MagicMock()
        msg2.message_role = ChatMessageRoleType.ASSISTANT
        msg2.content = "Second message"
        msg2.message_metadata = {}

        msg3 = MagicMock()
        msg3.message_role = ChatMessageRoleType.USER
        msg3.content = "Third message"
        msg3.message_metadata = {}

        query_mock = MagicMock()
        query_mock.filter.return_value.first.return_value = conv
        query_mock.filter.return_value.order_by.return_value.limit.return_value.all.return_value = [
            msg3,
            msg2,
            msg1,
        ]
        mock_db.query.return_value = query_mock

        result = conv_service.get_conversation_context(conversation_id)

        assert len(result) == 3
        assert result[0] == {"role": "user", "content": "First message"}
        assert result[1] == {"role": "assistant", "content": "Second message"}
        assert result[2] == {"role": "user", "content": "Third message"}

    def test_respects_limit_parameter(self, mock_db, conv_service):
        """Should respect the limit parameter."""
        conversation_id = uuid.uuid4()

        # Mock conversation lookup (in_progress)
        conv = MagicMock(spec=Conversations)
        conv.id = conversation_id
        conv.fk_user_id = conv_service.user_id
        conv.status = ConversationStatusType.IN_PROGRESS

        messages = [
            MagicMock(message_role=ChatMessageRoleType.USER, content=f"Message {i}", message_metadata={})
            for i in range(10)
        ]

        query_mock = MagicMock()
        query_mock.filter.return_value.first.return_value = conv
        limit_mock = MagicMock()
        limit_mock.all.return_value = messages
        query_mock.filter.return_value.order_by.return_value.limit.return_value = limit_mock
        mock_db.query.return_value = query_mock

        conv_service.get_conversation_context(conversation_id, limit=10)

        # Verify limit was called with 10
        query_mock.filter.return_value.order_by.return_value.limit.assert_called_once_with(10)

    def test_raises_404_if_conversation_not_found(self, mock_db, conv_service):
        """Should raise 404 if conversation doesn't exist."""
        conversation_id = uuid.uuid4()

        mock_db.query.return_value.filter.return_value.first.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            conv_service.get_conversation_context(conversation_id)

        assert exc_info.value.status_code == 404

    def test_raises_409_if_conversation_closed(self, mock_db, conv_service):
        """Should raise 409 if conversation is closed."""
        conversation_id = uuid.uuid4()

        conv = MagicMock(spec=Conversations)
        conv.id = conversation_id
        conv.fk_user_id = conv_service.user_id
        conv.status = ConversationStatusType.CLOSED

        mock_db.query.return_value.filter.return_value.first.return_value = conv

        with pytest.raises(HTTPException) as exc_info:
            conv_service.get_conversation_context(conversation_id)

        assert exc_info.value.status_code == 409

    def test_reconstructs_tool_calls_and_tool_call_ids(self, mock_db, conv_service):
        """Should reconstruct tool_calls for assistant messages and tool_call_id/name for tool messages."""
        conversation_id = uuid.uuid4()

        conv = MagicMock(spec=Conversations)
        conv.id = conversation_id
        conv.fk_user_id = conv_service.user_id
        conv.status = ConversationStatusType.IN_PROGRESS

        assistant_msg = MagicMock()
        assistant_msg.message_role = ChatMessageRoleType.ASSISTANT
        assistant_msg.content = None
        assistant_msg.message_metadata = {
            "tool_calls": [
                {"id": "call_123", "type": "function", "function": {"name": "check_progress_status", "arguments": "{}"}}
            ]
        }

        tool_msg = MagicMock()
        tool_msg.message_role = ChatMessageRoleType.TOOL
        tool_msg.content = "Done"
        tool_msg.message_metadata = {"tool_call_id": "call_123", "name": "check_progress_status"}

        query_mock = MagicMock()
        query_mock.filter.return_value.first.return_value = conv
        query_mock.filter.return_value.order_by.return_value.limit.return_value.all.return_value = [
            tool_msg,
            assistant_msg,
        ]
        mock_db.query.return_value = query_mock

        result = conv_service.get_conversation_context(conversation_id)

        assert len(result) == 2
        assert result[0] == {
            "role": "assistant",
            "content": None,
            "tool_calls": [
                {"id": "call_123", "type": "function", "function": {"name": "check_progress_status", "arguments": "{}"}}
            ],
        }
        assert result[1] == {
            "role": "tool",
            "content": "Done",
            "tool_call_id": "call_123",
            "name": "check_progress_status",
        }


class TestCloseConversation:
    """Tests for close_conversation function."""

    def test_closes_conversation_successfully(self, mock_db, conv_service):
        """Should close an in-progress conversation."""
        conversation_id = uuid.uuid4()

        conv = MagicMock(spec=Conversations)
        conv.id = conversation_id
        conv.fk_user_id = conv_service.user_id
        conv.status = ConversationStatusType.IN_PROGRESS

        mock_db.query.return_value.filter.return_value.first.return_value = conv

        result = conv_service.close_conversation(conversation_id)

        assert result.status == ConversationStatusType.CLOSED
        mock_db.flush.assert_called_once()

    def test_raises_404_if_conversation_not_found(self, mock_db, conv_service):
        """Should raise 404 if conversation doesn't exist."""
        conversation_id = uuid.uuid4()

        mock_db.query.return_value.filter.return_value.first.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            conv_service.close_conversation(conversation_id)

        assert exc_info.value.status_code == 404

    def test_raises_403_if_user_doesnt_own_conversation(self, mock_db, conv_service):
        """Should raise 403 if user doesn't own the conversation."""
        other_user_id = uuid.uuid4()
        conversation_id = uuid.uuid4()

        conv = MagicMock(spec=Conversations)
        conv.id = conversation_id
        conv.fk_user_id = other_user_id  # Different user

        mock_db.query.return_value.filter.return_value.first.return_value = conv

        with pytest.raises(HTTPException) as exc_info:
            conv_service.close_conversation(conversation_id)

        assert exc_info.value.status_code == 403


class TestDeleteConversation:
    """Tests for delete_conversation function."""

    def test_deletes_conversation_successfully(self, mock_db, conv_service):
        """Should delete a conversation owned by the user."""
        conversation_id = uuid.uuid4()

        conv = MagicMock(spec=Conversations)
        conv.id = conversation_id
        conv.fk_user_id = conv_service.user_id

        mock_db.query.return_value.filter.return_value.first.return_value = conv

        conv_service.delete_conversation(conversation_id)

        mock_db.delete.assert_called_once_with(conv)

    def test_raises_404_if_conversation_not_found(self, mock_db, conv_service):
        """Should raise 404 if conversation doesn't exist."""
        conversation_id = uuid.uuid4()

        mock_db.query.return_value.filter.return_value.first.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            conv_service.delete_conversation(conversation_id)

        assert exc_info.value.status_code == 404

    def test_raises_403_if_user_doesnt_own_conversation(self, mock_db, conv_service):
        """Should raise 403 if user doesn't own the conversation."""
        other_user_id = uuid.uuid4()
        conversation_id = uuid.uuid4()

        conv = MagicMock(spec=Conversations)
        conv.id = conversation_id
        conv.fk_user_id = other_user_id

        mock_db.query.return_value.filter.return_value.first.return_value = conv

        with pytest.raises(HTTPException) as exc_info:
            conv_service.delete_conversation(conversation_id)

        assert exc_info.value.status_code == 403


class TestGetUserConversations:
    """Tests for get_user_conversations function."""

    def test_returns_all_user_conversations(self, mock_db, conv_service):
        """Should return all conversations for a user."""
        conv1 = MagicMock(spec=Conversations)
        conv1.fk_user_id = conv_service.user_id
        conv2 = MagicMock(spec=Conversations)
        conv2.fk_user_id = conv_service.user_id

        mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [conv1, conv2]

        result = conv_service.get_user_conversations()

        assert len(result) == 2

    def test_orders_by_updated_at_desc(self, mock_db, conv_service):
        """Should order conversations by updated_at desc."""
        order_by_mock = MagicMock()
        mock_db.query.return_value.filter.return_value.order_by = order_by_mock
        order_by_mock.return_value.all.return_value = []

        conv_service.get_user_conversations()

        order_by_mock.assert_called_once()


class TestGetConversationMessages:
    """Tests for get_conversation_messages function."""

    def test_returns_messages_in_chronological_order(self, mock_db, conv_service):
        """Should return messages in chronological order."""
        conversation_id = uuid.uuid4()

        conv = MagicMock(spec=Conversations)
        conv.id = conversation_id
        conv.fk_user_id = conv_service.user_id

        msg1 = MagicMock(spec=ConversationMessages)
        msg2 = MagicMock(spec=ConversationMessages)

        query_mock = MagicMock()
        query_mock.filter.return_value.first.return_value = conv
        query_mock.filter.return_value.order_by.return_value.all.return_value = [msg1, msg2]
        mock_db.query.return_value = query_mock

        result = conv_service.get_conversation_messages(conversation_id)

        assert len(result) == 2
        assert result[0] == msg1
        assert result[1] == msg2

    def test_raises_404_if_conversation_not_found(self, mock_db, conv_service):
        """Should raise 404 if conversation doesn't exist."""
        conversation_id = uuid.uuid4()

        mock_db.query.return_value.filter.return_value.first.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            conv_service.get_conversation_messages(conversation_id)

        assert exc_info.value.status_code == 404

    def test_raises_403_if_user_doesnt_own_conversation(self, mock_db, conv_service):
        """Should raise 403 if user doesn't own the conversation."""
        other_user_id = uuid.uuid4()
        conversation_id = uuid.uuid4()

        conv = MagicMock(spec=Conversations)
        conv.id = conversation_id
        conv.fk_user_id = other_user_id

        mock_db.query.return_value.filter.return_value.first.return_value = conv

        with pytest.raises(HTTPException) as exc_info:
            conv_service.get_conversation_messages(conversation_id)

        assert exc_info.value.status_code == 403


class TestGetConversationById:
    """Tests for get_conversation_by_id function."""

    def test_returns_conversation_if_owned(self, mock_db, conv_service):
        """Should return conversation if user owns it."""
        conversation_id = uuid.uuid4()

        conv = MagicMock(spec=Conversations)
        conv.id = conversation_id
        conv.fk_user_id = conv_service.user_id

        mock_db.query.return_value.filter.return_value.first.return_value = conv

        result = conv_service.get_conversation_by_id(conversation_id)

        assert result == conv

    def test_returns_none_if_not_found(self, mock_db, conv_service):
        """Should return None if conversation doesn't exist."""
        conversation_id = uuid.uuid4()

        mock_db.query.return_value.filter.return_value.first.return_value = None

        result = conv_service.get_conversation_by_id(conversation_id)

        assert result is None

    def test_raises_403_if_user_doesnt_own_conversation(self, mock_db, conv_service):
        """Should raise 403 if user doesn't own the conversation."""
        other_user_id = uuid.uuid4()
        conversation_id = uuid.uuid4()

        conv = MagicMock(spec=Conversations)
        conv.id = conversation_id
        conv.fk_user_id = other_user_id

        mock_db.query.return_value.filter.return_value.first.return_value = conv

        with pytest.raises(HTTPException) as exc_info:
            conv_service.get_conversation_by_id(conversation_id)

        assert exc_info.value.status_code == 403
