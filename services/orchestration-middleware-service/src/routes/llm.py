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

from pydantic import BaseModel, ValidationError
from sqlalchemy.orm import Session
from litellm import acompletion
import logging

from src.db import get_db
from src.models import Users as DbUser, ChatMessageRoleType, UserApplications
from src.prompts import SYSTEM_PROMPT, generate_tool_usage_prompt
from src.services.user_service import (
    ProfileWriteError,
    UserService,
    apply_profile_key,
    get_user_service,
    ordered_profile_items,
    write_profile_payload,
)
from src.services.conversation_service import ConversationService, get_conversation_service
from src.services.rag_service import search_knowledge_base
from beyondforms.auth import User as AuthUser, get_current_user, require_authenticated_user
from src.schemas import AssociatedPersonSchema, UserInformationUpdateSchema, UserProfileValidationSchema
from src.tools import AVAILABLE_TOOLS, SAVE_ANSWER_TOOL_NAME, SHOW_CARD_TOOL_NAME
from src.chat_cards import (
    APPLICATION_DONE_PROMPT,
    CardInput,
    asked_in_chat,
    build_inputs_view,
    input_errors,
    inputs_prompt,
)
from src.services.form_rules import (
    attachment_parents,
    card_id as form_card_id,
    group_answer,
    group_card_about,
    group_inputs,
    load_form_rules,
    parse_card_id as parse_form_card_id,
)
from src.services.form_service import FormService
from ag_ui.core import RunStartedEvent, RunFinishedEvent, RunErrorEvent, TextMessageChunkEvent, ToolCallChunkEvent
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
MAX_CARD_ANSWER_LENGTH = 4000
# the PDF form whose rules (`schemas/rules/<form>.rules.json`) pick every next question
FORM_RULES_FORM_ID = "antrag_grundsicherung_im_alter"
ANSWERED_AGAIN_PROMPT = (
    "\nThe user already answered this card, but it is not complete yet: show it again and say what is missing."
)

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


async def _form_state(form_service: FormService, user_row: DbUser, form_id: str) -> tuple[dict, set[str]]:
    """The form's field values, and the fields answered in the profile or in a chat card."""
    values, answered, _pdf_bytes = await form_service.resolve_field_state(form_id, user_row)
    if user_row.demo_seed_fixture_hash:
        # a demo persona lists only what it has; whatever it leaves out is zero or empty
        return values, set(values)
    application = form_service.find_application(form_id, user_row)
    form_data = (application.form_data if application else None) or {}
    return values, answered | set((form_data.get("pdf_fields") or {}).get(form_id) or {})


async def _open_form_groups(db: Session, user_row: DbUser) -> list[tuple[str, dict]]:
    """The open groups of the application form, then of each attachment form (Anlage) its answers
    require, in that order."""
    main_rules = load_form_rules(FORM_RULES_FORM_ID)
    if main_rules is None:
        return []
    form_service = FormService(db=db)
    main_values, main_answered = await _form_state(form_service, user_row, FORM_RULES_FORM_ID)
    forms = [(FORM_RULES_FORM_ID, main_rules, main_values, main_answered)]
    for form_id in main_rules.required_attachments(main_values):
        if rules := load_form_rules(form_id):
            forms.append((form_id, rules, *await _form_state(form_service, user_row, form_id)))
    return [
        (form_id, group) for form_id, rules, values, answered in forms for group in rules.open_groups(values, answered)
    ]


async def _next_form_card(
    db: Session, user_row: Optional[DbUser], answered_card_ids: set[str]
) -> tuple[Optional[str], str, list[CardInput]]:
    """The first open group of the form rules as a card, what the model is told about it, and its inputs."""
    if user_row is None:
        return None, "", []
    try:
        open_groups = await _open_form_groups(db, user_row)
    except Exception:
        logger.warning("Could not resolve the fields of %s", FORM_RULES_FORM_ID, exc_info=True)
        return None, "", []
    if not open_groups:
        return None, APPLICATION_DONE_PROMPT, []
    form_id, group = open_groups[0]
    offered = form_card_id(form_id, group["id"])
    inputs = group_inputs(group)
    prompt = inputs_prompt(offered, f"form {form_id}, page {group['page']}: {group_card_about(group)}", inputs)
    if offered in answered_card_ids:
        prompt += ANSWERED_AGAIN_PROMPT
    return offered, prompt, inputs


