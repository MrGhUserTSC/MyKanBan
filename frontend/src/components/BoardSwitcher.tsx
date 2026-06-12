"use client";

import { FormEvent, useState } from "react";
import { PencilIcon, PlusIcon, TrashIcon } from "@/components/icons";
import type { BoardSummary } from "@/lib/api";

type BoardSwitcherProps = {
  boards: BoardSummary[];
  activeBoardId: number | null;
  onSelect: (boardId: number) => void;
  onCreate: (name: string) => void;
  onRename: (boardId: number, name: string) => void;
  onDelete: (boardId: number) => void;
};

type Mode = "idle" | "creating" | "renaming";

const controlClass =
  "flex items-center gap-1.5 rounded-full border border-[var(--stroke)] px-3 py-1.5 text-xs font-semibold text-[var(--navy-dark)] transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)] disabled:cursor-not-allowed disabled:opacity-50";

export const BoardSwitcher = ({
  boards,
  activeBoardId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: BoardSwitcherProps) => {
  const [mode, setMode] = useState<Mode>("idle");
  const [draft, setDraft] = useState("");

  const activeBoard = boards.find((board) => board.id === activeBoardId) ?? null;

  const startCreating = () => {
    setDraft("");
    setMode("creating");
  };

  const startRenaming = () => {
    setDraft(activeBoard?.name ?? "");
    setMode("renaming");
  };

  const cancel = () => {
    setMode("idle");
    setDraft("");
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = draft.trim();
    if (!name) {
      return;
    }
    if (mode === "creating") {
      onCreate(name);
    } else if (mode === "renaming" && activeBoardId !== null) {
      onRename(activeBoardId, name);
    }
    cancel();
  };

  if (mode !== "idle") {
    return (
      <form onSubmit={submit} className="flex items-center gap-2">
        <input
          autoFocus
          aria-label={mode === "creating" ? "New board name" : "Board name"}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={mode === "creating" ? "Board name" : undefined}
          className="w-44 rounded-full border border-[var(--stroke)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
        />
        <button
          type="submit"
          className="rounded-full bg-[var(--secondary-purple)] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
        >
          {mode === "creating" ? "Create" : "Save"}
        </button>
        <button type="button" onClick={cancel} className={controlClass}>
          Cancel
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="board-select">
        Select board
      </label>
      <select
        id="board-select"
        aria-label="Select board"
        value={activeBoardId ?? ""}
        onChange={(event) => onSelect(Number(event.target.value))}
        className="rounded-full border border-[var(--stroke)] bg-[var(--surface)] px-3 py-1.5 text-sm font-semibold text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
      >
        {boards.map((board) => (
          <option key={board.id} value={board.id}>
            {board.name}
          </option>
        ))}
      </select>

      <button type="button" onClick={startCreating} className={controlClass}>
        <PlusIcon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">New board</span>
      </button>
      <button
        type="button"
        onClick={startRenaming}
        disabled={!activeBoard}
        className={controlClass}
      >
        <PencilIcon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Rename</span>
      </button>
      <button
        type="button"
        onClick={() => activeBoardId !== null && onDelete(activeBoardId)}
        disabled={boards.length <= 1}
        title={boards.length <= 1 ? "You need at least one board" : "Delete this board"}
        className={controlClass}
      >
        <TrashIcon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Delete</span>
      </button>
    </div>
  );
};
