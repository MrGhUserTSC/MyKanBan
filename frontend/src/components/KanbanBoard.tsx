"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
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
  AlertIcon,
  CheckIcon,
  LayoutIcon,
  LogoutIcon,
  SpinnerIcon,
  UserIcon,
} from "@/components/icons";
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
      <div className="flex flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-[var(--stroke)] bg-white/80 px-6 py-5 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--secondary-purple)] text-white">
              <LayoutIcon className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-semibold leading-tight text-[var(--navy-dark)]">
                Kanban Studio
              </h1>
              <p className="text-xs font-medium text-[var(--gray-text)]">
                {board.columns.length} columns · {Object.keys(board.cards).length} cards
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div
              className={clsx(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
                saveStatus === "error"
                  ? "border-[#f3d3d0] bg-[#fff4f2] text-[#b42318]"
                  : "border-[var(--stroke)] bg-white text-[var(--gray-text)]"
              )}
              title={saveStateLabel}
            >
              {saveStatus === "saving" ? (
                <SpinnerIcon className="h-3.5 w-3.5" />
              ) : saveStatus === "error" ? (
                <AlertIcon className="h-3.5 w-3.5" />
              ) : (
                <CheckIcon className="h-3.5 w-3.5 text-[var(--primary-blue)]" />
              )}
              <span className="hidden sm:inline">{saveStateLabel}</span>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-[var(--stroke)] bg-[var(--surface)] px-3 py-1.5">
              <UserIcon className="h-4 w-4 text-[var(--primary-blue)]" />
              <span className="text-sm font-semibold text-[var(--navy-dark)]">
                {username}
              </span>
            </div>

            {onLogout ? (
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-2 rounded-full border border-[var(--stroke)] px-3 py-1.5 text-xs font-semibold text-[var(--navy-dark)] transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
              >
                <LogoutIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Log out</span>
              </button>
            ) : null}
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
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
