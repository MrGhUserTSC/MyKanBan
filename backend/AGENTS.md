# Backend description

This directory contains the FastAPI backend for the Project Management MVP.

## Current scope

- Serve the built Next.js frontend (or a placeholder page if it hasn't been built) at `/`.
- Provide a health check at `/api/health`.
- Provide login, logout, and session endpoints backed by an in-memory session store.
- Provide authenticated read/write APIs for a single per-user board, persisted in SQLite.
- Provide an AI chat endpoint that sends the board and conversation history to OpenRouter
  and can apply structured board updates returned by the model.

## Layout

- `app/main.py` contains the FastAPI application, routes, and session handling.
- `app/database.py` contains SQLite initialization, seeding, and board read/write helpers.
- `app/models.py` contains the Pydantic request/response models.
- `app/openrouter.py` contains the OpenRouter client wrapper and structured chat helpers.
- `static/index.html` contains the scaffold placeholder page served at `/` when no frontend
  build is present.
- `data/` holds the local SQLite database file (gitignored, created automatically).
- `tests/` contains backend tests.
- `pyproject.toml` defines Python dependencies for `uv`.

## Notes

- Keep the backend simple and local-first.
- The database path can be overridden with the `PM_DB_PATH` environment variable (used by
  the Playwright test server to avoid touching the default local database).
- `PM_AI_MODE=stub` switches `/api/ai/chat` to a deterministic stub response for
  Playwright E2E runs instead of calling OpenRouter.
