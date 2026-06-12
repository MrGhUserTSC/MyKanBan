# Build-out Progress

Tracks the expansion of the PM MVP into a fuller application: real user
management, multiple boards per user, richer cards, and strong test coverage.
Updated each iteration so work is resumable.

## Roadmap

1. Backend foundation: password hashing + multi-board schema + data-access layer. (security.py, database.py + tests)
2. Backend API: registration, DB-backed login, multi-board CRUD endpoints. (main.py + tests)
3. Board-scoped AI chat + richer card fields (assignee, priority, labels, due date).
4. Frontend: registration UI + auth wired to new endpoints.
5. Frontend: multi-board switcher (list, create, rename, delete).
6. Frontend: richer card editor (new fields) + board-scoped AI.
7. Hardening: validation, error states, edge cases, integration tests.
8. E2E (Playwright) coverage for the new journeys.
9. Polish, docs, coverage review.
10. Final review + cleanup.

## Status log

### Iteration 1 (2026-06-12)
- Baseline: 25 backend tests green. Established roadmap.
- In progress: backend foundation (security + schema + data-access).

## Conventions

- Backend tests: `.venv\Scripts\python.exe -m pytest backend -q` with `PYTHONPATH=backend`.
- Keep it simple. No new runtime deps unless necessary (password hashing uses stdlib pbkdf2).
- Every board has: `id`, `user_id`, `name`, `position`, `board_json` (columns + cards), timestamps.
- Default seeded user remains `user` / `password` for back-compat.
