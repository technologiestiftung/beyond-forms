import io
from contextlib import contextmanager
import re
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
from src.tools import AVAILABLE_TOOLS

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
    assert response.json() == {"status": "healthy"}


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
    response = client.post(
        "/upload",
        files={"file": ("test.txt", file, "text/plain")},
        data={"application_id": str(uuid.uuid4())},
    )

    assert response.status_code == 400
    assert "Invalid file type" in response.json()["detail"]


@patch("google.cloud.storage.Client")
def test_upload_file_too_large(mock_storage_client, mock_db, mock_conv_service):
    large_size = 50 * 1024 * 1024 + 1
    file = io.BytesIO(b"x" * large_size)

    response = client.post(
        "/upload",
        files={"file": ("test.png", file, "image/png")},
        data={"application_id": str(uuid.uuid4())},
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
        data={"application_id": str(uuid.uuid4())},
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
        data={"application_id": str(uuid.uuid4())},
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


def _run_input(user_text: str) -> dict:
    return {
        "threadId": "client-thread",
        "runId": "run-1",
        "state": {},
        "messages": [{"id": "msg-1", "role": "user", "content": user_text}],
        "tools": [],
        "context": [],
        "forwardedProps": {},
    }


def _stream(*deltas):
    async def gen():
        for delta in deltas:
            yield SimpleNamespace(choices=[SimpleNamespace(delta=delta)])

    return gen()


def _text_stream(*parts: str):
    return _stream(*(SimpleNamespace(content=part, tool_calls=None) for part in parts))


def _tool_call_stream(name: str, args: str = "{}", call_id: str = "call_1"):
    # arguments arrive split across chunks, as Gemini streams them
    half = len(args) // 2
    return _stream(
        SimpleNamespace(
            content=None,
            tool_calls=[
                SimpleNamespace(index=0, id=call_id, function=SimpleNamespace(name=name, arguments=args[:half]))
            ],
        ),
        SimpleNamespace(
            content=None,
            tool_calls=[SimpleNamespace(index=0, id=None, function=SimpleNamespace(name=None, arguments=args[half:]))],
        ),
    )


def _events(response) -> list[dict]:
    return [json.loads(line[len("data: ") :]) for line in response.text.splitlines() if line.startswith("data: ")]


def _streamed_text(events: list[dict]) -> str:
    return "".join(e["delta"] for e in events if e["type"] == "TEXT_MESSAGE_CHUNK")


@pytest.fixture
def mock_conv(mock_conv_service):
    conv = MagicMock()
    conv.id = uuid.uuid4()
    mock_conv_service.get_or_create_in_progress_conversation.return_value = conv
    mock_conv_service.get_conversation_context.return_value = []
    return conv


@patch("src.routes.llm.acompletion", new_callable=AsyncMock)
def test_chat_stream_no_tool_call(mock_completion, mock_conv_service, mock_conv):
    mock_completion.return_value = _text_stream("Hello! ", "How can I help you?")

    response = client.post("/chat/stream", json=_run_input("Hello"))

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    events = _events(response)
    assert events[0] == {"type": "RUN_STARTED", "threadId": str(mock_conv.id), "runId": "run-1"}
    assert events[-1]["type"] == "RUN_FINISHED"
    assert events[-1]["runId"] == "run-1"
    assert _streamed_text(events) == "Hello! How can I help you?"
    assert mock_completion.call_count == 1

    saved = [c.kwargs for c in mock_conv_service.add_message.call_args_list]
    assert saved[0]["content"] == "Hello"
    assert saved[-1]["content"] == "Hello! How can I help you?"


@patch("src.routes.llm.check_progress_status", new_callable=AsyncMock)
@patch("src.routes.llm.acompletion", new_callable=AsyncMock)
def test_chat_stream_with_tool_call(mock_completion, mock_check_progress, mock_conv_service, mock_conv):
    mock_check_progress.return_value = {"progress_percentage": 50, "missing_fields": ["name", "email"]}
    mock_completion.side_effect = [
        _tool_call_stream("check_progress_status", call_id="call_123"),
        _text_stream("You are 50% done."),
    ]

    response = client.post("/chat/stream", json=_run_input("What's my progress?"))

    assert response.status_code == 200
    events = _events(response)
    assert _streamed_text(events) == "You are 50% done."
    assert events[-1]["type"] == "RUN_FINISHED"
    mock_check_progress.assert_awaited_once()
    assert mock_completion.call_count == 2

    tool_message = mock_completion.call_args_list[1].kwargs["messages"][-1]
    assert tool_message["role"] == "tool"
    assert tool_message["tool_call_id"] == "call_123"
    assert json.loads(tool_message["content"]) == mock_check_progress.return_value


@patch("src.routes.llm.acompletion", new_callable=AsyncMock)
def test_chat_stream_with_update_user_data_tool_call(mock_completion, mock_conv_service, mock_conv, mock_db):
    args = json.dumps({"updates": {"rent_total": 550.0}})
    mock_completion.side_effect = [
        _tool_call_stream("update_user_data", args, call_id="call_456"),
        _text_stream("I've updated your rent information."),
    ]
    app.dependency_overrides[get_user_service] = lambda: MagicMock()

    with patch("src.routes.llm.update_user_data", new_callable=AsyncMock) as mock_update_user_data:
        mock_update_user_data.return_value = {"status": "success", "message": "User data updated successfully"}
        response = client.post("/chat/stream", json=_run_input("My rent is 550"))

    assert response.status_code == 200
    assert _streamed_text(_events(response)) == "I've updated your rent information."
    mock_update_user_data.assert_awaited_once()
    assert mock_update_user_data.call_args.kwargs["updates"] == {"rent_total": 550.0}


@patch("src.routes.llm.acompletion", new_callable=AsyncMock)
def test_chat_stream_with_get_user_data_tool_call(mock_completion, mock_conv_service, mock_conv, mock_db):
    mock_completion.side_effect = [
        _tool_call_stream("get_user_data", call_id="call_get_data"),
        _text_stream("You have Anna as your first name on file."),
    ]
    app.dependency_overrides[get_user_service] = lambda: MagicMock()

    with patch("src.routes.llm.get_user_data", new_callable=AsyncMock) as mock_get_user_data:
        mock_get_user_data.return_value = {"first_name": "Anna"}
        response = client.post("/chat/stream", json=_run_input("What do you already know about me?"))

    assert response.status_code == 200
    assert _streamed_text(_events(response)) == "You have Anna as your first name on file."
    mock_get_user_data.assert_awaited_once()

    tool_message = mock_completion.call_args_list[1].kwargs["messages"][-1]
    assert json.loads(tool_message["content"]) == {"first_name": "Anna"}


@patch("src.routes.llm.acompletion", new_callable=AsyncMock)
def test_chat_stream_multi_round_tool_calls(mock_completion, mock_conv_service, mock_conv, mock_db):
    mock_completion.side_effect = [
        _tool_call_stream("get_user_table_schema", call_id="call_001"),
        _tool_call_stream("update_user_data", json.dumps({"updates": {"rent_total": 550.0}}), call_id="call_002"),
        _text_stream("I've updated your rent to 550."),
    ]
    app.dependency_overrides[get_user_service] = lambda: MagicMock()

    with patch("src.routes.llm.update_user_data", new_callable=AsyncMock) as mock_update_user_data:
        mock_update_user_data.return_value = {"status": "success", "message": "User data updated successfully"}
        response = client.post("/chat/stream", json=_run_input("My rent is 550"))

    assert response.status_code == 200
    assert _streamed_text(_events(response)) == "I've updated your rent to 550."
    assert mock_completion.call_count == 3
    mock_update_user_data.assert_awaited_once()

    stored_tool_calls = [
        c.kwargs["metadata"]["tool_calls"][0]["function"]["name"]
        for c in mock_conv_service.add_message.call_args_list
        if c.kwargs.get("metadata", {}).get("tool_calls")
    ]
    assert stored_tool_calls == ["get_user_table_schema", "update_user_data"]


def test_chat_stream_unauthenticated():
    async def raise_401():
        raise HTTPException(status_code=401, detail="Missing authentication token")

    app.dependency_overrides[require_authenticated_user] = raise_401

    response = client.post("/chat/stream", json=_run_input("Hello"))
    assert response.status_code == 401


def test_chat_stream_rejects_empty_user_message(mock_conv_service, mock_conv):
    response = client.post("/chat/stream", json=_run_input("   "))
    assert response.status_code == 422


@patch("src.routes.llm.acompletion", new_callable=AsyncMock)
def test_chat_stream_last_round_forces_text(mock_completion, mock_conv_service, mock_conv):
    max_rounds = 5
    mock_completion.side_effect = [
        _tool_call_stream("check_progress_status", call_id=f"call_{i}") for i in range(max_rounds - 1)
    ] + [_text_stream("Done after max rounds.")]

    with patch("src.routes.llm.check_progress_status", new_callable=AsyncMock) as mock_check:
        mock_check.return_value = {"progress_percentage": 50, "missing_fields": []}
        response = client.post("/chat/stream", json=_run_input("Keep checking"))

    assert response.status_code == 200
    assert _streamed_text(_events(response)) == "Done after max rounds."
    assert mock_completion.call_count == max_rounds
    tool_choices = [c.kwargs["tool_choice"] for c in mock_completion.call_args_list]
    assert tool_choices == ["auto"] * (max_rounds - 1) + ["none"]


@patch("src.routes.llm.acompletion", new_callable=AsyncMock)
def test_chat_stream_finishes_when_model_ignores_tool_choice_none(mock_completion, mock_conv_service, mock_conv):
    mock_completion.side_effect = [_tool_call_stream("check_progress_status", call_id=f"call_{i}") for i in range(5)]

    with patch("src.routes.llm.check_progress_status", new_callable=AsyncMock) as mock_check:
        mock_check.return_value = {"progress_percentage": 50, "missing_fields": []}
        response = client.post("/chat/stream", json=_run_input("Keep checking"))

    assert mock_completion.call_count == 5
    assert _events(response)[-1]["type"] == "RUN_FINISHED"


@patch("src.routes.llm.acompletion", new_callable=AsyncMock)
def test_chat_stream_error_hides_exception_details(mock_completion, mock_conv_service, mock_conv):
    async def broken():
        yield SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content="Hal", tool_calls=None))])
        raise RuntimeError("vertex credentials expired")

    mock_completion.return_value = broken()

    response = client.post("/chat/stream", json=_run_input("Hello"))

    events = _events(response)
    assert events[-1]["type"] == "RUN_ERROR"
    assert "vertex" not in events[-1]["message"]
    assert not any(e["type"] == "RUN_FINISHED" for e in events)


