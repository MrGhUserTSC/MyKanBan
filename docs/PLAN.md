# Project Plan

This document is the execution plan for the Project Management MVP. Each part includes concrete tasks, required tests, success criteria, and approval checkpoints where needed.

## Working agreements

- Keep the implementation simple and local-first.
- Prove root cause before fixing issues.
- Preserve the existing frontend design language unless a later task explicitly changes it.
- Prefer one clear path over optional abstractions.
- Pause for approval at the checkpoints called out below before continuing.

## Part 1: Plan and project documentation

Goal: establish an approved implementation plan and document the current frontend starting point.

Checklist

- [x] Review root `AGENTS.md`.
- [x] Review the existing `docs/PLAN.md`.
- [x] Review the current frontend structure and behavior.
- [x] Clarify product decisions that affect architecture.
- [x] Expand this plan with detailed steps, tests, and success criteria.
- [x] Add `frontend/AGENTS.md` describing the current frontend app.
- [x] Get user approval on this plan before starting Part 2.

Tests

- Manual review of this file for completeness and sequencing.
- Manual review of `frontend/AGENTS.md` for accuracy against the current codebase.

Success criteria

- The plan is detailed enough to execute without guessing.
- Approval checkpoints are explicit.
- The frontend starting point is documented accurately.

Approval checkpoint

- Required before Part 2 begins.

## Part 2: Scaffolding

Goal: create the local containerized application skeleton with a FastAPI backend and startup scripts.

Checklist

- [x] Decide the single-container layout for backend, built frontend assets, and local SQLite storage.
- [x] Create backend project files using `uv`.
- [x] Add a minimal FastAPI app with:
- [x] `GET /api/health` returning a simple JSON response.
- [x] root `/` serving a temporary hello-world page or simple placeholder content.
- [x] Add Dockerfile and supporting container config.
- [x] Add start and stop scripts for Windows, macOS, and Linux in `scripts/`.
- [x] Ensure environment variables are loaded in a simple, explicit way.
- [x] Document how to run the scaffold locally in a minimal README update if needed.

Tests

- Backend unit test for `GET /api/health`.
- Local integration test proving the container starts and the API responds.
- Manual verification that `/` renders placeholder content from the container.
- Manual verification that the provided scripts start and stop the stack.

Success criteria

- The app starts locally through the scripts.
- FastAPI serves both `/api/health` and `/`.
- The container builds without extra manual steps.

Approval checkpoint

- Pause if the simplest container layout is not obvious from the implementation.

## Part 3: Add in frontend

Goal: serve the existing frontend through the backend and keep the current Kanban demo working.

Checklist

  - [x] Decide the simplest production build flow for Next.js static output and FastAPI static serving.
  - [x] Adapt the frontend build configuration for static serving if required.
  - [x] Wire the Docker build so frontend assets are built and copied into the backend image.
  - [x] Update FastAPI to serve the built frontend at `/`.
  - [x] Confirm the current board still renders with the same design and interactions.
  - [x] Add or update tests for the integrated serving path.

Tests

- Frontend unit tests continue to pass.
- Browser E2E test loads `/` from the integrated app.
- Integration test confirms FastAPI serves the generated static assets.

Success criteria

- Visiting `/` in the running app shows the current Kanban board.
- The frontend is no longer a standalone-only demo.
- Build and test flow remains straightforward.

Approval checkpoint

- Pause if static export creates meaningful tradeoffs versus serving a built Next output another way.

## Part 4: Fake user sign-in experience

Goal: require login before showing the board, using real backend-issued sessions.

Checklist

  - [x] Choose a minimal backend session approach suitable for a local MVP.
  - [x] Add backend login and logout routes.
  - [x] Hardcode the MVP credentials to `user` and `password`.
  - [x] Add session validation route or equivalent authenticated bootstrap flow.
  - [x] Create a login page or login state in the frontend.
  - [x] Protect the board route or initial app load behind authentication.
  - [x] Add logout UI.
  - [x] Ensure unauthenticated users cannot access board data endpoints.

