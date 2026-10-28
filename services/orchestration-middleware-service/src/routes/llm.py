import asyncio
import enum
import json
import typing
from functools import partial
from typing import Optional
import os
import uuid

from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.responses import StreamingResponse

from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session
from litellm import acompletion
import logging

from src.db import get_db
from src.models import Users as DbUser, ChatMessageRoleType
from src.prompts import SYSTEM_PROMPT, generate_tool_usage_prompt
from src.services.user_service import (
    ProfileWriteError,
    UserService,
    apply_profile_key,
    get_user_service,
    ordered_profile_items,
)
from src.services.conversation_service import ConversationService, get_conversation_service
from src.services.rag_service import search_knowledge_base
from beyondforms.auth import User as AuthUser, get_current_user, require_authenticated_user
from src.schemas import AssociatedPersonSchema, UserInformationUpdateSchema
from src.tools import AVAILABLE_TOOLS
from ag_ui.core import RunStartedEvent, RunFinishedEvent, RunErrorEvent, TextMessageChunkEvent
from ag_ui.encoder import EventEncoder
from ag_ui.core.types import RunAgentInput


_USER_FIELD_NAMES: frozenset[str] = frozenset(UserInformationUpdateSchema.model_fields)


def _unwrap_annotation(annotation):
    """`Optional[X]` -> `X`. Every field on these schemas is optional, so the enum is
    always one level in."""
    args = typing.get_args(annotation)
    if isinstance(args, tuple) and args:
        return args[0]
    return annotation


def _allowed_enum_values(annotation) -> str:
    """A comma-separated list of an enum field's allowed values, or "" if not an enum."""
    annotation = _unwrap_annotation(annotation)
    if isinstance(annotation, type) and issubclass(annotation, enum.Enum):
        return ", ".join(repr(m.value) for m in annotation)
    return ""


_ENUM_ALLOWED_VALUES: dict[str, str] = {
    name: allowed
    for name, field_info in UserInformationUpdateSchema.model_fields.items()
    if (allowed := _allowed_enum_values(field_info.annotation))
}


MAX_TOOL_CALL_ROUNDS = 5
CHAT_CONTEXT_WINDOW_SIZE = int(os.getenv("CHAT_CONTEXT_WINDOW_SIZE", "20"))

router = APIRouter(tags=["llm"])
logger = logging.getLogger(__name__)


def _mock_llm_kwargs() -> dict:
    """
    Hermetic e2e mode (docker-compose CI): skip the real Vertex AI call and
    stream back a canned reply, so the chat UI can be exercised without real
    Gemini credentials.
    """
    if os.getenv("MOCK_LLM_RESPONSES") == "true":
        return {"mock_response": "Hallo! Wie kann ich dir heute helfen?"}
    return {}


_USER_TABLE_NAMES = frozenset(
    {
        "users",
        "user_applications",
        "uploaded_files",
        "user_documents",
    }
)


@router.get("/llm/health")
async def llm_health_check():
    """
    Health check endpoint for LLM-related operations
    """
    # TODO: Implement actual health check logic for LLM services
    return {"status": "LLM healthy"}


def _convert_str_to_enum(enum_cls: type[enum.Enum], value: str) -> enum.Enum:
    for member in enum_cls:
        if member.value == value:
            return member
    allowed = [m.value for m in enum_cls]
    raise ValueError(f"Invalid value '{value}'. Allowed values: {allowed}")


