# Database model proposal

This document proposes the SQLite schema and persistence approach for the Project Management MVP before Part 6 implementation.

## Recommendation

Use a very small SQLite schema with:

- one `users` table
- one `boards` table storing one JSON blob per user board

For the current MVP, keep session state in memory rather than persisting it in SQLite. That matches the existing product decision that chat history can stay in memory per session and keeps the login flow simple. If we later decide to persist sessions, a third `sessions` table can be added without changing the board model.

## Why this shape

- It satisfies the explicit requirement to store one JSON blob per user board.
- It supports future multi-user behavior without changing the data model later.
- It preserves ordered columns and ordered cards exactly as the frontend already models them.
- It avoids premature normalization of cards and columns into separate tables for an MVP that only has one board per user.
- It keeps reads and writes simple for Part 6: fetch one row, parse one JSON document, update one row.

## Proposed tables

### `users`

Purpose: identify users and support future multi-user expansion.

Suggested columns:

- `id INTEGER PRIMARY KEY`
- `username TEXT NOT NULL UNIQUE`
- `created_at TEXT NOT NULL`

Notes:

- For the MVP, this will contain the hardcoded `user` account.
- Storing a `username` now keeps the schema ready for future real auth without complicating current behavior.

### `boards`

Purpose: store exactly one board JSON document per user.

Suggested columns:

- `id INTEGER PRIMARY KEY`
- `user_id INTEGER NOT NULL UNIQUE`
- `board_json TEXT NOT NULL`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

Constraints:

- `FOREIGN KEY (user_id) REFERENCES users(id)`
- `UNIQUE(user_id)` to enforce one board per user

Notes:

- `board_json` stores the full board in the same structural shape the frontend already uses.
- `updated_at` makes future debugging and sync checks easier at very low cost.

## Session storage decision

Recommendation for MVP:

- keep sessions in memory
- do not persist them in SQLite yet

Why:

- Current login is hardcoded and local-only.
- Persisting sessions would add table management, cleanup rules, and restart semantics before we need them.
- The app already uses a simple backend-issued session cookie backed by server memory, which is enough for the MVP stage.

If we later need persisted sessions, add:

### Optional future `sessions`

- `id TEXT PRIMARY KEY`
- `user_id INTEGER NOT NULL`
- `created_at TEXT NOT NULL`
- `expires_at TEXT NULL`

This is intentionally not part of the Part 6 recommendation unless we decide restart-persistent login matters for MVP.

## Proposed SQL

```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS boards (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  board_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## Sample stored board JSON

This is the recommended persisted shape for `boards.board_json`:

```json
{
  "columns": [
    {
      "id": "col-backlog",
      "title": "Backlog",
      "cardIds": ["card-1", "card-2"]
    },
    {
      "id": "col-discovery",
      "title": "Discovery",
      "cardIds": ["card-3"]
    },
    {
      "id": "col-progress",
      "title": "In Progress",
      "cardIds": ["card-4", "card-5"]
    },
    {
      "id": "col-review",
      "title": "Review",
      "cardIds": ["card-6"]
    },
    {
      "id": "col-done",
      "title": "Done",
      "cardIds": ["card-7", "card-8"]
    }
  ],
  "cards": {
    "card-1": {
      "id": "card-1",
      "title": "Align roadmap themes",
      "details": "Draft quarterly themes with impact statements and metrics."
    },
    "card-2": {
      "id": "card-2",
      "title": "Gather customer signals",
      "details": "Review support tags, sales notes, and churn feedback."
    },
    "card-3": {
      "id": "card-3",
      "title": "Prototype analytics view",
      "details": "Sketch initial dashboard layout and key drill-downs."
    }
  }
}
```

Notes:

- `columns` stays as an ordered array, which preserves column order.
- each column keeps ordered `cardIds`, which preserves card order inside a column.
- `cards` remains a keyed object for quick lookup by id.

## Missing database bootstrap strategy

Recommendation:

- create the SQLite file automatically on backend startup if it does not exist
- run `CREATE TABLE IF NOT EXISTS` statements on startup
- insert the MVP user row if missing
- insert that user’s default board JSON if missing

Why this is the best fit now:

- it keeps local setup friction low
- it works cleanly inside the single-container local Docker workflow
- it avoids introducing a migration tool before the schema is large enough to justify it

## Tradeoffs

Pros:

- simplest model that still supports future multi-user behavior
- exact match for current frontend board structure
- low-risk implementation for Part 6

Cons:

- querying individual cards or columns inside SQLite is less convenient than with normalized tables
- partial updates still require reading and writing the whole board JSON document
- concurrent editing would be more awkward later, though that is not an MVP concern

## Validation against requirements

- one board per user: enforced with `UNIQUE(user_id)` on `boards`
- ordered columns: preserved by the `columns` array order in JSON
- ordered cards inside columns: preserved by each column’s `cardIds` order
- future multi-user support: provided by separate `users` and `boards` rows

## Recommendation to approve

Approve the following for Part 6:

- SQLite with `users` and `boards`
- one JSON blob in `boards.board_json` per user
- automatic database creation and default seeding if missing
- sessions remain in memory for now