Tests

- Backend unit tests for successful login, failed login, session validation, and logout.
- Frontend unit tests for login form behavior and auth gating.
- Browser E2E tests for:
  - [x] redirect or gated access when logged out.
  - [x] successful login with valid credentials.
  - [x] failed login with invalid credentials.
  - [x] logout returning the user to the sign-in experience.

Success criteria

- The board is inaccessible without a valid session.
- Logging in uses the backend, not local-only frontend state.
- Logging out clears access cleanly.

Approval checkpoint

- Pause if cookie/session implementation needs a non-obvious security or architecture choice.

## Part 5: Database modeling

Goal: define and document the persisted board model before building the full data API.

Checklist

- [x] Propose a simple SQLite schema supporting multiple users.
- [x] Store one JSON blob per user board.
- [x] Include fields needed for sessions if session storage is persisted in SQLite.
- [x] Decide the migration/bootstrap strategy for a missing database file.
- [x] Document the schema, persistence approach, and tradeoffs in `docs/`.
- [x] Include sample stored board JSON shape.
- [ ] Get user sign-off before implementation continues.

Tests

- Design review against product requirements.
- Manual validation that the schema supports:
- [x] one board per user.
- [x] ordered columns.
- [x] ordered cards inside columns.
- [x] future multi-user support.

Success criteria

- The schema is simple, explicit, and sufficient for MVP needs.
- The persistence format matches the agreed JSON-blob approach.
- The user approves the documented data model before Part 6.

Approval checkpoint

- Required before Part 6 begins.

## Part 6: Backend API

Goal: implement persistent board read/write APIs backed by SQLite.

Checklist

- [x] Create database initialization logic that creates the database if it does not exist.
- [x] Implement minimal data access layer for users, sessions if needed, and boards.
- [x] Seed or initialize the default board for the MVP user.
- [x] Add authenticated API routes to fetch the current user's board.
- [x] Add authenticated API routes to replace or update the current user's board.
- [x] Validate request payloads with simple Pydantic models.
- [x] Handle missing or invalid session states cleanly.
- [x] Keep board mutation logic simple and centralized.

Tests

- Backend unit tests for database initialization and data access helpers.
- Backend API tests for:
- [x] reading the board.
- [x] updating the board.
- [x] unauthorized access rejection.
- [x] initial board creation when missing.
- Integration tests using a temporary SQLite database.

Success criteria

- The backend can persist and return a board for the logged-in user.
- A new local environment creates the database automatically.
- Unauthorized requests are blocked consistently.

Approval checkpoint

- Pause if the board update contract between frontend and backend requires a non-obvious API shape.

## Part 7: Frontend and backend integration

Goal: connect the UI to the persistent backend so the board is no longer local-only.

Checklist

- [x] Replace in-memory board bootstrapping with authenticated backend fetches.
- [x] Persist column rename changes through the API.
- [x] Persist column reorder changes through the API.
- [x] Persist card create, edit, move, and delete flows through the API.
- [x] Add loading, saving, and basic error states without overbuilding.
- [x] Ensure the login and board flows work end-to-end in the containerized app.

Tests

- Frontend unit tests for data-loading and mutation behavior where practical.
- Integration tests for API contract compatibility.
- Browser E2E tests covering:
- [x] login then load persisted board.
- [x] rename a column and confirm persistence.
- [x] reorder columns and confirm persistence.
- [x] add, move, edit, and delete cards with persistence across reloads.

Success criteria

- Reloading the page preserves board changes.
- The UI uses backend state as the source of truth.
- Core Kanban interactions remain smooth and understandable.

Approval checkpoint

- Pause if the frontend state model needs a significant redesign to support persistence cleanly.

## Part 8: AI connectivity

Goal: prove backend connectivity to OpenRouter with the target model.

Checklist

