# Project Management App

A local-first kanban project management app: FastAPI backend, Next.js frontend
(served as static assets by the backend), and a local SQLite database.

## Features

- User accounts with registration and hashed-password login.
- Multiple kanban boards per user (create, rename, switch, delete).
- Drag-and-drop columns and cards; rename columns inline.
- Cards with title, details, priority (low/medium/high), and due date.
- AI chat sidebar that can read and update the active board via OpenRouter.

## Run locally

Use the scripts for your platform:

- `scripts/start-windows.ps1` / `scripts/stop-windows.ps1`
- `scripts/start-mac.sh` / `scripts/stop-mac.sh`
- `scripts/start-linux.sh` / `scripts/stop-linux.sh`

The backend serves the built frontend at `/` and the API under `/api`.
The SQLite database is created and seeded automatically on first start.

Demo login: `user` / `password`. New accounts can be created from the sign-in
screen.

## Tests

- Backend: `PYTHONPATH=backend python -m pytest backend`
- Frontend unit: `cd frontend && npm run test:unit`
- Frontend E2E: `cd frontend && npm run test:e2e`

## Key endpoints

- `POST /api/register`, `POST /api/login`, `POST /api/logout`, `GET /api/session`
- `GET /api/boards`, `POST /api/boards`
- `GET|PUT|PATCH|DELETE /api/boards/{id}`
- `POST /api/ai/chat`
- `GET /api/health`
