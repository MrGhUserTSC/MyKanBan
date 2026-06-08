# Backend description

This directory contains the FastAPI backend for the Project Management MVP.

## Current scope

- Serve a simple health API at `/api/health`.
- Serve a placeholder HTML page at `/` during the early scaffold phase.
- Provide the foundation for later session, board, database, and AI work.

## Layout

- `app/main.py` contains the FastAPI application.
- `static/index.html` contains the scaffold placeholder page served at `/`.
- `tests/` contains backend tests.
- `pyproject.toml` defines Python dependencies for `uv`.

## Notes

- Keep the backend simple and local-first.
- The root page is temporary and will be replaced when the frontend is integrated in Part 3.
