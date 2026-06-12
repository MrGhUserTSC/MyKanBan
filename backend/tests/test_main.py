import sqlite3
from pathlib import Path
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.database import DEFAULT_BOARD, connect_database
from app.main import SESSION_COOKIE_NAME
from app.models import BoardPayload
from app.openrouter import OpenRouterConfigError, OpenRouterResult


def test_healthcheck(client: TestClient) -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "pm-backend"}


def test_index_serves_html(client: TestClient) -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "<html" in response.text.lower()


def test_database_is_created_and_seeded(app) -> None:
    db_path = Path(app.state.db_path)

    assert db_path.exists()

    with sqlite3.connect(db_path) as connection:
        user_row = connection.execute(
            "SELECT username FROM users WHERE username = ?",
            ("user",),
        ).fetchone()
        board_row = connection.execute(
            """
            SELECT boards.board_json
            FROM boards
            JOIN users ON users.id = boards.user_id
            WHERE users.username = ?
            """,
            ("user",),
        ).fetchone()

    assert user_row is not None
    assert board_row is not None


def test_login_sets_backend_session_cookie(client: TestClient) -> None:
    response = client.post(
        "/api/login",
        json={"username": "user", "password": "password"},
    )

    assert response.status_code == 200
    assert response.json() == {"username": "user"}
    assert SESSION_COOKIE_NAME in response.cookies