@patch("src.routes.llm.acompletion", new_callable=AsyncMock)
def test_chat_stream_reports_failed_llm_call(mock_completion, mock_conv_service, mock_conv):
    mock_completion.side_effect = RuntimeError("Refresh token has expired")

    response = client.post("/chat/stream", json=_run_input("Hello"))

    events = _events(response)
    assert [e["type"] for e in events] == ["RUN_STARTED", "RUN_ERROR"]
    assert "token" not in events[-1]["message"]


FORM = "antrag_grundsicherung_im_alter"


def _field(var: str, meaning: str, options: dict | None = None) -> dict:
    return {
        "field_id": var,
        "var": var,
        "type": "string",
        "meaning": meaning,
        "options": options or {},
        "optional": False,
    }


def _group(id_: str, answer_type: str, fields: list) -> dict:
    return {
        "id": id_,
        "page": 1,
        "section": "I. Antragsteller/in",
        "person": "Personenziffer 1",
        "topic": id_,
        "hint": None,
        "answer_type": answer_type,
        "ask_if": "true",
        "required": True,
        "fields": fields,
        "documents": [],
    }


GENDER = _group("p1_gender", "single_choice", [_field("p1_gender", "Geschlecht", {"0": "männlich", "1": "weiblich"})])
CARE = _group("p2_care", "yes_no", [_field("p2_care", "pflegebedürftig", {"0": "Nein", "1": "Ja"})])
BIRTHPLACE = _group("p1_birthplace", "text", [_field("p1_birthplace", "Geburtsort")])
GENDER_CARD = f"form:{FORM}:p1_gender"
CARE_CARD = f"form:{FORM}:p2_care"
BIRTHPLACE_QUESTION = f"form:{FORM}:p1_birthplace"


