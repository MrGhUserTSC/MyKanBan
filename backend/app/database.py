from __future__ import annotations

import json
import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


MVP_USERNAME = "user"

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


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


def connect_database(db_path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database(db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)

    with connect_database(db_path) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY,
              username TEXT NOT NULL UNIQUE,
              created_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS boards (
              id INTEGER PRIMARY KEY,
              user_id INTEGER NOT NULL UNIQUE,
              board_json TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              FOREIGN KEY (user_id) REFERENCES users(id)
            )
            """
        )
        seed_default_data(connection)
        connection.commit()


def seed_default_data(connection: sqlite3.Connection) -> None:
    timestamp = utc_now()
    connection.execute(
        """
        INSERT INTO users (username, created_at)
        VALUES (?, ?)
        ON CONFLICT(username) DO NOTHING
        """,
        (MVP_USERNAME, timestamp),
    )

    user_row = connection.execute(
        "SELECT id FROM users WHERE username = ?",
        (MVP_USERNAME,),
    ).fetchone()
    if user_row is None:
        raise RuntimeError("Default MVP user could not be created.")

    connection.execute(
        """
        INSERT INTO boards (user_id, board_json, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO NOTHING
        """,
        (
            user_row["id"],
            json.dumps(DEFAULT_BOARD),
            timestamp,
            timestamp,
        ),
    )


def get_user_id(connection: sqlite3.Connection, username: str) -> int | None:
    row = connection.execute(
        "SELECT id FROM users WHERE username = ?",
        (username,),
    ).fetchone()
    return None if row is None else int(row["id"])


def get_board_for_username(db_path: Path, username: str) -> dict[str, Any]:
    with connect_database(db_path) as connection:
        user_id = get_user_id(connection, username)
        if user_id is None:
            raise LookupError(f"Unknown user: {username}")

        row = connection.execute(
            "SELECT board_json FROM boards WHERE user_id = ?",
            (user_id,),
        ).fetchone()
        if row is None:
            connection.execute(
                """
                INSERT INTO boards (user_id, board_json, created_at, updated_at)
                VALUES (?, ?, ?, ?)
                """,
                (
                    user_id,
                    json.dumps(DEFAULT_BOARD),
                    utc_now(),
                    utc_now(),
                ),
            )
            connection.commit()
            return DEFAULT_BOARD

        return json.loads(row["board_json"])


def save_board_for_username(
    db_path: Path,
    username: str,
    board: dict[str, Any],
) -> dict[str, Any]:
    with connect_database(db_path) as connection:
        user_id = get_user_id(connection, username)
        if user_id is None:
            raise LookupError(f"Unknown user: {username}")

        timestamp = utc_now()
        connection.execute(
            """
            UPDATE boards
            SET board_json = ?, updated_at = ?
            WHERE user_id = ?
            """,
            (json.dumps(board), timestamp, user_id),
        )
        connection.commit()

    return board
