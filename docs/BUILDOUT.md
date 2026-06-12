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
- Done: backend foundation. security.py (pbkdf2), database.py rewrite to
  multi-board schema + migration + data-access layer. 42 tests green.

### Iteration 2 (2026-06-12)
- Done: backend API. Registration (POST /api/register), DB-backed login,
  multi-board CRUD (GET/POST /api/boards, GET/PUT/PATCH/DELETE /api/boards/{id}).
- Refactored auth into a require_user dependency.
- Found + fixed ownership-vs-last-board ordering bug in delete_board.
- 57 tests green.
- Also done: board-scoped AI chat. AiChatRequest takes optional board_id;
  handler resolves + persists against that board (defaults to first board
  for back-compat). Cross-user board_id returns 404. 59 backend tests green.
- Backend is now feature-complete. Next: frontend (registration UI +
  multi-board switcher wired to the new endpoints), then richer cards + E2E.

### Iteration 2 (2026-06-12)
- Done: frontend multi-board + registration.
  - New lib/api.ts: typed client for session/auth/boards/chat.
  - New BoardSwitcher component (select + inline create/rename/delete).
  - AppShell rewritten: loads board list, tracks activeBoardId, loads/saves
    per-board, board-scoped AI chat, login/register toggle.
  - KanbanBoard renders the switcher in its header.
- Tests: frontend unit 14 -> 23 (new BoardSwitcher + AppShell cases).
  E2E 11 -> 13 (registration + multi-board switching journeys).
- Migration bug caught by E2E: legacy demo user had an empty password_hash
  after the column was added (ON CONFLICT DO NOTHING never backfilled it).
  Fixed in seed_default_data; added a regression test. 60 backend tests green.
- Full green: 60 backend + 23 frontend unit + 13 E2E.
- Next: richer card fields (assignee/priority/labels/due date), then polish.

## Conventions

- Backend tests: `.venv\Scripts\python.exe -m pytest backend -q` with `PYTHONPATH=backend`.
- Keep it simple. No new runtime deps unless necessary (password hashing uses stdlib pbkdf2).
- Every board has: `id`, `user_id`, `name`, `position`, `board_json` (columns + cards), timestamps.
- Default seeded user remains `user` / `password` for back-compat.
