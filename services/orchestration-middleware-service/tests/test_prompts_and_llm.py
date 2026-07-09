from src.prompts import generate_tool_usage_prompt
from src.routes.llm import SYSTEM_PROMPT


def test_generate_tool_usage_prompt_contains_mandatory_schema_loop_directive():
    prompt = generate_tool_usage_prompt()
    assert "Mandatory Schema Verification Loop" in prompt
    assert "get_user_table_schema" in prompt


def test_generate_tool_usage_prompt_contains_required_directives():
    prompt = generate_tool_usage_prompt()

    assert "update_user_data" in prompt
    assert "Crucial Data Persistence Rules" in prompt
    assert "Strictly No Placeholders/Excuses" in prompt


def test_generate_tool_usage_prompt_does_not_contain_hardcoded_soko_values():
    prompt = generate_tool_usage_prompt()

    assert "Helmut" not in prompt
    assert "€430" not in prompt
    assert "430" not in prompt
    assert "Platz der Luftbrücke" not in prompt


def test_prepare_chat_messages_injection():
    from src.routes.llm import _prepare_chat_messages

    context = [{"role": "user", "content": "Hello"}]
    messages = _prepare_chat_messages(context)

    assert len(messages) == 2
    assert messages[0]["role"] == "system"
    assert messages[0]["content"].startswith(SYSTEM_PROMPT)
    assert "Crucial Data Persistence Rules" in messages[0]["content"]
    assert messages[1]["role"] == "user"
    assert messages[1]["content"] == "Hello"
