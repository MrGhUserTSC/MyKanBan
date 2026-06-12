# Code Review

Comprehensive review of the Project Management MVP (backend, frontend, scripts, docs, and
repo hygiene) as of the completed Part 1-10 implementation. All test suites (24 backend
pytest, 14 frontend Vitest, 11 Playwright E2E) pass and the Docker image builds and runs
correctly. Findings below are ordered roughly by priority within each section.

## Status: all items addressed

Every item below has been fixed except #6 and #7, which were re-evaluated and intentionally
left as-is (see notes inline). Backend tests now total 25 (one new test added for item 3),
and all frontend unit and E2E suites continue to pass after the fixes.

## High priority

### 1. The committed SQLite database is mutated by running the app/tests

`backend/data/pm.db` is tracked in git (`git ls-files | grep data/`). The Playwright
webServer (`scripts/run-playwright-server.py`) runs the real `app.main:app`, which defaults
to `DB_PATH = backend/data/pm.db` (`backend/app/main.py:41`). E2E tests log in, rename
columns, add/move/delete cards, and trigger AI board updates against this same file.

Confirmed during this review: after running `npm run test:e2e`, `git status` shows
`backend/data/pm.db` as modified (the AI stub's `card-ai-follow-up` card and a renamed
column were persisted into the tracked file).

**Impact**: every test run (or local `uv run uvicorn ...` / docker dev run that reuses this
path) dirties a tracked binary file, produces noisy diffs/merge conflicts, and risks
committing stale or sensitive board data.

**Action**:
- Remove `backend/data/pm.db` from version control (`git rm --cached backend/data/pm.db`)
  and add `backend/data/` to `.gitignore`. The app already auto-creates and seeds the DB on
  startup, so nothing is lost.
- Point the Playwright/dev server at a non-tracked DB path (e.g. an env-configurable
  `PM_DB_PATH`, or a path under a gitignored `backend/data/` directory / temp dir) so test
  runs never touch a file meant to represent "the" local database.

**Fixed**: `backend/data/` is now gitignored and `backend/data/pm.db` untracked. `DB_PATH`
reads from an optional `PM_DB_PATH` env var, and `run-playwright-server.py` sets
`PM_DB_PATH` to `backend/data/pm-e2e.db` so E2E runs no longer touch the default database.

## Medium priority

### 2. `DEFAULT_BOARD` is returned by reference, not copied

`get_board_for_username` (`backend/app/database.py:149-176`) returns the module-level
`DEFAULT_BOARD` dict directly when a user has no board row yet. `seed_default_data` also
shares this same dict via `json.dumps`. Today this is safe because every caller immediately
passes the result through `BoardPayload.model_validate(...)`, which copies the data — but
it's a latent footgun: any future code path that mutates the returned dict in place would
corrupt the shared default for the lifetime of the process (affecting every subsequently
seeded user).

**Action**: return `copy.deepcopy(DEFAULT_BOARD)` (or `json.loads(json.dumps(DEFAULT_BOARD))`)
from `get_board_for_username` for the missing-row branch.

**Fixed**: the missing-row branch now returns `copy.deepcopy(DEFAULT_BOARD)`.

### 3. AI board updates are schema-validated only, not integrity-checked

`parse_structured_chat_response` (`backend/app/openrouter.py:162-166`) only confirms the
model's JSON matches the `AiChatStructuredResponse` shape. The system prompt
(`build_chat_messages`, `openrouter.py:52-81`) *asks* the model to preserve all existing
columns/cards/ids, but nothing on the server enforces this. Per the agreed design, any
schema-valid board returned by the AI is persisted immediately with no confirmation step
(`backend/app/main.py:277-289`).

**Impact**: a model response that is valid JSON but drops columns/cards (e.g. due to a
truncated or "helpful rewrite" response) silently overwrites the user's saved board with
data loss and no recovery path.

**Action**: add a server-side guard in `ai_chat` that checks the returned board's card/column
ids are a superset of the current board's ids (or at least warns/logs when ids disappear),
and reject/ignore updates that fail this check rather than persisting them blindly.

**Fixed**: added `find_dropped_ids` and a warning log in `ai_chat` whenever an applied AI
board update drops existing column or card ids, with a new test
(`test_ai_chat_logs_warning_when_board_update_drops_existing_ids`). The update is still
applied (per the agreed "no confirmation step" design), but the drop is now visible in logs
for debugging/monitoring. A hard rejection was deliberately not added since the existing
"AI updates apply directly" design decision and an existing passing test both rely on the
AI being able to return a smaller replacement board.

### 4. Tracked Playwright artifact

`frontend/test-results/.last-run.json` is committed (`git ls-files frontend | grep
test-results`). `frontend/.gitignore` has no `/test-results/` entry, so every Playwright run
regenerates and dirties this file.

**Action**: add `/test-results/` (and `/playwright-report/` if used) to
`frontend/.gitignore`, and `git rm --cached frontend/test-results/.last-run.json`.

**Fixed**: added `/test-results` and `/playwright-report` to `frontend/.gitignore` and
untracked the file.

## Low priority / hardening

### 5. Per-keystroke board persistence on column rename

`KanbanColumn`'s title `<input onChange>` calls `onRename` on every keystroke
(`frontend/src/components/KanbanColumn.tsx:59-64`), which flows through
`KanbanBoard.updateBoard` → `AppShell.handleBoardChange`, issuing a `PUT /api/board` request
per keystroke (serialized via the save queue,
`frontend/src/components/AppShell.tsx:183-220`). Renaming a column to a 12-character title
fires 12 sequential network requests.