async def _save_form_card_answer(
    db: Session, user_row: DbUser, user_service: UserService, offered: str, values: object
) -> None:
    """Stores a form card's answer: in the profile column a field's mapping prints unchanged, otherwise in
    the application's `form_data`, which `fill_form` reads for the fields the mapping leaves empty."""
    form_id, group_id = parse_form_card_id(offered)
    open_groups = dict((f"{f}:{g['id']}", g) for f, g in await _open_form_groups(db, user_row))
    group = open_groups.get(f"{form_id}:{group_id}")
    if group is None:
        raise HTTPException(status_code=409, detail="This question has already been answered")
    inputs = group_inputs(group)
    values, errors = input_errors(inputs, values)
    if errors:
        raise HTTPException(status_code=422, detail="; ".join(errors))
    rules = load_form_rules(form_id)
    all_fields = rules.groups[group_id]["fields"] if rules and group_id in rules.groups else group["fields"]
    if (
        group["answer_type"] == "multiple_choice"
        and group["required"]
        and len(group["fields"]) == len(all_fields)
        and not any(values.get(i.key) is True for i in inputs)
    ):
        raise HTTPException(status_code=422, detail="At least one of the options must apply")
    answer = group_answer(group, values)

    form_service = FormService(db=db)
    columns = await form_service.plain_profile_columns(form_id)
    kinds = {i.key: i.kind for i in inputs}
    profile = {
        columns[f["field_id"]]: values[f["var"]]
        for f in group["fields"]
        if values.get(f["var"]) is not None
        and kinds.get(f["var"]) in ("text", "date", "amount", "number")
        and columns.get(f["field_id"]) in _USER_FIELD_NAMES
    }
    try:
        payload = UserProfileValidationSchema.model_validate(profile)
    except ValidationError:
        # a value the column rejects still fills the form
        payload = None
    if payload is not None:
        try:
            write_profile_payload(db, user_row, payload)
        except ProfileWriteError:
            db.rollback()
            payload = None
    stored = {name for name in profile} if payload is not None else set()
    by_column = {f["field_id"]: columns.get(f["field_id"]) for f in group["fields"]}
    # every field of the card is recorded, so one left empty on purpose counts as answered
    unanswered = {f["field_id"]: False if f["type"] == "bool" else "" for f in group["fields"]}
    rest = {
        field_id: value for field_id, value in {**unanswered, **answer}.items() if by_column.get(field_id) not in stored
    }

    parent = attachment_parents().get(form_id, form_id)
    application = form_service.find_application(form_id, user_row)
    if application is None or application.form_type not in (parent, "grundsicherung"):
        _, application_id = user_service.get_or_create_user_application(user_row.id, parent)
        application = db.get(UserApplications, application_id)
    form_data = dict(application.form_data or {})
    pdf_fields = dict(form_data.get("pdf_fields") or {})
    pdf_fields[form_id] = {**(pdf_fields.get(form_id) or {}), **rest}
    # reassigned rather than mutated, so SQLAlchemy sees the JSONB change
    application.form_data = {**form_data, "pdf_fields": pdf_fields}


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


def _prepare_chat_messages(context_messages: list[dict], card_instructions: str = "") -> list[dict]:
    """
    Constructs the final, immutable messages payload for LiteLLM inference,
    prepending the unified System Prompt and pre-cached dynamic tool instructions
    without modifying execution state.
    """
    final_system_prompt = SYSTEM_PROMPT + generate_tool_usage_prompt()
    if card_instructions:
        final_system_prompt += "\n\n" + card_instructions
    messages = [{"role": "system", "content": final_system_prompt}]
    messages.extend(context_messages)
    return messages


def _unanswered_tool_calls(context_messages: list[dict]) -> list[dict]:
    """Tool calls of the latest assistant message that have no result yet, e.g. a card the user didn't click."""
    for i in range(len(context_messages) - 1, -1, -1):
        message = context_messages[i]
        if message["role"] == "user":
            return []
        if message["role"] == "assistant" and message.get("tool_calls"):
            answered = {m.get("tool_call_id") for m in context_messages[i + 1 :] if m["role"] == "tool"}
            return [tc for tc in message["tool_calls"] if tc["id"] not in answered]
    return []


def _tool_args(tool_call: dict) -> dict:
    try:
        args = json.loads(tool_call["function"]["arguments"] or "{}")
    except json.JSONDecodeError:
        return {}
    return args if isinstance(args, dict) else {}