def test_login_rejects_invalid_credentials(client: TestClient) -> None:
    response = client.post(
        "/api/login",
        json={"username": "user", "password": "wrong"},
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid credentials."}


def test_session_endpoint_requires_login(client: TestClient) -> None:
    response = client.get("/api/session")

    assert response.status_code == 401
    assert response.json() == {"detail": "Authentication required."}


def login_and_return_cookie(client: TestClient) -> str:
    response = client.post(
        "/api/login",
        json={"username": "user", "password": "password"},
    )
    client.cookies.set(SESSION_COOKIE_NAME, response.cookies[SESSION_COOKIE_NAME])
    return response.cookies[SESSION_COOKIE_NAME]


def test_session_endpoint_returns_logged_in_user(client: TestClient) -> None:
    login_and_return_cookie(client)
    response = client.get("/api/session")

    assert response.status_code == 200
    assert response.json() == {"username": "user"}


def test_logout_clears_backend_session(client: TestClient) -> None:
    login_and_return_cookie(client)
    logout_response = client.post("/api/logout")
    session_response = client.get("/api/session")

    assert logout_response.status_code == 204
    assert session_response.status_code == 401


def test_board_endpoint_requires_login(client: TestClient) -> None:
    response = client.get("/api/board")

    assert response.status_code == 401
    assert response.json() == {"detail": "Authentication required."}


def test_board_endpoint_returns_seeded_board(client: TestClient) -> None:
    login_and_return_cookie(client)
    response = client.get("/api/board")

    assert response.status_code == 200
    assert response.json() == DEFAULT_BOARD


def test_board_endpoint_updates_board(client: TestClient) -> None:
    login_and_return_cookie(client)
    updated_board = {
        "columns": [
            {"id": "col-backlog", "title": "Ready", "cardIds": ["card-1"]},
        ],
        "cards": {
            "card-1": {
                "id": "card-1",
                "title": "Updated title",
                "details": "Updated details.",
                "priority": "medium",
                "dueDate": "",
            }
        },
    }

    update_response = client.put(
        "/api/board",
        json=updated_board,
    )
    read_response = client.get("/api/board")

    assert update_response.status_code == 200
    assert update_response.json() == updated_board
    assert read_response.status_code == 200
    assert read_response.json() == updated_board


def test_missing_board_is_created_when_user_board_row_is_absent(
    app,
    client: TestClient,
) -> None:
    with connect_database(app.state.db_path) as connection:
        connection.execute(
            """
            DELETE FROM boards
            WHERE user_id = (SELECT id FROM users WHERE username = ?)
            """,
            ("user",),
        )
        connection.commit()

    login_and_return_cookie(client)
    response = client.get("/api/board")

    assert response.status_code == 200
    assert response.json() == DEFAULT_BOARD


def test_ai_test_route_returns_openrouter_result(client: TestClient) -> None:
    login_and_return_cookie(client)

    with patch(
        "app.main.request_openrouter_chat",
        new=AsyncMock(
            return_value=OpenRouterResult(
                content="4",
                model="openai/gpt-oss-120b",
                raw_response={"choices": [{"message": {"content": "4"}}]},
            )
        ),
    ):
        response = client.post("/api/ai/test")

    assert response.status_code == 200
    assert response.json() == {
        "answer": "4",
        "model": "openai/gpt-oss-120b",
        "prompt": "What is 2+2? Reply with only the answer.",
    }


def test_ai_chat_returns_reply_without_board_update(client: TestClient) -> None:
    login_and_return_cookie(client)

    with patch(
        "app.main.request_structured_openrouter_chat",
        new=AsyncMock(
            return_value=(
                OpenRouterResult(
                    content='{"reply":"Nothing changed.","board":null}',
                    model="openai/gpt-oss-120b",
                    raw_response={},
                ),
                type(
                    "Structured",
                    (),
                    {"reply": "Nothing changed.", "board": None},
                )(),
            )
        ),
    ):
        response = client.post("/api/ai/chat", json={"message": "What should I focus on?"})

    assert response.status_code == 200
    assert response.json()["reply"] == "Nothing changed."
    assert response.json()["updated"] is False
    assert response.json()["board"] == DEFAULT_BOARD


def test_ai_chat_applies_board_update_and_persists_it(client: TestClient) -> None:
    login_and_return_cookie(client)
    updated_board = BoardPayload.model_validate(
        {
            "columns": [
                {"id": "col-backlog", "title": "Backlog", "cardIds": ["card-1"]},
                {"id": "col-review", "title": "Review", "cardIds": ["card-2"]},
            ],
            "cards": {
                "card-1": {
                    "id": "card-1",
                    "title": "Align roadmap themes",
                    "details": "Draft quarterly themes with impact statements and metrics.",
                },
                "card-2": {
                    "id": "card-2",
                    "title": "New review task",
                    "details": "Created by AI.",
                },
            },
        }
    )

    with patch(
        "app.main.request_structured_openrouter_chat",
        new=AsyncMock(
            return_value=(
                OpenRouterResult(
                    content='{"reply":"I updated the board.","board":{}}',
                    model="openai/gpt-oss-120b",
                    raw_response={},
                ),
                type(
                    "Structured",
                    (),
                    {"reply": "I updated the board.", "board": updated_board},
                )(),
            )
        ),
    ):
        response = client.post("/api/ai/chat", json={"message": "Create a review card."})

    read_response = client.get("/api/board")

    assert response.status_code == 200
    assert response.json()["updated"] is True
    assert response.json()["board"] == updated_board.model_dump()
    assert read_response.status_code == 200
    assert read_response.json() == updated_board.model_dump()


def test_ai_chat_logs_warning_when_board_update_drops_existing_ids(
    client: TestClient,
    caplog,
) -> None:
    login_and_return_cookie(client)
    updated_board = BoardPayload.model_validate(
        {
            "columns": [
                {"id": "col-backlog", "title": "Backlog", "cardIds": ["card-1"]},
            ],
            "cards": {
                "card-1": {
                    "id": "card-1",
                    "title": "Align roadmap themes",
                    "details": "Draft quarterly themes with impact statements and metrics.",
                },
            },
        }
    )

    with patch(
        "app.main.request_structured_openrouter_chat",
        new=AsyncMock(
            return_value=(
                OpenRouterResult(
                    content='{"reply":"Trimmed the board.","board":{}}',
                    model="openai/gpt-oss-120b",
                    raw_response={},
                ),
                type(
                    "Structured",
                    (),
                    {"reply": "Trimmed the board.", "board": updated_board},
                )(),
            )
        ),
    ):
        with caplog.at_level("WARNING", logger="app.main"):
            response = client.post("/api/ai/chat", json={"message": "Trim the board."})

    assert response.status_code == 200
    assert any("dropped existing ids" in record.message for record in caplog.records)


def test_ai_chat_surfaces_structured_output_failure(client: TestClient) -> None:
    login_and_return_cookie(client)

    with patch(
        "app.main.request_structured_openrouter_chat",
        new=AsyncMock(side_effect=OpenRouterConfigError("Structured response parsing failed")),
    ):
        response = client.post("/api/ai/chat", json={"message": "Do something invalid."})

    assert response.status_code == 500
    assert response.json() == {"detail": "Structured response parsing failed"}


def test_ai_chat_tracks_history_per_session_and_logout_clears_it(app, client: TestClient) -> None:
    login_and_return_cookie(client)

    with patch(
        "app.main.request_structured_openrouter_chat",
        new=AsyncMock(
            return_value=(
                OpenRouterResult(
                    content='{"reply":"First reply","board":null}',
                    model="openai/gpt-oss-120b",
                    raw_response={},
                ),
                type(
                    "Structured",
                    (),
                    {"reply": "First reply", "board": None},
                )(),
            )
        ),
    ):
        client.post("/api/ai/chat", json={"message": "First message"})

    assert len(app.state.chat_history) == 1
    history_key = next(iter(app.state.chat_history))
    assert app.state.chat_history[history_key] == [
        {"role": "user", "content": "First message"},
        {"role": "assistant", "content": "First reply"},
    ]

    client.post("/api/logout")

    assert app.state.chat_history == {}


def test_ai_chat_uses_stub_mode_for_playwright_runs(
    monkeypatch,
    client: TestClient,
) -> None:
    login_and_return_cookie(client)
    monkeypatch.setenv("PM_AI_MODE", "stub")

    response = client.post(
        "/api/ai/chat",
        json={
            "message": "Create a new card titled AI follow-up in Backlog with details Review the latest board changes."
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["model"] == "stub-playwright"
    assert body["updated"] is True
    assert body["board"]["cards"]["card-ai-follow-up"]["title"] == "AI follow-up"