@pytest.fixture
def open_questions():
    """The groups the form rules leave open for a user with a profile; the gender choice unless a test says otherwise."""
    user = DbUser()

    @contextmanager
    def worker_session(_user_id):
        yield MagicMock(), user

    with (
        patch("src.routes.llm._load_user_row", return_value=user),
        patch("src.routes.llm._warm_form_assets", new_callable=AsyncMock),
        patch("src.routes.llm._worker_session", worker_session),
        patch("src.routes.llm._open_form_groups", new_callable=AsyncMock) as groups,
    ):
        groups.return_value = [(FORM, GENDER)]
        yield groups


def _card_args(card_id: str = GENDER_CARD, **overrides) -> dict:
    args = {
        "card_id": card_id,
        "question": "Welches Geschlecht haben Sie?",
        "labels": {"answer": "Geschlecht"},
        "option_labels": {"answer": {"0": "männlich", "1": "weiblich"}},
    }
    return {**args, **overrides}


def _card_stream(args: dict, call_id: str = "call_card", lead_in: str = "Fangen wir an:"):
    return _stream(
        SimpleNamespace(content=lead_in, tool_calls=None),
        SimpleNamespace(
            content=None,
            tool_calls=[
                SimpleNamespace(
                    index=0, id=call_id, function=SimpleNamespace(name="show_card", arguments=json.dumps(args))
                )
            ],
        ),
    )