def _answered_card_ids(context_messages: list[dict]) -> set[str]:
    answered = set()
    for message in context_messages:
        if message["role"] != "tool" or message.get("name") not in (SHOW_CARD_TOOL_NAME, SAVE_ANSWER_TOOL_NAME):
            continue
        try:
            result = json.loads(message.get("content") or "{}")
        except json.JSONDecodeError:
            continue
        if isinstance(result, dict) and "saved" in result:
            answered.add(result.get("card_id"))
    return answered


def _load_user_row(db: Session, user_service: UserService, current_user: AuthUser) -> Optional[DbUser]:
    try:
        return db.get(DbUser, user_service.get_internal_user_id(current_user.user_name))
    except HTTPException:
        return None


def _card_view(
    tool_call: dict, offered_card: Optional[str], offered_inputs: list[CardInput], already_shown: bool
) -> tuple[Optional[dict], Optional[str]]:
    if already_shown:
        return None, "Only one card can be shown per answer."
    args = _tool_args(tool_call)
    if offered_card is None or args.get("card_id") != offered_card:
        return None, f"Unknown card_id: {args.get('card_id')}"
    if asked_in_chat(offered_inputs):
        return None, "Ask this question in the chat instead and save the reply with save_answer."
    view, errors = build_inputs_view(offered_card, offered_inputs, args)
    if errors:
        return None, "Fix the card texts and call show_card again: " + "; ".join(errors)
    return view, None


async def _run_server_tool(tool_name_to_function_dict: dict, tool_call: dict):
    function_name = tool_call["function"]["name"]
    fn = tool_name_to_function_dict.get(function_name)
    if fn is None:
        return {"error": f"Unknown function: {function_name}"}
    try:
        function_args = json.loads(tool_call["function"]["arguments"]) if tool_call["function"]["arguments"] else {}
        return await fn(**function_args)
    except Exception as fn_err:
        logger.exception(f"Error executing tool {function_name}")
        return {"error": f"Error executing tool {function_name}: {fn_err}"}


async def _card_inputs(db: Session, user_row: DbUser, card_id: str) -> Optional[list[CardInput]]:
    """The inputs of the question offered next, or None if `card_id` is not the one offered next."""
    offered, _prompt, inputs = await _next_form_card(db, user_row, set())
    return inputs if offered is not None and offered == card_id else None


async def save_answer(
    card_id: str, values: dict, db: Session, user_row: Optional[DbUser], user_service: UserService
) -> dict:
    """Saves the reply to a question asked in the chat, the same way as a card answer."""
    inputs = await _card_inputs(db, user_row, card_id) if user_row is not None else None
    if not inputs or not asked_in_chat(inputs):
        return {"error": f"{card_id} is not a question to answer in the chat; show its card instead"}
    if not isinstance(values, dict):
        return {"error": "values must be an object keyed by the question's keys"}
    optional = {i.key for i in inputs if i.optional}
    # an optional key the user has nothing for is saved as skipped, so it is not asked again
    values = {
        key: None if key in optional and isinstance(value, str) and not value.strip() else value
        for key, value in values.items()
    }
    card_call = {"function": {"arguments": json.dumps({"card_id": card_id})}}
    try:
        saved = await _save_card_answer(db, user_row, user_service, card_call, json.dumps({"values": values}))
    except HTTPException as exc:
        return {"error": exc.detail}
    return json.loads(saved)


async def _save_card_answer(
    db: Session, user_row: Optional[DbUser], user_service: UserService, card_call: dict, content: str
) -> str:
    """Validates and saves the values a card submitted; returns the tool result for the model."""
    card_id = _tool_args(card_call).get("card_id")
    try:
        values = json.loads(content).get("values")
    except (json.JSONDecodeError, AttributeError):
        values = None
    if not parse_form_card_id(card_id) or user_row is None:
        raise HTTPException(status_code=422, detail="This card can't be saved")
    await _save_form_card_answer(db, user_row, user_service, card_id, values)
    return json.dumps({"card_id": card_id, "saved": values}, default=str)


