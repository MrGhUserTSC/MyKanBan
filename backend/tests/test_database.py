import json
from pathlib import Path

import pytest

from app.database import (
    DEFAULT_BOARD,
    MVP_PASSWORD,
    MVP_USERNAME,
    connect_database,
    create_board,
    create_user,
    delete_board,
    get_board,
    get_default_board_id,
    initialize_database,
    list_boards,
    rename_board,
    save_board,
    verify_credentials,
)


@pytest.fixture
def db_path(tmp_path: Path) -> Path:
    path = tmp_path / "pm-test.db"
    initialize_database(path)
    return path


def test_seeds_default_user_with_hashed_password(db_path: Path) -> None:
    assert verify_credentials(db_path, MVP_USERNAME, MVP_PASSWORD) is True
    assert verify_credentials(db_path, MVP_USERNAME, "wrong") is False

    with connect_database(db_path) as connection:
        row = connection.execute(
            "SELECT password_hash FROM users WHERE username = ?",
            (MVP_USERNAME,),
        ).fetchone()
    assert row["password_hash"] != MVP_PASSWORD
    assert row["password_hash"] != ""


def test_default_user_has_one_seeded_board(db_path: Path) -> None:
    boards = list_boards(db_path, MVP_USERNAME)

    assert len(boards) == 1
    board_id = boards[0]["id"]
    assert get_board(db_path, MVP_USERNAME, board_id) == DEFAULT_BOARD


def test_create_user_and_login(db_path: Path) -> None:
    create_user(db_path, "alice", "hunter2")

    assert verify_credentials(db_path, "alice", "hunter2") is True
    assert verify_credentials(db_path, "alice", "nope") is False
    # New users get a starter board.
    assert len(list_boards(db_path, "alice")) == 1


def test_create_user_rejects_duplicate(db_path: Path) -> None:
    create_user(db_path, "alice", "hunter2")

    with pytest.raises(ValueError, match="already taken"):
        create_user(db_path, "alice", "other")


def test_create_user_rejects_blank(db_path: Path) -> None:
    with pytest.raises(ValueError):
        create_user(db_path, "   ", "pw")
    with pytest.raises(ValueError):
        create_user(db_path, "bob", "")


def test_boards_are_isolated_per_user(db_path: Path) -> None:
    create_user(db_path, "alice", "pw")
    alice_board = list_boards(db_path, "alice")[0]["id"]
    user_board = list_boards(db_path, MVP_USERNAME)[0]["id"]

    # The default user cannot read alice's board.
    with pytest.raises(LookupError):
        get_board(db_path, MVP_USERNAME, alice_board)
    # ...and vice versa.
    with pytest.raises(LookupError):
        get_board(db_path, "alice", user_board)


def test_create_list_and_order_multiple_boards(db_path: Path) -> None:
    create_user(db_path, "alice", "pw")
    first = create_board(db_path, "alice", "Sprint 1")
    second = create_board(db_path, "alice", "Sprint 2")

    boards = list_boards(db_path, "alice")
    names = [board["name"] for board in boards]

    assert names == ["My Board", "Sprint 1", "Sprint 2"]
    assert first["position"] < second["position"]


def test_save_and_read_board_content(db_path: Path) -> None:
    create_user(db_path, "alice", "pw")
    board_id = create_board(db_path, "alice", "Sprint 1")["id"]
    new_content = {
        "columns": [{"id": "col-todo", "title": "To Do", "cardIds": ["c1"]}],
        "cards": {"c1": {"id": "c1", "title": "Task", "details": "Do it."}},
    }

    save_board(db_path, "alice", board_id, new_content)

    assert get_board(db_path, "alice", board_id) == new_content


def test_rename_board(db_path: Path) -> None:
    create_user(db_path, "alice", "pw")
    board_id = create_board(db_path, "alice", "Old Name")["id"]

    renamed = rename_board(db_path, "alice", board_id, "New Name")

    assert renamed["name"] == "New Name"
    assert list_boards(db_path, "alice")[1]["name"] == "New Name"


def test_delete_board(db_path: Path) -> None:
    create_user(db_path, "alice", "pw")
    board_id = create_board(db_path, "alice", "Disposable")["id"]

    delete_board(db_path, "alice", board_id)

    assert all(board["id"] != board_id for board in list_boards(db_path, "alice"))


def test_cannot_delete_last_board(db_path: Path) -> None:
    create_user(db_path, "alice", "pw")
    only_board = list_boards(db_path, "alice")[0]["id"]

    with pytest.raises(ValueError, match="last board"):
        delete_board(db_path, "alice", only_board)


def test_get_default_board_id_returns_first(db_path: Path) -> None:
    create_user(db_path, "alice", "pw")
    first = list_boards(db_path, "alice")[0]["id"]
    create_board(db_path, "alice", "Later")

    assert get_default_board_id(db_path, "alice") == first


def test_migration_upgrades_legacy_single_board_schema(tmp_path: Path) -> None:
    path = tmp_path / "legacy.db"
    # Recreate the original MVP schema by hand, then confirm initialize migrates it.
    with connect_database(path) as connection:
        connection.execute(
            "CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL)"
        )
        connection.execute(
            """
            CREATE TABLE boards (
              id INTEGER PRIMARY KEY,
              user_id INTEGER NOT NULL UNIQUE,
              board_json TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              FOREIGN KEY (user_id) REFERENCES users(id)
            )
            """
        )
        connection.execute(
            "INSERT INTO users (username, created_at) VALUES (?, ?)",
            ("legacy", "2020-01-01T00:00:00+00:00"),
        )
        connection.execute(
            "INSERT INTO boards (user_id, board_json, created_at, updated_at) VALUES (1, ?, ?, ?)",
            (json.dumps(DEFAULT_BOARD), "2020-01-01T00:00:00+00:00", "2020-01-01T00:00:00+00:00"),
        )
        connection.commit()

    initialize_database(path)

    boards = list_boards(path, "legacy")
    assert len(boards) == 1
    assert boards[0]["name"]  # got a name during migration
    assert get_board(path, "legacy", boards[0]["id"]) == DEFAULT_BOARD