def _update_user_data_sync(updates: dict, current_user: AuthUser, db: Session, user_service: UserService) -> dict:
    try:
        internal_user_id = user_service.get_internal_user_id(current_user.user_name)
    except HTTPException:
        return {"error": "User not found in the database."}

    updates_by_table: dict[str, object] = {}
    unknown_fields: list[str] = []
    for col_name, value in updates.items():
        if col_name in _USER_FIELD_NAMES:
            if isinstance(value, str) and col_name in _ENUM_ALLOWED_VALUES:
                try:
                    annotation = _unwrap_annotation(UserInformationUpdateSchema.model_fields[col_name].annotation)
                    converted = _convert_str_to_enum(annotation, value)
                    value = converted
                except ValueError as e:
                    return {"error": f"Invalid value for '{col_name}': {e}"}
            updates_by_table[col_name] = value
        else:
            unknown_fields.append(col_name)

    if unknown_fields:
        return {"error": f"Unknown fields: {', '.join(unknown_fields)}"}

    user_row = db.get(DbUser, internal_user_id)
    if user_row is None:
        return {"error": "Row not found in table 'users' for user."}

    try:
        for key, value in ordered_profile_items(updates_by_table):
            try:
                if not apply_profile_key(user_row, key, value):
                    setattr(user_row, key, value)
            except ProfileWriteError as e:
                db.rollback()
                return {"error": str(e)}
        db.commit()
    except Exception:
        db.rollback()
        return {"error": "Database error during user data update."}

    return {
        "status": "success",
        "message": "User data updated successfully",
    }


async def update_user_data(updates: dict, current_user: AuthUser, db: Session, user_service: UserService) -> dict:
    """
    Update the user's data in the database.
    Groups updates by table based on column names from SQLAlchemy models.
    """
    return await asyncio.to_thread(_update_user_data_sync, updates, current_user, db, user_service)


def _get_user_data_sync(current_user: AuthUser, db: Session, user_service: UserService) -> dict:
    try:
        internal_user_id = user_service.get_internal_user_id(current_user.user_name)
    except HTTPException:
        return {"error": "User not found in the database."}
    user_row = db.get(DbUser, internal_user_id)
    if user_row is None:
        return {"error": "User not found in the database."}
    return UserInformationUpdateSchema.model_validate(user_row).model_dump(mode="json")


async def get_user_data(current_user: AuthUser, db: Session, user_service: UserService) -> dict:
    return await asyncio.to_thread(_get_user_data_sync, current_user, db, user_service)


def _field_lines(model: type[BaseModel], indent: str = "  ") -> list[str]:
    """One `name: type` line per field, with enum values and descriptions spelled out.
    A field the model rejects unless it is present is marked required, so a caller told
    to not guess field names actually has enough to construct a valid value."""
    lines: list[str] = []
    for name, field_info in sorted(model.model_fields.items()):
        annotation = field_info.annotation
        type_label = annotation.__name__ if isinstance(annotation, type) else str(annotation)
        line = f"{indent}{name}: {type_label}"
        allowed = _allowed_enum_values(annotation)
        if allowed:
            line += f" — allowed values: {allowed}"
        if field_info.is_required():
            line += " — REQUIRED"
        if field_info.description:
            line += f" — {field_info.description}"
        lines.append(line)
    return lines


async def get_user_table_schema() -> str:
    """
    Returns the full schema for user-related tables.
    Enum fields include their allowed values.

    `associated_persons` is a nested list, so its own fields are spelled out too —
    without them a caller cannot know that `association_type` is mandatory, and every
    write it attempts is rejected.
    """
    schema = "Table 'users':\n" + "\n".join(_field_lines(UserInformationUpdateSchema))
    person_fields = "\n".join(_field_lines(AssociatedPersonSchema))
    return f"{schema}\n\nEach entry of 'associated_persons' is an object with these fields:\n{person_fields}"


async def check_progress_status(current_user: AuthUser = Depends(get_current_user)) -> dict:
    """
    Check the progress status of the user's data.
    """
    # TODO: Implement logic to check the progress status of the user's data
    # user_id = current_user.id
    """
    form_id = current_user.form_id
    progress_percentage = get_progress_percentage(user_id, form_id)
    missing_fields = get_missing_fields(user_id, form_id)
    return {
        "progress_percentage": progress_percentage,
        "missing_fields": missing_fields,
    }
    """
    return {
        "progress_percentage": 50,
        "missing_fields": ["name", "email"],
    }


async def berlin_social_services_knowledge_base(question: str) -> str:
    try:
        response = await search_knowledge_base(question)
        return response
    except Exception as e:
        logger.exception("Knowledge base search failed")
        return f"Error: The knowledge base is temporarily unavailable. Details: {str(e)}"