def _stored(mock_conv_service, role: str) -> list[dict]:
    return [c.kwargs for c in mock_conv_service.add_message.call_args_list if c.kwargs["role"].value == role]


def _offered_card(mock_completion, call: int = 0):
    """The card the system prompt names as next."""
    system_prompt = mock_completion.call_args_list[call].kwargs["messages"][0]["content"]
    match = re.search(r'Next card: card_id "([^"]+)"', system_prompt)
    return match and match.group(1)


def test_show_card_is_one_of_the_available_tools():
    assert "show_card" in {tool["function"]["name"] for tool in AVAILABLE_TOOLS}


@patch("src.routes.llm.acompletion", new_callable=AsyncMock)
def test_chat_stream_show_card_sends_the_built_card_and_pauses(
    mock_completion, mock_conv_service, mock_conv, open_questions
):
    mock_completion.return_value = _card_stream(_card_args(), call_id="call_card_1")

    response = client.post("/chat/stream", json=_run_input("Ich möchte meinen Grundsicherungsantrag ausfüllen"))

    assert _offered_card(mock_completion) == GENDER_CARD
    events = _events(response)
    assert [e["type"] for e in events] == ["RUN_STARTED", "TEXT_MESSAGE_CHUNK", "TOOL_CALL_CHUNK", "RUN_FINISHED"]
    card = events[2]
    assert card["toolCallId"] == "call_card_1"
    assert card["toolCallName"] == "show_card"
    assert card["parentMessageId"] == events[1]["messageId"]
    assert json.loads(card["delta"]) == {
        "card_id": GENDER_CARD,
        "question": "Welches Geschlecht haben Sie?",
        "inputs": [
            {
                "field": "answer",
                "kind": "choice",
                "label": "Geschlecht",
                "options": [{"value": "0", "label": "männlich"}, {"value": "1", "label": "weiblich"}],
            }
        ],
    }
    assert mock_completion.call_count == 1

    assistant = _stored(mock_conv_service, "assistant")[-1]
    assert assistant["content"] == "Fangen wir an:"
    assert assistant["metadata"]["tool_calls"][0]["id"] == "call_card_1"
    assert _stored(mock_conv_service, "tool") == []


