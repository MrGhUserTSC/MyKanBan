from fastapi.testclient import TestClient

from app.main import SESSION_COOKIE_NAME


def register(client: TestClient, username: str, password: str = "pw123") -> None:
    response = client.post(
        "/api/register",
        json={"username": username, "password": password},
    )
    assert response.status_code == 201
    client.cookies.set(SESSION_COOKIE_NAME, response.cookies[SESSION_COOKIE_NAME])


def login(client: TestClient, username: str = "user", password: str = "password") -> None:
    response = client.post("/api/login", json={"username": username, "password": password})
    assert response.status_code == 200
    client.cookies.set(SESSION_COOKIE_NAME, response.cookies[SESSION_COOKIE_NAME])


# --- Registration ----------------------------------------------------------


def test_register_creates_user_and_logs_in(client: TestClient) -> None:
    response = client.post("/api/register", json={"username": "alice", "password": "pw123"})

    assert response.status_code == 201
    assert response.json() == {"username": "alice"}
    assert SESSION_COOKIE_NAME in response.cookies

    # The returned session is usable immediately.
    client.cookies.set(SESSION_COOKIE_NAME, response.cookies[SESSION_COOKIE_NAME])
    assert client.get("/api/session").json() == {"username": "alice"}


def test_register_then_login_with_same_credentials(client: TestClient) -> None:
    register(client, "alice")
    client.post("/api/logout")

    login(client, "alice", "pw123")
    assert client.get("/api/session").json() == {"username": "alice"}


def test_register_rejects_duplicate_username(client: TestClient) -> None:
    register(client, "alice")
    response = client.post("/api/register", json={"username": "alice", "password": "other"})

    assert response.status_code == 400
    assert "taken" in response.json()["detail"]


def test_register_rejects_blank_username(client: TestClient) -> None:
    response = client.post("/api/register", json={"username": "   ", "password": "pw"})

    assert response.status_code == 400


def test_new_user_starts_with_one_board(client: TestClient) -> None:
    register(client, "alice")
    response = client.get("/api/boards")

    assert response.status_code == 200
    boards = response.json()
    assert len(boards) == 1
    assert boards[0]["name"] == "My Board"


# --- Board CRUD ------------------------------------------------------------


def test_boards_require_authentication(client: TestClient) -> None:
    assert client.get("/api/boards").status_code == 401
    assert client.post("/api/boards", json={"name": "x"}).status_code == 401


def test_list_boards_for_seeded_user(client: TestClient) -> None:
    login(client)
    response = client.get("/api/boards")

    assert response.status_code == 200
    boards = response.json()
    assert len(boards) == 1
    assert boards[0]["name"] == "Product Roadmap"
    assert boards[0]["position"] == 0


def test_create_board(client: TestClient) -> None:
    login(client)
    response = client.post("/api/boards", json={"name": "Sprint Planning"})

    assert response.status_code == 201
    created = response.json()
    assert created["name"] == "Sprint Planning"
    assert created["position"] == 1

    boards = client.get("/api/boards").json()
    assert [board["name"] for board in boards] == ["Product Roadmap", "Sprint Planning"]


def test_create_board_rejects_blank_name(client: TestClient) -> None:
    login(client)
    response = client.post("/api/boards", json={"name": "  "})

    assert response.status_code == 400


def test_get_and_update_board_by_id(client: TestClient) -> None:
    login(client)
    board_id = client.post("/api/boards", json={"name": "Sprint"}).json()["id"]

    # New boards start with an empty 3-column layout.
    content = client.get(f"/api/boards/{board_id}").json()
    assert [col["title"] for col in content["columns"]] == ["To Do", "In Progress", "Done"]
    assert content["cards"] == {}

    new_content = {
        "columns": [{"id": "col-todo", "title": "To Do", "cardIds": ["c1"]}],
        "cards": {"c1": {"id": "c1", "title": "Ship", "details": "Now."}},
    }
    update = client.put(f"/api/boards/{board_id}", json=new_content)
    assert update.status_code == 200
    assert client.get(f"/api/boards/{board_id}").json() == new_content


def test_rename_board(client: TestClient) -> None:
    login(client)
    board_id = client.post("/api/boards", json={"name": "Old"}).json()["id"]

    response = client.patch(f"/api/boards/{board_id}", json={"name": "New"})

    assert response.status_code == 200
    assert response.json()["name"] == "New"


def test_delete_board(client: TestClient) -> None:
    login(client)
    board_id = client.post("/api/boards", json={"name": "Temp"}).json()["id"]

    response = client.delete(f"/api/boards/{board_id}")

    assert response.status_code == 204
    assert all(board["id"] != board_id for board in client.get("/api/boards").json())


def test_cannot_delete_last_remaining_board(client: TestClient) -> None:
    login(client)
    only_board = client.get("/api/boards").json()[0]["id"]

    response = client.delete(f"/api/boards/{only_board}")

    assert response.status_code == 400
    assert "last board" in response.json()["detail"]


def test_cannot_access_another_users_board(client: TestClient) -> None:
    register(client, "alice")
    alice_board = client.get("/api/boards").json()[0]["id"]
    client.post("/api/logout")

    login(client)  # default seeded user
    assert client.get(f"/api/boards/{alice_board}").status_code == 404
    assert client.put(
        f"/api/boards/{alice_board}",
        json={"columns": [], "cards": {}},
    ).status_code == 404
    assert client.patch(f"/api/boards/{alice_board}", json={"name": "x"}).status_code == 404
    assert client.delete(f"/api/boards/{alice_board}").status_code == 404


def test_missing_board_returns_404(client: TestClient) -> None:
    login(client)
    assert client.get("/api/boards/99999").status_code == 404
