"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import {
  createId,
  initialData,
  moveCard,
  moveColumn,
  type BoardData,
} from "@/lib/kanban";

type KanbanBoardProps = {
  initialBoard?: BoardData;
  onBoardChange?: (board: BoardData) => void;
  onLogout?: () => void;
  saveError?: string | null;
  saveStatus?: "idle" | "saving" | "error";
  username?: string;
};

export const KanbanBoard = ({
  initialBoard,
  onBoardChange,
  onLogout,
  saveError,
  saveStatus = "idle",
  username = "user",
}: KanbanBoardProps) => {
  const [board, setBoard] = useState<BoardData>(() => initialBoard ?? initialData);
  const [activeItem, setActiveItem] = useState<{
    id: string;
    type: "card" | "column" | null;
  }>({ id: "", type: null });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  useEffect(() => {
    if (initialBoard) {
      setBoard(initialBoard);
    }
  }, [initialBoard]);

  const cardsById = useMemo(() => board.cards, [board.cards]);
  const saveStateLabel =
    saveStatus === "saving"
      ? "Saving changes"
      : saveStatus === "error"
        ? saveError ?? "Unable to save"
        : "All changes saved";

  const updateBoard = (updater: (current: BoardData) => BoardData) => {
    setBoard((current) => {
      const nextBoard = updater(current);
      onBoardChange?.(nextBoard);
      return nextBoard;
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveItem({
      id: event.active.id as string,
      type: (event.active.data.current?.type as "card" | "column" | undefined) ?? null,
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const activeType = active.data.current?.type as "card" | "column" | undefined;
    setActiveItem({ id: "", type: null });

    if (!over || active.id === over.id) {
      return;
    }

    if (activeType === "column") {
      updateBoard((current) => ({
        ...current,
        columns: moveColumn(current.columns, active.id as string, over.id as string),
      }));
      return;
    }

    updateBoard((current) => ({
      ...current,
      columns: moveCard(current.columns, active.id as string, over.id as string),
    }));
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    updateBoard((current) => ({
      ...current,
      columns: current.columns.map((column) =>
        column.id === columnId ? { ...column, title } : column
      ),
    }));
  };

  const handleAddCard = (columnId: string, title: string, details: string) => {
    const id = createId("card");
    updateBoard((current) => ({
      ...current,
      cards: {
        ...current.cards,
        [id]: { id, title, details: details || "No details yet." },
      },
      columns: current.columns.map((column) =>
        column.id === columnId
          ? { ...column, cardIds: [...column.cardIds, id] }
          : column
      ),
    }));
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    updateBoard((current) => {
      return {
        ...current,
        cards: Object.fromEntries(
          Object.entries(current.cards).filter(([id]) => id !== cardId)
        ),
        columns: current.columns.map((column) =>
          column.id === columnId
            ? {
                ...column,
                cardIds: column.cardIds.filter((id) => id !== cardId),
              }
            : column
        ),
      };
    });
  };

  const handleUpdateCard = (cardId: string, title: string, details: string) => {
    updateBoard((current) => ({
      ...current,
      cards: {
        ...current.cards,
        [cardId]: { ...current.cards[cardId], title, details },
      },
    }));
  };

  const activeCard =
    activeItem.type === "card" && activeItem.id ? cardsById[activeItem.id] : null;

  return (
    <section className="relative min-w-0">
      <div className="flex flex-col gap-10">
        <header className="flex flex-col gap-6 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                Single Board Kanban
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
                Kanban Studio
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
                Keep momentum visible. Rename columns, drag cards between stages,
                and capture quick notes without getting buried in settings.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                Signed In
              </p>
              <p className="mt-2 text-lg font-semibold text-[var(--primary-blue)]">
                {username}
              </p>
              {onLogout ? (
                <button
                  type="button"
                  onClick={onLogout}
                  className="mt-4 rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--navy-dark)] transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
                >
                  Log out
                </button>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {board.columns.map((column) => (
              <div
                key={column.id}
                className="flex items-center gap-2 rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]"
              >
                <span className="h-2 w-2 rounded-full bg-[var(--accent-yellow)]" />
                {column.title}
              </div>
            ))}
            <div
              className={`
                rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em]
                ${
                  saveStatus === "error"
                    ? "border-[#f3d3d0] bg-[#fff4f2] text-[#b42318]"
                    : "border-[var(--stroke)] bg-white text-[var(--gray-text)]"
                }
              `}
            >
              {saveStateLabel}
            </div>
          </div>
        </header>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={board.columns.map((column) => column.id)}
            strategy={horizontalListSortingStrategy}
          >
            <section className="grid gap-6 lg:grid-cols-5">
              {board.columns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  cards={column.cardIds.map((cardId) => board.cards[cardId])}
                  onRename={handleRenameColumn}
                  onAddCard={handleAddCard}
                  onDeleteCard={handleDeleteCard}
                  onUpdateCard={handleUpdateCard}
                />
              ))}
            </section>
          </SortableContext>
          <DragOverlay>
            {activeCard ? (
              <div className="w-[260px]">
                <KanbanCardPreview card={activeCard} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </section>
  );
};
