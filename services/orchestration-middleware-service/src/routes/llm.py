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
)
from src.services.conversation_service import ConversationService, get_conversation_service
from src.services.rag_service import search_knowledge_base
from beyondforms.auth import User as AuthUser, get_current_user, require_authenticated_user
from src.schemas import AssociatedPersonSchema, UserInformationUpdateSchema
from src.tools import AVAILABLE_TOOLS
from src.utils import ndjson_done, ndjson_error, ndjson_token


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
        for key, value in updates_by_table.items():
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


class ChatRequest(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def content_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("content must not be empty")
        return v


class ChatResponse(BaseModel):
    response: Optional[str] = None
    tool_calls: list[dict] = []
    conversation_id: uuid.UUID


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


@router.post("/chat", response_model=ChatResponse)
async def handle_chat(
    chat_request: ChatRequest = Body(...),
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(require_authenticated_user),
    conv_service: ConversationService = Depends(get_conversation_service),
    user_service: UserService = Depends(get_user_service),
):
    """
    Endpoint for handling chat interactions with the LLM.
    """
    conversation = conv_service.get_or_create_in_progress_conversation()
    conversation_id = conversation.id

    conv_service.add_message(
        conversation_id=conversation_id, role=ChatMessageRoleType.USER, content=chat_request.content
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

    tool_call_log: list[dict] = []
    round_count = 0

    while round_count < MAX_TOOL_CALL_ROUNDS:
        round_count += 1
        response = await acompletion(
            model="vertex_ai/" + os.getenv("GEMINI_MODEL_NAME"),
            reasoning_effort="low",
            messages=messages,
            tools=available_tools,
            tool_choice="auto",
            vertex_location="global",
            vertex_project=os.getenv("GCLOUD_PROJECT"),
            stream=False,
        )
        assistant_message = response.choices[0].message

        metadata = {}
        assistant_message_dict: dict = {"role": "assistant", "content": assistant_message.content}
        if hasattr(response, "usage") and response.usage:
            metadata["token_usage"] = {
                "prompt_tokens": getattr(response.usage, "prompt_tokens", None),
                "completion_tokens": getattr(response.usage, "completion_tokens", None),
                "total_tokens": getattr(response.usage, "total_tokens", None),
            }

        if assistant_message.tool_calls:
            metadata["tool_calls"] = [tc.model_dump() for tc in assistant_message.tool_calls]
            assistant_message_dict["tool_calls"] = metadata["tool_calls"]

        conv_service.add_message(
            conversation_id=conversation_id,
            role=ChatMessageRoleType.ASSISTANT,
            content=assistant_message.content,
            metadata=metadata,
        )
        db.commit()

        messages.append(assistant_message_dict)

        if not assistant_message.tool_calls:
            return ChatResponse(
                response=assistant_message.content,
                tool_calls=tool_call_log,
                conversation_id=conversation_id,
            )

        for tool_call in assistant_message.tool_calls:
            function_name = tool_call.function.name
            function_args = json.loads(tool_call.function.arguments)
            fn = tool_name_to_function_dict.get(function_name)

            if fn is None:
                result = {"error": f"Unknown function: {function_name}"}
            else:
                try:
                    result = await fn(**function_args)
                except Exception as fn_err:
                    logger.exception(f"Error executing tool {function_name}")
                    result = {"error": f"Error executing tool {function_name}: {fn_err}"}

            tool_call_log.append(
                {
                    "name": function_name,
                    "args": function_args,
                    "result": str(result),
                }
            )
            tool_content = str(result)
            conv_service.add_message(
                conversation_id=conversation_id,
                role=ChatMessageRoleType.TOOL,
                content=tool_content,
                metadata={
                    "tool_call_id": tool_call.id,
                    "name": function_name,
                },
            )
            db.commit()

            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "name": function_name,
                    "content": tool_content,
                }
            )

    response = await acompletion(
        model="vertex_ai/" + os.getenv("GEMINI_MODEL_NAME"),
        reasoning_effort="low",
        messages=messages,
        vertex_location="global",
        vertex_project=os.getenv("GCLOUD_PROJECT"),
    )

    final_message = response.choices[0].message
    metadata = {}
    if hasattr(response, "usage") and response.usage:
        metadata["token_usage"] = {
            "prompt_tokens": getattr(response.usage, "prompt_tokens", None),
            "completion_tokens": getattr(response.usage, "completion_tokens", None),
            "total_tokens": getattr(response.usage, "total_tokens", None),
        }

    conv_service.add_message(
        conversation_id=conversation_id,
        role=ChatMessageRoleType.ASSISTANT,
        content=final_message.content,
        metadata=metadata,
    )
    db.commit()

    return ChatResponse(
        response=final_message.content or "",
        tool_calls=tool_call_log,
        conversation_id=conversation_id,
    )


