# Frontend app description

This directory contains the Next.js frontend for the Project Management MVP. It is
statically exported (`output: "export"`) and served by the FastAPI backend at `/`.

## Current purpose

- Require login before showing the board, using a real backend-issued session.
- Render a single Kanban board backed by the authenticated user's persisted board.
- Allow users to rename and reorder columns.
- Allow users to add, edit, move, and remove cards via drag-and-drop or forms.
- Provide an AI chat sidebar that can summarize the board or trigger automatic board updates.

## Current architecture

- `src/app/page.tsx` renders `AppShell`.
- `src/components/AppShell.tsx` owns session bootstrapping, board loading/saving, and
  chat state; it renders the login screen, loading states, or the authenticated board + chat
  layout.
- `src/components/KanbanBoard.tsx` owns the in-memory board state for the current session and
  reports changes back to `AppShell` via `onBoardChange`.
- `src/lib/kanban.ts` defines the board types, demo data, card/column move helpers, and id
  creation helper.
- `src/components/KanbanColumn.tsx` renders a column, inline title editing, column drag
  handle, droppable card area, and new-card form.
- `src/components/KanbanCard.tsx` renders sortable cards with inline edit and delete actions.
- `src/components/KanbanCardPreview.tsx` renders the drag overlay preview for a card.
- `src/components/NewCardForm.tsx` manages the add-card inline form.
- `src/components/AIChatSidebar.tsx` renders the chat UI and message list.
- `src/app/layout.tsx` sets up metadata and Google fonts.
- `src/app/globals.css` defines the shared color tokens and global styling.

## Libraries in use

- Next.js 16 with React 19.
- Tailwind CSS 4.
- `@dnd-kit` for drag-and-drop and sortable card/column behavior.
- Vitest and Testing Library for unit tests.
- Playwright for browser end-to-end tests.

## Current data model

- `BoardData`
- `columns: Column[]`
- `cards: Record<string, Card>`

Each column stores ordered `cardIds`. The backend persists this exact shape as one JSON
blob per user.

## Current behavior

- On load, `AppShell` checks `/api/session`; if unauthenticated, it shows the login screen.
- After login, the board is fetched from `/api/board` and used as `KanbanBoard`'s
  `initialBoard`.
- Any board change (rename, reorder, add/edit/delete/move card) is saved to the backend via a
  debounced `PUT /api/board`, serialized through a save queue.
- The AI chat sidebar posts to `/api/ai/chat`; the response always includes the current board
  state, which replaces local board state if the AI applied an update.
- Logout calls `/api/logout` and resets all local board/chat state.

## Existing tests

- `src/lib/kanban.test.ts` covers core board helper behavior.
- `src/components/KanbanBoard.test.tsx` covers rendering, column rename, and add/remove/edit
  card flows.
- `src/components/AppShell.test.tsx` covers auth gating, login/logout, board loading, and AI
  chat behavior.
- `tests/kanban.spec.ts` covers the full browser journey: login, board load, manual board
  edits with persistence, logout, and AI chat (against a backend stub AI mode).

## Constraints to keep in mind when extending

- Preserve the existing visual direction unless a later task explicitly changes it.
- Keep the component structure simple; this app does not need heavy abstractions.
- Backend state is the source of truth; local state should always reconcile with API
  responses.
- AI-driven board updates apply automatically with no confirmation step.