@patch("src.routes.llm.acompletion", new_callable=AsyncMock)
def test_chat_stream_offers_no_card_without_a_profile(mock_completion, mock_conv_service, mock_conv):
    mock_completion.return_value = _text_stream("Hallo!")

    with patch("src.routes.llm._load_user_row", return_value=None):
        client.post("/chat/stream", json=_run_input("Hallo"))

    assert _offered_card(mock_completion) is None


@patch("src.routes.llm.acompletion", new_callable=AsyncMock)
def test_chat_stream_offers_no_card_when_the_rules_cannot_be_evaluated(
    mock_completion, mock_conv_service, mock_conv, open_questions
):
    open_questions.side_effect = RuntimeError("mapping missing")
    mock_completion.return_value = _text_stream("Hallo!")

    client.post("/chat/stream", json=_run_input("Hallo"))

    system_prompt = mock_completion.call_args.kwargs["messages"][0]["content"]
    assert _offered_card(mock_completion) is None
    assert "is answered" not in system_prompt


@patch("src.routes.llm.acompletion", new_callable=AsyncMock)
def test_chat_stream_does_not_call_the_application_complete_without_rules(
    mock_completion, mock_conv_service, mock_conv, open_questions
):
    open_questions.return_value = None
    mock_completion.return_value = _text_stream("Hallo!")

    client.post("/chat/stream", json=_run_input("Weiter"))

    assert "is answered" not in mock_completion.call_args.kwargs["messages"][0]["content"]


@patch("src.routes.llm.acompletion", new_callable=AsyncMock)
def test_chat_stream_tells_the_model_when_the_application_is_complete(
    mock_completion, mock_conv_service, mock_conv, open_questions
):
    open_questions.return_value = []
    mock_completion.return_value = _text_stream("Alles ist ausgefüllt.")

    client.post("/chat/stream", json=_run_input("Weiter"))

    system_prompt = mock_completion.call_args.kwargs["messages"][0]["content"]
    assert "Every question of the user's Grundsicherungsantrag is answered" in system_prompt
    assert _offered_card(mock_completion) is None


@patch("src.routes.llm.acompletion", new_callable=AsyncMock)
def test_chat_stream_runs_server_tools_next_to_a_card(
    mock_completion, mock_conv_service, mock_conv, mock_db, open_questions
):
    mock_completion.return_value = _stream(
        SimpleNamespace(
            content=None,
            tool_calls=[
                SimpleNamespace(
                    index=0, id="call_data", function=SimpleNamespace(name="get_user_data", arguments="{}")
                ),
                SimpleNamespace(
                    index=1,
                    id="call_card",
                    function=SimpleNamespace(name="show_card", arguments=json.dumps(_card_args())),
                ),
            ],
        )
    )

    with patch("src.routes.llm.get_user_data", new_callable=AsyncMock) as mock_get_user_data:
        mock_get_user_data.return_value = {"first_name": None}
        response = client.post("/chat/stream", json=_run_input("Weiter"))

    assert [e["type"] for e in _events(response)][-2:] == ["TOOL_CALL_CHUNK", "RUN_FINISHED"]
    assert [t["metadata"]["tool_call_id"] for t in _stored(mock_conv_service, "tool")] == ["call_data"]
    assert mock_completion.call_count == 1