@router.post("/chat/stream")
async def handle_chat_stream(
    chat_request: ChatRequest = Body(...),
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(require_authenticated_user),
    conv_service: ConversationService = Depends(get_conversation_service),
    user_service: UserService = Depends(get_user_service),
):
    conversation = conv_service.get_or_create_in_progress_conversation()
    conversation_id = conversation.id

    conv_service.add_message(
        conversation_id=conversation_id,
        role=ChatMessageRoleType.USER,
        content=chat_request.content,
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

    async def generate():
        nonlocal messages

        for _round_num in range(1, MAX_TOOL_CALL_ROUNDS + 1):
            stream_response = await acompletion(
                model="vertex_ai/" + os.getenv("GEMINI_MODEL_NAME"),
                reasoning_effort="low",
                messages=messages,
                tools=available_tools,
                tool_choice="auto",
                vertex_location="global",
                vertex_project=os.getenv("GCLOUD_PROJECT"),
                stream=True,
            )

            accumulated_content = ""
            tool_calls_by_index: dict[int, dict] = {}

            try:
                async for chunk in stream_response:
                    delta = chunk.choices[0].delta

                    if delta.content:
                        accumulated_content += delta.content
                        yield ndjson_token(delta.content)

                    if delta.tool_calls:
                        for tc_delta in delta.tool_calls:
                            idx = tc_delta.index
                            if idx not in tool_calls_by_index:
                                tool_calls_by_index[idx] = {
                                    "id": tc_delta.id or "",
                                    "function": {"name": tc_delta.function.name or "", "arguments": ""},
                                }
                            if tc_delta.function and tc_delta.function.arguments:
                                tool_calls_by_index[idx]["function"]["arguments"] += tc_delta.function.arguments
            except Exception:
                yield ndjson_error("Streaming error")
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

                for tc in tool_calls_list:
                    function_name = tc["function"]["name"]
                    function_args = json.loads(tc["function"]["arguments"]) if tc["function"]["arguments"] else {}
                    fn = tool_name_to_function_dict.get(function_name)
                    if fn is None:
                        result = {"error": f"Unknown function: {function_name}"}
                    else:
                        try:
                            result = await fn(**function_args)
                        except Exception as fn_err:
                            logger.exception(f"Error executing tool {function_name}")
                            result = {"error": f"Error executing tool {function_name}: {fn_err}"}

                    tool_content = str(result)
                    conv_service.add_message(
                        conversation_id=conversation_id,
                        role=ChatMessageRoleType.TOOL,
                        content=tool_content,
                        metadata={"tool_call_id": tc["id"], "name": function_name},
                    )
                    db.commit()
                    messages.append(
                        {"role": "tool", "tool_call_id": tc["id"], "name": function_name, "content": tool_content},
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
                yield ndjson_done(conversation_id=conversation_id)
                return

        stream_response = await acompletion(
            model="vertex_ai/" + os.getenv("GEMINI_MODEL_NAME"),
            reasoning_effort="low",
            messages=messages,
            vertex_location="global",
            vertex_project=os.getenv("GCLOUD_PROJECT"),
            stream=True,
        )

        accumulated = ""
        try:
            async for chunk in stream_response:
                delta = chunk.choices[0].delta
                content = delta.content or ""
                accumulated += content
                if content:
                    yield ndjson_token(content)
        except Exception:
            yield ndjson_error("Streaming error")
            return

        conv_service.add_message(
            conversation_id=conversation_id,
            role=ChatMessageRoleType.ASSISTANT,
            content=accumulated or "",
            metadata={},
        )
        db.commit()
        yield ndjson_done(conversation_id=conversation_id)

    return StreamingResponse(generate(), media_type="application/x-ndjson")


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


class StatelessChatRequest(BaseModel):
    staged_data: dict
    recent_history: list[dict]
    target_schema: list[dict]


class StatelessChatResponse(BaseModel):
    extracted_data: dict
    next_question: Optional[str] = None


@router.post("/api/v1/stateless/chat", response_model=StatelessChatResponse)
async def stateless_chat(
    request: StatelessChatRequest,
    model_name: str = os.getenv("GEMINI_MODEL_NAME", "gemini-3.5-flash"),
):
    system_prompt = """
You are assisting a user in filling out a form.
Based on the current `staged_data` (what we already know) and the `recent_history` of the conversation,
extract any new information that maps to the `target_schema` and provide the `next_question` to fill the remaining gaps.

Current Staged Data:
{staged_data}

Target Schema (Fields to fill):
{target_schema}

Output Format:
You MUST return a JSON object with the following structure:
{{
  "extracted_data": {{
    "field_id": "value or null",
    ...
  }},
  "next_question": "Natural language text asking for the next missing field"
}}
""".format(staged_data=json.dumps(request.staged_data), target_schema=json.dumps(request.target_schema))

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(request.recent_history)

    try:
        response = await acompletion(
            model="vertex_ai/" + model_name,
            messages=messages,
            temperature=0,
            response_format={
                "type": "json_object",
                "response_schema": StatelessChatResponse,
            },
            vertex_project=os.getenv("GCLOUD_PROJECT"),
            vertex_location="global",
        )

        raw_json = response.choices[0].message.content
        result_dict = json.loads(raw_json)

        return StatelessChatResponse(
            extracted_data=result_dict.get("extracted_data", {}), next_question=result_dict.get("next_question")
        )

    except Exception:
        raise HTTPException(status_code=500, detail="Internal Server Error")


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
