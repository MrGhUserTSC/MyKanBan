from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

import httpx
from pydantic import ValidationError

from app.models import AiChatStructuredResponse, BoardPayload

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_OPENROUTER_MODEL = "openai/gpt-oss-120b"
OPENROUTER_TIMEOUT_SECONDS = 90.0


class OpenRouterConfigError(RuntimeError):
    pass


@dataclass(frozen=True)
class OpenRouterResult:
    content: str
    model: str
    raw_response: dict[str, Any]


def get_openrouter_api_key() -> str:
    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        raise OpenRouterConfigError("OPENROUTER_API_KEY is not configured.")
    return api_key


def get_openrouter_model() -> str:
    return os.getenv("OPENROUTER_MODEL", DEFAULT_OPENROUTER_MODEL).strip() or DEFAULT_OPENROUTER_MODEL


def build_openrouter_payload(prompt: str, model: str) -> dict[str, Any]:
    return {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": prompt,
            }
        ],
        "temperature": 0,
    }


def build_chat_messages(
    board: BoardPayload,
    history: list[dict[str, str]],
    user_message: str,
) -> list[dict[str, str]]:
    system_message = {
        "role": "system",
        "content": (
            "You are an assistant for a project management kanban board. "
            "You must answer the user and may optionally return an updated full board. "
            "Only change the board when the user's request clearly calls for a board update. "
            "When you return a board update, you must preserve every existing column, card, id, "
            "and ordering unless the user explicitly asks to change that specific item. "
            "Do not drop unrelated columns or cards. "
            "Do not rename ids. "
            "Each card has a priority (low, medium, or high) and an optional dueDate (YYYY-MM-DD or empty). "
            "Preserve each card's existing priority and dueDate unless the user asks to change them. "
            "Do not create a smaller replacement board unless the user explicitly asks to remove those items."
        ),
    }
    board_message = {
        "role": "system",
        "content": (
            "Current board JSON:\n"
            f"{board.model_dump_json()}"
        ),
    }

    messages = [system_message, board_message]
    messages.extend(history)
    messages.append({"role": "user", "content": user_message})
    return messages


def build_structured_chat_payload(
    board: BoardPayload,
    history: list[dict[str, str]],
    user_message: str,
    model: str,
) -> dict[str, Any]:
    return {
        "model": model,
        "messages": build_chat_messages(board, history, user_message),
        "temperature": 0,
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "kanban_ai_response",
                "strict": True,
                "schema": {
                    "type": "object",
                    "properties": {
                        "reply": {
                            "type": "string",
                            "description": "Assistant reply shown to the user. Briefly explain any board changes you made.",
                        },
                        "board": {
                            "anyOf": [
                                {
                                    "type": "object",
                                    "properties": {
                                        "columns": {
                                            "type": "array",
                                            "items": {
                                                "type": "object",
                                                "properties": {
                                                    "id": {"type": "string"},
                                                    "title": {"type": "string"},
                                                    "cardIds": {
                                                        "type": "array",
                                                        "items": {"type": "string"},
                                                    },
                                                },
                                                "required": ["id", "title", "cardIds"],
                                                "additionalProperties": False,
                                            },
                                        },
                                        "cards": {
                                            "type": "object",
                                            "additionalProperties": {
                                                "type": "object",
                                                "properties": {
                                                    "id": {"type": "string"},
                                                    "title": {"type": "string"},
                                                    "details": {"type": "string"},
                                                    "priority": {
                                                        "type": "string",
                                                        "enum": ["low", "medium", "high"],
                                                    },
                                                    "dueDate": {
                                                        "type": "string",
                                                        "description": "Due date as YYYY-MM-DD, or an empty string when there is none.",
                                                    },
                                                },
                                                "required": [
                                                    "id",
                                                    "title",
                                                    "details",
                                                    "priority",
                                                    "dueDate",
                                                ],
                                                "additionalProperties": False,
                                            },
                                        },
                                    },
                                    "required": ["columns", "cards"],
                                    "additionalProperties": False,
                                },
                                {"type": "null"},
                            ],
                            "description": (
                                "Optional full replacement board state. "
                                "Use null when no board change is needed. "
                                "If you provide a board, it must begin from the current board and preserve all unrelated columns, cards, ids, and ordering."
                            ),
                        },
                    },
                    "required": ["reply", "board"],
                    "additionalProperties": False,
                },
            },
        },
        "plugins": [{"id": "response-healing"}],
    }


def parse_structured_chat_response(content: str) -> AiChatStructuredResponse:
    try:
        return AiChatStructuredResponse.model_validate_json(content)
    except ValidationError as error:
        raise OpenRouterConfigError(f"Structured response parsing failed: {error}") from error


async def request_openrouter_chat(
    prompt: str,
    client: httpx.AsyncClient | None = None,
) -> OpenRouterResult:
    model = get_openrouter_model()
    api_key = get_openrouter_api_key()
    payload = build_openrouter_payload(prompt, model)
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    async def send(request_client: httpx.AsyncClient) -> OpenRouterResult:
        response = await request_client.post(
            OPENROUTER_URL,
            headers=headers,
            json=payload,
        )
        response.raise_for_status()
        body = response.json()
        content = body["choices"][0]["message"]["content"]
        return OpenRouterResult(
            content=content,
            model=body.get("model", model),
            raw_response=body,
        )

    if client is not None:
        return await send(client)

    async with httpx.AsyncClient(timeout=OPENROUTER_TIMEOUT_SECONDS) as async_client:
        return await send(async_client)


async def request_structured_openrouter_chat(
    board: BoardPayload,
    history: list[dict[str, str]],
    user_message: str,
    client: httpx.AsyncClient | None = None,
) -> tuple[OpenRouterResult, AiChatStructuredResponse]:
    model = get_openrouter_model()
    api_key = get_openrouter_api_key()
    payload = build_structured_chat_payload(board, history, user_message, model)
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    async def send(request_client: httpx.AsyncClient) -> tuple[OpenRouterResult, AiChatStructuredResponse]:
        response = await request_client.post(
            OPENROUTER_URL,
            headers=headers,
            json=payload,
        )
        response.raise_for_status()
        body = response.json()
        content = body["choices"][0]["message"]["content"]
        result = OpenRouterResult(
            content=content,
            model=body.get("model", model),
            raw_response=body,
        )
        parsed = parse_structured_chat_response(content)
        return result, parsed

    if client is not None:
        return await send(client)

    async with httpx.AsyncClient(timeout=OPENROUTER_TIMEOUT_SECONDS) as async_client:
        return await send(async_client)