@pytest.mark.parametrize("card_id", [f"form:{FORM}:p9_unknown", CARE_CARD], ids=["unknown", "not the next card"])
@patch("src.routes.llm.acompletion", new_callable=AsyncMock)
def test_chat_stream_rejects_cards_that_are_not_offered(
    mock_completion, card_id, mock_conv_service, mock_conv, open_questions
):
    mock_completion.side_effect = [_card_stream(_card_args(card_id)), _text_stream("Erzählen Sie mir davon.")]

    response = client.post("/chat/stream", json=_run_input("Hallo"))

    events = _events(response)
    assert not any(e["type"] == "TOOL_CALL_CHUNK" for e in events)
    assert events[-1]["type"] == "RUN_FINISHED"
    assert mock_completion.call_count == 2
    tool_result = json.loads(_stored(mock_conv_service, "tool")[0]["content"])
    assert tool_result == {"error": f"Unknown card_id: {card_id}"}


@patch("src.routes.llm.acompletion", new_callable=AsyncMock)
def test_chat_stream_lets_the_model_fix_missing_card_texts(
    mock_completion, mock_conv_service, mock_conv, open_questions
):
    incomplete = _card_args(option_labels={"answer": {"0": "männlich"}})
    mock_completion.side_effect = [
        _card_stream(incomplete, call_id="call_1"),
        _card_stream(_card_args(), call_id="call_2"),
    ]

    response = client.post("/chat/stream", json=_run_input("Los geht's"))

    error = json.loads(_stored(mock_conv_service, "tool")[0]["content"])["error"]
    assert error.startswith("Fix the card texts and call show_card again")
    assert "option_labels.answer.1" in error
    card_events = [e for e in _events(response) if e["type"] == "TOOL_CALL_CHUNK"]
    assert [e["toolCallId"] for e in card_events] == ["call_2"]


@patch("src.routes.llm.acompletion", new_callable=AsyncMock)
def test_chat_stream_closes_a_card_the_user_did_not_click(mock_completion, mock_conv_service, mock_conv):
    mock_conv_service.get_conversation_context.return_value = [
        {"role": "user", "content": "Wohnkosten"},
        {
            "role": "assistant",
            "content": "Kurz zu Ihrer Wohnung:",
            "tool_calls": [{"id": "call_open", "function": {"name": "show_card", "arguments": "{}"}}],
        },
    ]
    mock_completion.return_value = _text_stream("Alles klar.")

    client.post("/chat/stream", json=_run_input("Die Miete ist 500 Euro"))

    stored = [c.kwargs for c in mock_conv_service.add_message.call_args_list]
    assert stored[0]["role"].value == "tool"
    assert stored[0]["metadata"] == {"tool_call_id": "call_open", "name": "show_card"}
    assert json.loads(stored[0]["content"]) == {"answered_in_text": True}
    assert stored[1]["role"].value == "user"


def _card_answer_input(tool_call_id: str, values: object) -> dict:
    body = _run_input("unused")
    body["messages"] = [
        {"id": "msg-2", "role": "tool", "toolCallId": tool_call_id, "content": json.dumps({"values": values})}
    ]
    return body


_OPEN_CARD_CONTEXT = [
    {"role": "user", "content": "Antrag"},
    {
        "role": "assistant",
        "content": "Fangen wir an:",
        "tool_calls": [{"id": "call_open", "function": {"name": "show_card", "arguments": json.dumps(_card_args())}}],
    },
]


@patch("src.routes.llm._save_form_card_answer", new_callable=AsyncMock)
@patch("src.routes.llm.acompletion", new_callable=AsyncMock)
def test_chat_stream_saves_a_card_answer_and_continues(
    mock_completion, mock_save, mock_conv_service, mock_conv, open_questions
):
    mock_conv_service.get_conversation_context.return_value = _OPEN_CARD_CONTEXT
    open_questions.return_value = [(FORM, CARE)]
    mock_completion.return_value = _text_stream("Danke.")

    response = client.post("/chat/stream", json=_card_answer_input("call_open", {"answer": "1"}))

    assert response.status_code == 200
    assert mock_save.call_args.args[3:] == (GENDER_CARD, {"answer": "1"})
    assert _streamed_text(_events(response)) == "Danke."
    stored = [c.kwargs for c in mock_conv_service.add_message.call_args_list]
    assert stored[0]["role"].value == "tool"
    assert json.loads(stored[0]["content"]) == {"card_id": GENDER_CARD, "saved": {"answer": "1"}}
    assert stored[0]["metadata"] == {"tool_call_id": "call_open", "name": "show_card"}
    assert not any(s["role"].value == "user" for s in stored)
    assert _offered_card(mock_completion) == CARE_CARD


