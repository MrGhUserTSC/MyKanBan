from __future__ import annotations

import copy
import json
import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.security import hash_password, verify_password

MVP_USERNAME = "user"
MVP_PASSWORD = "password"
DEFAULT_BOARD_NAME = "Product Roadmap"

DEFAULT_BOARD: dict[str, Any] = {
    "columns": [
        {"id": "col-backlog", "title": "Backlog", "cardIds": ["card-1", "card-2"]},
        {"id": "col-discovery", "title": "Discovery", "cardIds": ["card-3"]},
        {
            "id": "col-progress",
            "title": "In Progress",
            "cardIds": ["card-4", "card-5"],
        },
        {"id": "col-review", "title": "Review", "cardIds": ["card-6"]},
        {"id": "col-done", "title": "Done", "cardIds": ["card-7", "card-8"]},
    ],
    "cards": {
        "card-1": {
            "id": "card-1",
            "title": "Align roadmap themes",
            "details": "Draft quarterly themes with impact statements and metrics.",
        },
        "card-2": {
            "id": "card-2",
            "title": "Gather customer signals",
            "details": "Review support tags, sales notes, and churn feedback.",
        },
        "card-3": {
            "id": "card-3",
            "title": "Prototype analytics view",
            "details": "Sketch initial dashboard layout and key drill-downs.",
        },
        "card-4": {
            "id": "card-4",
            "title": "Refine status language",
            "details": "Standardize column labels and tone across the board.",
        },
        "card-5": {
            "id": "card-5",
            "title": "Design card layout",
            "details": "Add hierarchy and spacing for scanning dense lists.",
        },
        "card-6": {
            "id": "card-6",
            "title": "QA micro-interactions",
            "details": "Verify hover, focus, and loading states.",
        },
        "card-7": {
            "id": "card-7",
            "title": "Ship marketing page",
            "details": "Final copy approved and asset pack delivered.",
        },
        "card-8": {
            "id": "card-8",
            "title": "Close onboarding sprint",
            "details": "Document release notes and share internally.",
        },
    },
}


def empty_board() -> dict[str, Any]:
    return {
        "columns": [
            {"id": "col-todo", "title": "To Do", "cardIds": []},
            {"id": "col-progress", "title": "In Progress", "cardIds": []},
            {"id": "col-done", "title": "Done", "cardIds": []},
        ],
        "cards": {},
    }


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


