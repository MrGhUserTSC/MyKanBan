# Frontend app description

This directory contains the existing frontend-only MVP demo for the project management app. It is a Next.js app using the App Router and currently runs as a standalone client-side experience.

## Current purpose

- Render a single Kanban board at `/`.
- Allow users to rename columns inline.
- Allow users to add cards to any column.
- Allow users to remove cards.
- Allow users to drag cards within a column and across columns.
- Provide a polished visual baseline that should be preserved as we integrate the backend.

## Current architecture

- `src/app/page.tsx` renders `KanbanBoard` directly.
- `src/components/KanbanBoard.tsx` owns the full board state in React component state.
- `src/lib/kanban.ts` defines the board types, demo data, card move helper, and id creation helper.
- `src/components/KanbanColumn.tsx` renders a column, inline title editing, droppable area, and new-card form.
- `src/components/KanbanCard.tsx` renders sortable cards with a remove action.
- `src/components/NewCardForm.tsx` manages the add-card inline form.
- `src/app/layout.tsx` sets up metadata and Google fonts.
- `src/app/globals.css` defines the shared color tokens and global styling.

## Libraries in use

- Next.js 16 with React 19.
- Tailwind CSS 4.
- `@dnd-kit` for drag-and-drop and sortable card behavior.
- Vitest and Testing Library for unit tests.
- Playwright for browser end-to-end tests.

## Current data model

The board is entirely local in the browser today.

- `BoardData`
- `columns: Column[]`
- `cards: Record<string, Card>`

Each column stores ordered `cardIds`, which is important to preserve when moving to backend persistence. The current frontend already assumes exactly five starting columns in the demo data, but the code itself renders whatever columns exist in the board object.

## Current behavior

- The board is initialized from `initialData` in `src/lib/kanban.ts`.
- Column titles are editable through controlled inline inputs backed by React state updates.
- New cards are created locally with generated ids.
- Empty card details fall back to `No details yet.`
- Card deletion removes the card from both the card map and the containing column.
- Card drag-and-drop works within a column and between columns.
- Column drag-and-drop does not exist yet.
- Card editing does not exist yet beyond delete and move.
- Authentication does not exist yet.
- Backend persistence does not exist yet.
- AI chat does not exist yet.

## Existing tests

- `src/lib/kanban.test.ts` covers core board helper behavior.
- `src/components/KanbanBoard.test.tsx` covers rendering, column rename, and add/remove card flows.
- `tests/kanban.spec.ts` covers page load, adding a card, and dragging a card between columns.

## Constraints to keep in mind when extending

- Preserve the existing visual direction unless a later task explicitly changes it.
- Keep the component structure simple; this app does not need heavy abstractions.
- When backend integration starts, prefer adapting the current board model instead of replacing it unnecessarily.
- When auth is added, use backend-issued session state rather than local-only gating.
- When persistence is added, make backend state the source of truth.
- When AI is added, board updates should apply automatically after a valid backend response.

## Likely upcoming frontend changes

- Add login UI and authenticated app bootstrapping.
- Add column reordering support.
- Add card editing support.
- Replace local board initialization with backend fetch and save flows.
- Add sidebar chat UI for AI interactions.
- Add loading and error handling around network operations.