@patch("src.routes.llm.acompletion", new_callable=AsyncMock)
def test_chat_stream_offers_an_answered_card_again_while_it_stays_open(
    mock_completion, mock_conv_service, mock_conv, open_questions
):
    mock_conv_service.get_conversation_context.return_value = [
        {"role": "tool", "name": "show_card", "content": json.dumps({"card_id": GENDER_CARD, "saved": {}})}
    ]
    mock_completion.return_value = _text_stream("Weiter geht's.")

    client.post("/chat/stream", json=_run_input("Weiter"))

    assert _offered_card(mock_completion) == GENDER_CARD
    assert "not complete yet" in mock_completion.call_args.kwargs["messages"][0]["content"]


@pytest.mark.parametrize(
    "values",
    [{}, {"answer": "1", "iban": "DE00"}, {"answer": "7"}, "1"],
    ids=["missing field", "foreign field", "unknown option", "no object"],
)
def test_chat_stream_rejects_an_invalid_card_answer(values, mock_conv_service, mock_conv, open_questions):
    mock_conv_service.get_conversation_context.return_value = _OPEN_CARD_CONTEXT

    response = client.post("/chat/stream", json=_card_answer_input("call_open", values))

    assert response.status_code == 422
    mock_conv_service.add_message.assert_not_called()


@pytest.mark.parametrize(
    "context",
    [
        _OPEN_CARD_CONTEXT,
        _OPEN_CARD_CONTEXT + [{"role": "tool", "tool_call_id": "call_open", "content": "{}"}],
    ],
    ids=["other card", "already answered"],
)
def test_chat_stream_rejects_an_answer_without_its_open_card(context, mock_conv_service, mock_conv):
    mock_conv_service.get_conversation_context.return_value = context
    tool_call_id = "call_other" if len(context) == 2 else "call_open"

    response = client.post("/chat/stream", json=_card_answer_input(tool_call_id, {"answer": "1"}))

    assert response.status_code == 409
    mock_conv_service.add_message.assert_not_called()


@patch("src.routes.llm.save_answer", new_callable=AsyncMock)
@patch("src.routes.llm.acompletion", new_callable=AsyncMock)
def test_chat_stream_moves_on_after_a_question_answered_in_the_chat(
    mock_completion, mock_save_answer, mock_conv_service, mock_conv, open_questions
):
    open_questions.side_effect = [[(FORM, BIRTHPLACE)], [(FORM, GENDER)]]
    mock_save_answer.return_value = {"card_id": BIRTHPLACE_QUESTION, "saved": {"p1_birthplace": "Berlin"}}
    streams = iter(
        [
            _tool_call_stream(
                "save_answer", json.dumps({"card_id": BIRTHPLACE_QUESTION, "values": {"p1_birthplace": "Berlin"}})
            ),
            _card_stream(_card_args(), call_id="call_card_2"),
        ]
    )
    # the messages list is reused across rounds, so each round's system prompt is read when it is sent
    system_prompts = []

    async def complete(**kwargs):
        system_prompts.append(kwargs["messages"][0]["content"])
        return next(streams)

    mock_completion.side_effect = complete

    response = client.post("/chat/stream", json=_run_input("In Berlin"))

    assert f'Next question: card_id "{BIRTHPLACE_QUESTION}"' in system_prompts[0]
    assert f'Next card: card_id "{GENDER_CARD}"' in system_prompts[1]
    assert [e["type"] for e in _events(response)][-2:] == ["TOOL_CALL_CHUNK", "RUN_FINISHED"]


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
    assert data == {"message": "Conversation deleted"}
    mock_conv_service.delete_conversation.assert_called_once_with(conversation_id)
