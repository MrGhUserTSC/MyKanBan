from fastapi.testclient import TestClient

from app.main import SESSION_COOKIE_NAME


def login(client: TestClient) -> None:
    response = client.post("/api/login", json={"username": "user", "password": "password"})
    client.cookies.set(SESSION_COOKIE_NAME, response.cookies[SESSION_COOKIE_NAME])


def test_stub_ai_chat_targets_the_requested_board(monkeypatch, client: TestClient) -> None:
    login(client)
    monkeypatch.setenv("PM_AI_MODE", "stub")

    # A second board, distinct from the default seeded one.
    second_id = client.post("/api/boards", json={"name": "Second"}).json()["id"]
    # Seed it with a Backlog column so the stub can add a card there.
    client.put(
        f"/api/boards/{second_id}",
        json={
            "columns": [{"id": "col-backlog", "title": "Backlog", "cardIds": []}],
            "cards": {},
        },
    )

    response = client.post(
        "/api/ai/chat",
        json={
            "message": "Create a new card titled Scoped in Backlog with details targeted board.",
            "board_id": second_id,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["updated"] is True
    assert body["board"]["cards"]["card-ai-follow-up"]["title"] == "Scoped"

    # The change landed on the second board, not the default one.
    second = client.get(f"/api/boards/{second_id}").json()
    assert "card-ai-follow-up" in second["cards"]
    default_id = client.get("/api/boards").json()[0]["id"]
    default = client.get(f"/api/boards/{default_id}").json()
    assert "card-ai-follow-up" not in default["cards"]


def test_ai_chat_rejects_board_owned_by_another_user(client: TestClient) -> None:
    # Register a separate user and capture their board id.
    other = client.post("/api/register", json={"username": "mallory", "password": "pw"})
    client.cookies.set(SESSION_COOKIE_NAME, other.cookies[SESSION_COOKIE_NAME])
    foreign_board = client.get("/api/boards").json()[0]["id"]
    client.post("/api/logout")

    login(client)
    response = client.post(
        "/api/ai/chat",
        json={"message": "anything", "board_id": foreign_board},
    )

    assert response.status_code == 404