def _prepare_chat_messages(context_messages: list[dict]) -> list[dict]:
    """
    Constructs the final, immutable messages payload for LiteLLM inference,
    prepending the unified System Prompt and pre-cached dynamic tool instructions
    without modifying execution state.
    """
    final_system_prompt = SYSTEM_PROMPT + generate_tool_usage_prompt()
    messages = [{"role": "system", "content": final_system_prompt}]
    messages.extend(context_messages)
    return messages


@router.post("/chat/stream")
async def handle_chat_stream(
    input_data: RunAgentInput = Body(...),
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(require_authenticated_user),
    conv_service: ConversationService = Depends(get_conversation_service),
    user_service: UserService = Depends(get_user_service),
):
    last = input_data.messages[-1] if input_data.messages else None
    if not (last and last.role == "user" and isinstance(last.content, str) and last.content.strip()):
        raise HTTPException(status_code=422, detail="content must not be empty")
    content = last.content

    conversation = conv_service.get_or_create_in_progress_conversation()
    conversation_id = conversation.id

    conv_service.add_message(
        conversation_id=conversation_id,
        role=ChatMessageRoleType.USER,
        content=content,
    )
    db.commit()

    context_messages = conv_service.get_conversation_context(conversation_id, limit=CHAT_CONTEXT_WINDOW_SIZE)

    available_tools = AVAILABLE_TOOLS

    tool_name_to_function_dict = {
        "get_user_table_schema": get_user_table_schema,
        "update_user_data": partial(update_user_data, current_user=current_user, db=db, user_service=user_service),
        "get_user_data": partial(get_user_data, current_user=current_user, db=db, user_service=user_service),
        "check_progress_status": partial(check_progress_status, current_user=current_user),
        "berlin_social_services_knowledge_base": berlin_social_services_knowledge_base,
    }

    messages = _prepare_chat_messages(context_messages)

    async def event_generator():
        nonlocal messages

        encoder = EventEncoder()

        thread_id = str(conversation_id)
        run_id = str(input_data.run_id)

        yield encoder.encode(RunStartedEvent(thread_id=thread_id, run_id=run_id))

        for round_num in range(1, MAX_TOOL_CALL_ROUNDS + 1):
            message_id = str(uuid.uuid4())
            accumulated_content = ""
            tool_calls_by_index: dict[int, dict] = {}

            try:
                stream_response = await acompletion(
                    model="vertex_ai/" + os.getenv("GEMINI_MODEL_NAME"),
                    reasoning_effort="low",
                    messages=messages,
                    tools=available_tools,
                    # last round forces a text answer
                    tool_choice="auto" if round_num < MAX_TOOL_CALL_ROUNDS else "none",
                    vertex_location="global",
                    vertex_project=os.getenv("GCLOUD_PROJECT"),
                    stream=True,
                    **_mock_llm_kwargs(),
                )
                async for chunk in stream_response:
                    if hasattr(chunk.choices[0].delta, "content") and chunk.choices[0].delta.content:
                        content = chunk.choices[0].delta.content
                        accumulated_content += content
                        yield encoder.encode(
                            TextMessageChunkEvent(
                                message_id=message_id,
                                delta=content,
                            )
                        )

                    if hasattr(chunk.choices[0].delta, "tool_calls") and chunk.choices[0].delta.tool_calls:
                        tool_calls = chunk.choices[0].delta.tool_calls
                        for tool_call in tool_calls:
                            idx = tool_call.index
                            if idx not in tool_calls_by_index:
                                tool_calls_by_index[idx] = {
                                    "id": tool_call.id or "",
                                    "function": {"name": tool_call.function.name or "", "arguments": ""},
                                }
                            if tool_call.function and tool_call.function.arguments:
                                tool_calls_by_index[idx]["function"]["arguments"] += tool_call.function.arguments
            except Exception as e:
                logger.exception(e)
                yield encoder.encode(RunErrorEvent(thread_id=thread_id, run_id=run_id, message="Streaming Error"))
                return

            if tool_calls_by_index:
                tool_calls_list = [tool_calls_by_index[i] for i in sorted(tool_calls_by_index)]
                assistant_dict: dict = {"role": "assistant", "content": accumulated_content or None}
                assistant_dict["tool_calls"] = tool_calls_list

                conv_service.add_message(
                    conversation_id=conversation_id,
                    role=ChatMessageRoleType.ASSISTANT,
                    content=accumulated_content or None,
                    metadata={"tool_calls": tool_calls_list},
                )
                db.commit()
                messages.append(assistant_dict)

                for tool_call in tool_calls_list:
                    function_name = tool_call["function"]["name"]
                    function_args = (
                        json.loads(tool_call["function"]["arguments"]) if tool_call["function"]["arguments"] else {}
                    )
                    fn = tool_name_to_function_dict.get(function_name)
                    if fn is None:
                        result = {"error": f"Unknown function: {function_name}"}
                    else:
                        try:
                            result = await fn(**function_args)
                        except Exception as fn_err:
                            logger.exception(f"Error executing tool {function_name}")
                            result = {"error": f"Error executing tool {function_name}: {fn_err}"}

                    tool_content = json.dumps(result, default=str)
                    conv_service.add_message(
                        conversation_id=conversation_id,
                        role=ChatMessageRoleType.TOOL,
                        content=tool_content,
                        metadata={"tool_call_id": tool_call["id"], "name": function_name},
                    )
                    db.commit()
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": tool_call["id"],
                            "name": function_name,
                            "content": tool_content,
                        },
                    )
                continue

            if accumulated_content:
                conv_service.add_message(
                    conversation_id=conversation_id,
                    role=ChatMessageRoleType.ASSISTANT,
                    content=accumulated_content,
                    metadata={},
                )
                db.commit()
            break

        yield encoder.encode(RunFinishedEvent(thread_id=thread_id, run_id=run_id))

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/chat/new")
async def handle_new_chat(
    db: Session = Depends(get_db),
    conv_service: ConversationService = Depends(get_conversation_service),
):
    """
    Close all current in-progress conversations for the user atomically.
    The subsequent chat message will automatically provision a fresh conversation thread.
    """
    conv_service.close_all_in_progress_conversations()
    db.commit()
    return {"status": "success", "message": "Started new chat session"}