def connect_database(db_path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def _table_columns(connection: sqlite3.Connection, table: str) -> set[str]:
    rows = connection.execute(f"PRAGMA table_info({table})").fetchall()
    return {row["name"] for row in rows}


def _migrate_schema(connection: sqlite3.Connection) -> None:
    """Upgrade older single-board databases in place."""
    user_columns = _table_columns(connection, "users")
    if user_columns and "password_hash" not in user_columns:
        connection.execute("ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''")

    board_columns = _table_columns(connection, "boards")
    if board_columns and "name" not in board_columns:
        # The legacy boards table pinned one board per user via UNIQUE(user_id).
        # Rebuild it without that constraint and with the new metadata columns.
        connection.execute("ALTER TABLE boards RENAME TO boards_legacy")
        _create_boards_table(connection)
        connection.execute(
            """
            INSERT INTO boards (user_id, name, position, board_json, created_at, updated_at)
            SELECT user_id, ?, 0, board_json, created_at, updated_at FROM boards_legacy
            """,
            (DEFAULT_BOARD_NAME,),
        )
        connection.execute("DROP TABLE boards_legacy")


def _create_boards_table(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS boards (
          id INTEGER PRIMARY KEY,
          user_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          position INTEGER NOT NULL,
          board_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """
    )


def initialize_database(db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)

    with connect_database(db_path) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY,
              username TEXT NOT NULL UNIQUE,
              password_hash TEXT NOT NULL DEFAULT '',
              created_at TEXT NOT NULL
            )
            """
        )
        _create_boards_table(connection)
        _migrate_schema(connection)
        seed_default_data(connection)
        connection.commit()


def seed_default_data(connection: sqlite3.Connection) -> None:
    timestamp = utc_now()
    connection.execute(
        """
        INSERT INTO users (username, password_hash, created_at)
        VALUES (?, ?, ?)
        ON CONFLICT(username) DO NOTHING
        """,
        (MVP_USERNAME, hash_password(MVP_PASSWORD), timestamp),
    )

    user_row = connection.execute(
        "SELECT id FROM users WHERE username = ?",
        (MVP_USERNAME,),
    ).fetchone()
    if user_row is None:
        raise RuntimeError("Default MVP user could not be created.")

    existing = connection.execute(
        "SELECT COUNT(*) AS count FROM boards WHERE user_id = ?",
        (user_row["id"],),
    ).fetchone()
    if existing["count"] == 0:
        connection.execute(
            """
            INSERT INTO boards (user_id, name, position, board_json, created_at, updated_at)
            VALUES (?, ?, 0, ?, ?, ?)
            """,
            (
                user_row["id"],
                DEFAULT_BOARD_NAME,
                json.dumps(DEFAULT_BOARD),
                timestamp,
                timestamp,
            ),
        )


# --- Users -----------------------------------------------------------------


def get_user_id(connection: sqlite3.Connection, username: str) -> int | None:
    row = connection.execute(
        "SELECT id FROM users WHERE username = ?",
        (username,),
    ).fetchone()
    return None if row is None else int(row["id"])


def _require_user_id(connection: sqlite3.Connection, username: str) -> int:
    user_id = get_user_id(connection, username)
    if user_id is None:
        raise LookupError(f"Unknown user: {username}")
    return user_id


def create_user(db_path: Path, username: str, password: str) -> None:
    """Create a user and seed an empty starter board. Raises ValueError if taken."""
    username = username.strip()
    if not username or not password:
        raise ValueError("Username and password are required.")

    with connect_database(db_path) as connection:
        if get_user_id(connection, username) is not None:
            raise ValueError("Username is already taken.")

        timestamp = utc_now()
        cursor = connection.execute(
            "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)",
            (username, hash_password(password), timestamp),
        )
        connection.execute(
            """
            INSERT INTO boards (user_id, name, position, board_json, created_at, updated_at)
            VALUES (?, ?, 0, ?, ?, ?)
            """,
            (cursor.lastrowid, "My Board", json.dumps(empty_board()), timestamp, timestamp),
        )
        connection.commit()


def verify_credentials(db_path: Path, username: str, password: str) -> bool:
    with connect_database(db_path) as connection:
        row = connection.execute(
            "SELECT password_hash FROM users WHERE username = ?",
            (username.strip(),),
        ).fetchone()

    if row is None:
        return False
    return verify_password(password, row["password_hash"])


# --- Boards ----------------------------------------------------------------


def _board_meta(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": int(row["id"]),
        "name": row["name"],
        "position": int(row["position"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def list_boards(db_path: Path, username: str) -> list[dict[str, Any]]:
    with connect_database(db_path) as connection:
        user_id = _require_user_id(connection, username)
        rows = connection.execute(
            "SELECT * FROM boards WHERE user_id = ? ORDER BY position, id",
            (user_id,),
        ).fetchall()
    return [_board_meta(row) for row in rows]


def create_board(db_path: Path, username: str, name: str) -> dict[str, Any]:
    name = name.strip()
    if not name:
        raise ValueError("Board name is required.")

    with connect_database(db_path) as connection:
        user_id = _require_user_id(connection, username)
        next_position = connection.execute(
            "SELECT COALESCE(MAX(position) + 1, 0) AS pos FROM boards WHERE user_id = ?",
            (user_id,),
        ).fetchone()["pos"]
        timestamp = utc_now()
        cursor = connection.execute(
            """
            INSERT INTO boards (user_id, name, position, board_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (user_id, name, next_position, json.dumps(empty_board()), timestamp, timestamp),
        )
        connection.commit()
        row = connection.execute(
            "SELECT * FROM boards WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
    return _board_meta(row)


def _owned_board_row(
    connection: sqlite3.Connection, username: str, board_id: int
) -> sqlite3.Row:
    user_id = _require_user_id(connection, username)
    row = connection.execute(
        "SELECT * FROM boards WHERE id = ? AND user_id = ?",
        (board_id, user_id),
    ).fetchone()
    if row is None:
        raise LookupError(f"Board {board_id} not found for user {username}.")
    return row


def get_board(db_path: Path, username: str, board_id: int) -> dict[str, Any]:
    with connect_database(db_path) as connection:
        row = _owned_board_row(connection, username, board_id)
    return json.loads(row["board_json"])


def save_board(
    db_path: Path, username: str, board_id: int, board: dict[str, Any]
) -> dict[str, Any]:
    with connect_database(db_path) as connection:
        _owned_board_row(connection, username, board_id)
        connection.execute(
            "UPDATE boards SET board_json = ?, updated_at = ? WHERE id = ?",
            (json.dumps(board), utc_now(), board_id),
        )
        connection.commit()
    return board


def rename_board(db_path: Path, username: str, board_id: int, name: str) -> dict[str, Any]:
    name = name.strip()
    if not name:
        raise ValueError("Board name is required.")

    with connect_database(db_path) as connection:
        _owned_board_row(connection, username, board_id)
        connection.execute(
            "UPDATE boards SET name = ?, updated_at = ? WHERE id = ?",
            (name, utc_now(), board_id),
        )
        connection.commit()
        row = connection.execute("SELECT * FROM boards WHERE id = ?", (board_id,)).fetchone()
    return _board_meta(row)


def delete_board(db_path: Path, username: str, board_id: int) -> None:
    with connect_database(db_path) as connection:
        row = _owned_board_row(connection, username, board_id)
        count = connection.execute(
            "SELECT COUNT(*) AS count FROM boards WHERE user_id = ?",
            (row["user_id"],),
        ).fetchone()["count"]
        if count <= 1:
            raise ValueError("Cannot delete the last board.")

        connection.execute("DELETE FROM boards WHERE id = ?", (board_id,))
        connection.commit()


def get_default_board_id(db_path: Path, username: str) -> int:
    with connect_database(db_path) as connection:
        user_id = _require_user_id(connection, username)
        row = connection.execute(
            "SELECT id FROM boards WHERE user_id = ? ORDER BY position, id LIMIT 1",
            (user_id,),
        ).fetchone()
    if row is None:
        raise LookupError(f"No board found for user {username}.")
    return int(row["id"])


# --- Back-compat helpers (operate on the user's first board) ----------------


def get_board_for_username(db_path: Path, username: str) -> dict[str, Any]:
    with connect_database(db_path) as connection:
        user_id = _require_user_id(connection, username)
        row = connection.execute(
            "SELECT * FROM boards WHERE user_id = ? ORDER BY position, id LIMIT 1",
            (user_id,),
        ).fetchone()
        if row is None:
            timestamp = utc_now()
            connection.execute(
                """
                INSERT INTO boards (user_id, name, position, board_json, created_at, updated_at)
                VALUES (?, ?, 0, ?, ?, ?)
                """,
                (user_id, DEFAULT_BOARD_NAME, json.dumps(DEFAULT_BOARD), timestamp, timestamp),
            )
            connection.commit()
            return copy.deepcopy(DEFAULT_BOARD)
    return json.loads(row["board_json"])


def save_board_for_username(
    db_path: Path, username: str, board: dict[str, Any]
) -> dict[str, Any]:
    board_id = get_default_board_id(db_path, username)
    return save_board(db_path, username, board_id, board)