**Action**: debounce the save (e.g. 300-500ms after the last keystroke) or persist on blur
instead of on every change. Card title/details edits already avoid this by only saving on
form submit.

**Fixed**: `AppShell.handleBoardChange` now debounces the `PUT /api/board` call by 400ms
(`BOARD_SAVE_DEBOUNCE_MS`), restarting the timer on every change while keeping local board
state and the "Saving changes" indicator updated immediately. `kanban.spec.ts`'s
`reloadAfterSave` wait was bumped from 300ms to 600ms to account for the debounce.

### 6. Save-error state can be silently cleared by a later success

In `AppShell.handleBoardChange` (`frontend/src/components/AppShell.tsx:183-220`),
`pendingSavesRef` tracks in-flight saves and resets `saveState` to `idle` once the counter
hits zero — even if an *earlier* save in the queue failed and set `status: "error"`. If save
A fails and save B (queued after it) succeeds, the UI silently shows "All changes saved"
even though A's change was never persisted.

**Action**: track failures explicitly (e.g. a `hasError` flag that isn't cleared by a later
success) or surface a persistent "some changes failed to save" banner until the user retries.

**Re-evaluated, no change**: every save sends the *entire* current board snapshot, and the
save queue is strictly sequential (each save only starts after the previous one settles). So
if save A fails and save B (which already includes A's edits) later succeeds, B's payload
fully supersedes A's — the data is not lost, and showing "All changes saved" after B
succeeds is accurate. No code change made.

### 7. In-memory sessions and chat history never expire

`app.state.sessions` and `app.state.chat_history` (`backend/app/main.py:127-129`) are plain
dicts with no TTL/eviction. Each successful login adds an entry that's only removed on
explicit logout. For a long-running process this grows unboundedly (low risk for a
single-user local MVP, but worth a TODO before any multi-user deployment).

**Deferred, no change**: adding TTL/eviction would touch the session and chat-history data
model and several tests for a single-user local MVP where the process is short-lived and
restarted often. Left as a documented TODO for any future multi-user/long-running
deployment rather than risking churn here.

### 8. Redundant root-route / static-mount overlap

`backend/app/main.py:298-309` defines an explicit `GET /` handler *and* mounts
`StaticFiles(html=True)` at `/`. Because the explicit route is registered first, it always
wins for `/`, making the mount's own `index.html` handling for `/` unreachable dead code.
Not incorrect, just slightly confusing — consider relying on `StaticFiles(html=True)` alone
for `/`, with the explicit handler only as the scaffold fallback when
`ACTIVE_FRONTEND_DIR` doesn't exist.

**Fixed**: the explicit `/` route now only exists as the scaffold fallback (registered only
when `FRONTEND_INDEX_FILE` doesn't exist); otherwise `StaticFiles(html=True)` mounted at `/`
handles `/` directly.

### 9. Redundant status code assignment in logout

`logout` (`backend/app/main.py:166-175`) is declared with
`status_code=status.HTTP_204_NO_CONTENT` and then also sets
`response.status_code = status.HTTP_204_NO_CONTENT` manually. Harmless, but one of the two
is unnecessary.

**Fixed**: removed `status_code=status.HTTP_204_NO_CONTENT` from the route decorator,
keeping the manual `response.status_code` assignment, which is the one that actually
controls the returned status when a `Response` object is returned directly.

### 10. Stale `AGENTS.md` descriptions

`backend/AGENTS.md` and `frontend/AGENTS.md` still describe the Part 2/3 starting state
("placeholder HTML page", "Authentication does not exist yet", "Backend persistence does
not exist yet", "AI chat does not exist yet"), but Parts 4-10 have since implemented all of
this. These docs are now misleading for anyone (human or agent) using them to orient in the
codebase.

**Action**: update both files to reflect the current architecture (auth, persistence, AI
chat) or remove the now-inaccurate "Likely upcoming changes" / "Current scope" sections.

**Fixed**: rewrote both `AGENTS.md` files to describe the current architecture, layout, and
behavior (auth, persistence, AI chat, debounced saves, `PM_DB_PATH`/`PM_AI_MODE`), and
removed the stale "Likely upcoming changes" / pre-Part-4 "Current scope" sections.

## Informational (accepted MVP tradeoffs, no action required)

- No CSRF protection on `PUT /api/board`, `POST /api/ai/chat`, `POST /api/logout` — relies on
  `SameSite=Lax` cookies. Reasonable for a local-only MVP; revisit if ever exposed beyond
  localhost.
- Hardcoded `user`/`password` credentials, shown directly on the login screen — explicitly
  required by `AGENTS.md` for this MVP.
- Single SQLite connection per request, no WAL mode — fine at single-user scale; revisit
  under concurrent multi-user load.

## Test suite status

| Suite | Result |
|---|---|
| Backend (`pytest`, 24 tests) | All passing |
| Frontend unit (`vitest`, 14 tests) | All passing |
| Frontend E2E (`playwright`, 11 tests) | All passing |
| Docker build + container smoke test | Builds and serves `/`, `/api/health`, login, and board API correctly |

## Suggested fix order

1. Untrack/relocate `backend/data/pm.db` and `frontend/test-results/.last-run.json` (items 1
   and 4) — quick, removes ongoing repo noise.
2. Add the AI board-update integrity guard (item 3) — protects against real data loss.
3. Deep-copy `DEFAULT_BOARD` on the missing-board path (item 2) — cheap, removes a latent bug.
4. Debounce column-rename saves (item 5) — small UX/efficiency win.
5. Address the remaining low-priority items opportunistically.