@router.get("/conversations")
def list_conversations(
    conv_service: ConversationService = Depends(get_conversation_service),
):
    """
    List all conversations for the current user.
    """
    conversations = conv_service.get_user_conversations()

    return [
        {
            "id": conv.id,
            "user_id": str(conv.fk_user_id),
            "status": conv.status.value,
        }
        for conv in conversations
    ]


@router.get("/conversations/{conversation_id}/messages")
def get_messages(
    conversation_id: uuid.UUID,
    conv_service: ConversationService = Depends(get_conversation_service),
):
    """
    Get all messages for a specific conversation.
    """
    messages = conv_service.get_conversation_messages(conversation_id)

    return [
        {
            "id": msg.id,
            "message_role": msg.message_role.value,
            "content": msg.content,
            "metadata": msg.message_metadata,
        }
        for msg in messages
    ]


@router.post("/conversations/{conversation_id}/close")
def close_conversation_endpoint(
    conversation_id: uuid.UUID,
    conv_service: ConversationService = Depends(get_conversation_service),
):
    """
    Close a conversation. No new messages can be added to a closed conversation.
    """
    conversation = conv_service.close_conversation(conversation_id)

    return {
        "id": str(conversation.id),
        "user_id": str(conversation.fk_user_id),
        "status": conversation.status.value,
    }


@router.delete("/conversations/{conversation_id}")
def delete_conversation_endpoint(
    conversation_id: uuid.UUID,
    conv_service: ConversationService = Depends(get_conversation_service),
):
    """
    Delete a conversation and all its messages.
    """
    conv_service.delete_conversation(conversation_id)

    return {"status": "success", "message": "Conversation deleted"}