- [x] Add backend configuration for `OPENROUTER_API_KEY`.
- [x] Add a small OpenRouter client wrapper.
- [x] Configure the model as `openai/gpt-oss-120b`.
- [x] Implement a minimal backend AI test path or internal service call.
- [x] Verify a simple prompt such as `2+2`.
- [x] Keep logging safe and avoid leaking secrets.

Tests

- Unit tests for request construction with mocked HTTP responses.
- Integration test with mocked OpenRouter response.
- Manual connectivity verification against the live service when credentials are available.

Success criteria

- The backend can successfully call OpenRouter with the configured model.
- Failures are surfaced clearly enough to debug without guesswork.

Approval checkpoint

- Pause if OpenRouter integration requires a meaningful SDK-versus-raw-HTTP decision.

## Part 9: AI board-aware backend workflow

Goal: send the board state and chat context to the model and receive structured outputs that may update the board.

Checklist

- [x] Define a simple structured output schema containing:
- [x] assistant response text.
- [x] optional board update payload.
- [x] Add backend prompt construction that includes:
- [x] current board JSON.
- [x] user message.
- [x] in-memory session conversation history.
- [x] Parse and validate structured model responses.
- [x] Apply optional board updates safely to the stored board.
- [x] Return both assistant text and updated board state to the frontend.
- [x] Keep the behavior deterministic enough for testing with mocked responses.

Tests

- Unit tests for prompt assembly.
- Unit tests for structured output parsing and validation.
- Backend integration tests for:
- [x] response-only AI output.
- [x] AI output that updates the board.
- [x] malformed AI output handling.
- [x] per-session in-memory conversation history behavior.

Success criteria

- The backend always sends board context and conversation context.
- Structured outputs are validated before any persistence occurs.
- Valid AI board updates are applied automatically.

Approval checkpoint

- Required before locking the structured output contract if tradeoffs appear in the schema shape.

## Part 10: AI sidebar in the UI

Goal: add the chat sidebar and reflect AI-driven board updates in the live board UI.

Checklist

- [x] Design and build a sidebar chat interface that fits the current visual system.
- [x] Add frontend message state and request handling.
- [x] Show assistant responses in the sidebar.
- [x] Trigger backend AI requests with the current user session.
- [x] Refresh or reconcile board state automatically when AI updates are returned.
- [x] Keep the manual Kanban interactions working alongside AI updates.
- [x] Add basic empty, loading, and error states.

Tests

- Frontend unit tests for chat UI behavior where practical.
- Integration tests for sidebar request and response handling.
- Browser E2E tests covering:
- [x] sending a chat message.
- [x] showing the assistant reply.
- [x] applying AI-driven board updates with no confirmation step.
- [x] board UI reflecting the update automatically.

Success criteria

- The user can chat with the assistant from the board screen.
- AI responses appear in the sidebar.
- AI-generated board changes show up in the board automatically.
- Browser E2E coverage remains deterministic even when the live model is slow or malformed.

Approval checkpoint

- Pause if the chat UX requires a major product decision beyond the agreed MVP.

## Cross-cutting test expectations

- Keep existing frontend unit and Playwright coverage healthy as the app evolves.
- Add backend unit tests for business logic and API behavior as features land.
- Prefer integration tests around real FastAPI routes and temporary SQLite databases.
- Maintain browser-level E2E coverage for the primary user journey:
- [x] login.
- [x] board load.
- [x] manual board changes.
- [x] AI-assisted board changes.

## Open decisions already resolved

- Columns can be renamed and reordered.
- AI updates apply directly with no user confirmation step.
- Sessions are backend-issued from the start.
- The board is stored as one JSON blob per user board.
- Chat history is in-memory per session for MVP.
- Browser-level E2E coverage is required in addition to unit and integration tests.
- Approval checkpoints are required at Part 5 and other major architecture decisions.
- Root `.env` is loaded explicitly by the backend for local and test entry points.
- OpenRouter requests use a longer backend timeout because structured board updates can take materially longer than simple prompts.
- Playwright E2E uses a backend stub AI mode only during automated browser tests so the suite is deterministic; normal app runs still use live OpenRouter.