@router.post("/chat/stream")
async def handle_chat_stream(
    input_data: RunAgentInput = Body(...),
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(require_authenticated_user),
    conv_service: ConversationService = Depends(get_conversation_service),
    user_service: UserService = Depends(get_user_service),
):
    last = input_data.messages[-1] if input_data.messages else None
    # a click on a card arrives as the result of its show_card call instead of a user message
    is_card_answer = bool(last and last.role == "tool")
    if not (last and last.role in ("user", "tool") and isinstance(last.content, str) and last.content.strip()):
        raise HTTPException(status_code=422, detail="content must not be empty")
    if is_card_answer and len(last.content) > MAX_CARD_ANSWER_LENGTH:
        raise HTTPException(status_code=422, detail="card answer is too long")
    content = last.content

    conversation = conv_service.get_or_create_in_progress_conversation()
    conversation_id = conversation.id

    user_row = _load_user_row(db, user_service, current_user)
    previous_context = conv_service.get_conversation_context(conversation_id, limit=CHAT_CONTEXT_WINDOW_SIZE)
    open_calls = _unanswered_tool_calls(previous_context)
    answered_card = None
    if is_card_answer:
        answered_card = next(
            (c for c in open_calls if c["id"] == last.tool_call_id and c["function"]["name"] == SHOW_CARD_TOOL_NAME),
            None,
        )
        if answered_card is None:
            raise HTTPException(status_code=409, detail="This card has already been answered")
        content = await _save_card_answer(db, user_row, user_service, answered_card, content)

    # The user typed instead of answering a card; Gemini rejects a tool call without a result
    for open_call in open_calls:
        if open_call is answered_card:
            continue
        conv_service.add_message(
            conversation_id=conversation_id,
            role=ChatMessageRoleType.TOOL,
            content=json.dumps({"answered_in_text": True}),
            metadata={"tool_call_id": open_call["id"], "name": open_call["function"]["name"]},
        )

    if answered_card is not None:
        conv_service.add_message(
            conversation_id=conversation_id,
            role=ChatMessageRoleType.TOOL,
            content=content,
            metadata={"tool_call_id": answered_card["id"], "name": SHOW_CARD_TOOL_NAME},
        )
    else:
        conv_service.add_message(
            conversation_id=conversation_id,
            role=ChatMessageRoleType.USER,
            content=content,
        )
    db.commit()

    context_messages = conv_service.get_conversation_context(conversation_id, limit=CHAT_CONTEXT_WINDOW_SIZE)

    answered_card_ids = _answered_card_ids(context_messages)
    available_tools = AVAILABLE_TOOLS

    tool_name_to_function_dict = {
        "get_user_table_schema": get_user_table_schema,
        "update_user_data": partial(update_user_data, current_user=current_user, db=db, user_service=user_service),
        "get_user_data": partial(get_user_data, current_user=current_user, db=db, user_service=user_service),
        "check_progress_status": partial(check_progress_status, current_user=current_user),
        "berlin_social_services_knowledge_base": berlin_social_services_knowledge_base,
        SAVE_ANSWER_TOOL_NAME: partial(save_answer, db=db, user_row=user_row, user_service=user_service),
    }

    async def event_generator():
        encoder = EventEncoder()

        thread_id = str(conversation_id)
        run_id = str(input_data.run_id)

        yield encoder.encode(RunStartedEvent(thread_id=thread_id, run_id=run_id))

        offered_card, card_instructions, offered_inputs = await _next_form_card(db, user_row, answered_card_ids)
        messages = _prepare_chat_messages(context_messages, card_instructions)

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
                yield encoder.encode(RunErrorEvent(message="Streaming Error"))
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

                card_call = None
                card_view = None
                answered_in_chat = False
                for tool_call in tool_calls_list:
                    function_name = tool_call["function"]["name"]
                    if function_name == SHOW_CARD_TOOL_NAME:
                        view, card_error = _card_view(
                            tool_call, offered_card, offered_inputs, already_shown=card_call is not None
                        )
                        if view is not None:
                            # answered by the user's click, so it gets no result here
                            card_call, card_view = tool_call, view
                            continue
                        result = {"error": card_error}
                    else:
                        result = await _run_server_tool(tool_name_to_function_dict, tool_call)
                        if function_name == SAVE_ANSWER_TOOL_NAME and isinstance(result, dict) and "saved" in result:
                            answered_card_ids.add(result.get("card_id"))
                            answered_in_chat = True

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

                if card_call is not None:
                    yield encoder.encode(
                        ToolCallChunkEvent(
                            tool_call_id=card_call["id"],
                            tool_call_name=SHOW_CARD_TOOL_NAME,
                            parent_message_id=message_id,
                            delta=json.dumps(card_view, default=str),
                        )
                    )
                    break
                if answered_in_chat:
                    # the reply answered the question asked in the chat, so the model moves on to the next one
                    offered_card, card_instructions, offered_inputs = await _next_form_card(
                        db, user_row, answered_card_ids
                    )
                    messages[0] = _prepare_chat_messages([], card_instructions)[0]
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
    return {"message": "Started new chat session"}


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

    return {"message": "Conversation deleted"}
