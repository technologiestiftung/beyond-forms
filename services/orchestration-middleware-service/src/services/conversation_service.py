import uuid
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status, Depends
from beyondforms.auth import User as AuthUser, require_authenticated_user

from src.db import get_db
from src.models import Conversations, ConversationMessages, ConversationStatusType, ChatMessageRoleType
from src.services.user_service import UserService, get_user_service


class ConversationService:
    """Service for managing LLM chat conversations."""

    def __init__(self, db: Session, user_id: uuid.UUID):
        self.db = db
        self.user_id = user_id

    def get_in_progress_conversation(self) -> Optional[Conversations]:
        return (
            self.db.query(Conversations)
            .filter(
                Conversations.fk_user_id == self.user_id, Conversations.status == ConversationStatusType.IN_PROGRESS
            )
            .first()
        )

    def get_or_create_in_progress_conversation(self) -> Conversations:
        conversation = (
            self.db.query(Conversations)
            .filter(
                Conversations.fk_user_id == self.user_id, Conversations.status == ConversationStatusType.IN_PROGRESS
            )
            .first()
        )

        if conversation:
            return conversation

        conversation = Conversations(fk_user_id=self.user_id, status=ConversationStatusType.IN_PROGRESS)
        self.db.add(conversation)
        self.db.flush()
        return conversation

    def add_message(
        self,
        conversation_id: uuid.UUID,
        role: ChatMessageRoleType,
        content: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> ConversationMessages:
        conversation = self.db.query(Conversations).filter(Conversations.id == conversation_id).first()

        if not conversation:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

        if conversation.fk_user_id != self.user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

        if conversation.status != ConversationStatusType.IN_PROGRESS:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Cannot add message to a closed conversation"
            )

        message = ConversationMessages(
            fk_conversation_id=conversation_id, message_role=role, content=content, message_metadata=metadata or {}
        )
        try:
            self.db.add(message)
            self.db.flush()
        except Exception:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Cannot add message to a closed conversation"
            )
        return message

    def get_conversation_context(self, conversation_id: uuid.UUID, limit: int = 20) -> list[dict]:
        """Retrieve the last N messages from an in-progress conversation in chronological order."""
        conversation = self.db.query(Conversations).filter(Conversations.id == conversation_id).first()

        if not conversation:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

        if conversation.fk_user_id != self.user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

        if conversation.status != ConversationStatusType.IN_PROGRESS:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Cannot retrieve context from a closed conversation"
            )

        messages = (
            self.db.query(ConversationMessages)
            .filter(ConversationMessages.fk_conversation_id == conversation_id)
            .order_by(ConversationMessages.created_at.desc())
            .limit(limit)
            .all()
        )

        messages.reverse()

        context: list[dict] = []
        for msg in messages:
            message_dict: dict = {"role": msg.message_role.value, "content": msg.content}
            meta = msg.message_metadata or {}
            if msg.message_role == ChatMessageRoleType.ASSISTANT:
                if meta.get("tool_calls"):
                    message_dict["tool_calls"] = meta["tool_calls"]
            elif msg.message_role == ChatMessageRoleType.TOOL:
                message_dict["tool_call_id"] = meta.get("tool_call_id")
                message_dict["name"] = meta.get("name")
            context.append(message_dict)
        return context

    def close_conversation(self, conversation_id: uuid.UUID) -> Conversations:
        conversation = self.db.query(Conversations).filter(Conversations.id == conversation_id).first()

        if not conversation:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

        if conversation.fk_user_id != self.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="You don't have permission to close this conversation"
            )

        conversation.status = ConversationStatusType.CLOSED
        self.db.flush()
        return conversation

    def close_all_in_progress_conversations(self) -> None:
        """Close all in-progress conversations for the user atomically."""
        self.db.query(Conversations).filter(
            Conversations.fk_user_id == self.user_id,
            Conversations.status == ConversationStatusType.IN_PROGRESS,
        ).update({"status": ConversationStatusType.CLOSED})
        self.db.flush()

    def delete_conversation(self, conversation_id: uuid.UUID) -> None:
        """Delete a conversation and all its messages."""
        conversation = self.db.query(Conversations).filter(Conversations.id == conversation_id).first()

        if not conversation:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

        if conversation.fk_user_id != self.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="You don't have permission to delete this conversation"
            )

        self.db.delete(conversation)
        self.db.flush()

    def get_user_conversations(self) -> list[Conversations]:
        """Get all conversations for the user, ordered by most recent first."""
        return (
            self.db.query(Conversations)
            .filter(Conversations.fk_user_id == self.user_id)
            .order_by(Conversations.updated_at.desc())
            .all()
        )

    def get_conversation_messages(self, conversation_id: uuid.UUID) -> list[ConversationMessages]:
        conversation = self.db.query(Conversations).filter(Conversations.id == conversation_id).first()

        if not conversation:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

        if conversation.fk_user_id != self.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="You don't have permission to view this conversation"
            )

        return (
            self.db.query(ConversationMessages)
            .filter(ConversationMessages.fk_conversation_id == conversation_id)
            .order_by(ConversationMessages.created_at.asc())
            .all()
        )

    def get_conversation_by_id(self, conversation_id: uuid.UUID) -> Optional[Conversations]:
        conversation = self.db.query(Conversations).filter(Conversations.id == conversation_id).first()

        if not conversation:
            return None

        if conversation.fk_user_id != self.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="You don't have permission to access this conversation"
            )

        return conversation


def get_conversation_service(
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(require_authenticated_user),
    user_service: UserService = Depends(get_user_service),
) -> ConversationService:
    """FastAPI dependency to get a ConversationService for the current user."""
    internal_user_id = user_service.get_internal_user_id(current_user.user_name)
    return ConversationService(db, uuid.UUID(str(internal_user_id)))
