import pytest

from app.database import DEFAULT_BOARD
from app.models import BoardPayload
from app.openrouter import (
    DEFAULT_OPENROUTER_MODEL,
    OpenRouterConfigError,
    build_chat_messages,
    build_openrouter_payload,
    build_structured_chat_payload,
    get_openrouter_model,
    parse_structured_chat_response,
)


def test_build_openrouter_payload_uses_expected_shape() -> None:
    payload = build_openrouter_payload("What is 2+2?", "openai/gpt-oss-120b")

    assert payload == {
        "model": "openai/gpt-oss-120b",
        "messages": [{"role": "user", "content": "What is 2+2?"}],
        "temperature": 0,
    }


def test_get_openrouter_model_defaults_when_env_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OPENROUTER_MODEL", raising=False)

    assert get_openrouter_model() == DEFAULT_OPENROUTER_MODEL


def test_build_structured_chat_payload_includes_board_history_and_schema() -> None:
    board = BoardPayload.model_validate(DEFAULT_BOARD)
    payload = build_structured_chat_payload(
        board=board,
        history=[{"role": "assistant", "content": "Previous reply"}],
        user_message="Move card 1 to Review",
        model="openai/gpt-oss-120b",
    )

    assert payload["model"] == "openai/gpt-oss-120b"
    assert payload["messages"][-1] == {
        "role": "user",
        "content": "Move card 1 to Review",
    }
    assert payload["response_format"]["type"] == "json_schema"
    assert payload["response_format"]["json_schema"]["strict"] is True
    assert payload["plugins"] == [{"id": "response-healing"}]


def test_parse_structured_chat_response_accepts_reply_only_shape() -> None:
    parsed = parse_structured_chat_response('{"reply":"Done.","board":null}')

    assert parsed.reply == "Done."
    assert parsed.board is None


def test_parse_structured_chat_response_rejects_invalid_json() -> None:
    with pytest.raises(OpenRouterConfigError):
        parse_structured_chat_response('{"reply": 12, "board": null}')


def test_ai_test_route_requires_key(monkeypatch: pytest.MonkeyPatch, client) -> None:
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    client.post(
        "/api/login",
        json={"username": "user", "password": "password"},
    )

    response = client.post("/api/ai/test")

    assert response.status_code == 500
    assert response.json() == {
        "detail": "OPENROUTER_API_KEY is not configured."
    }
