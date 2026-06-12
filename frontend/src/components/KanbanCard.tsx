import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { useState, type FormEvent } from "react";
import {
  cardPriority,
  PRIORITIES,
  type Card,
  type CardMeta,
  type Priority,
} from "@/lib/kanban";
import { PencilIcon, TrashIcon } from "@/components/icons";
import { DueDateChip, PriorityBadge } from "@/components/CardBadges";

type KanbanCardProps = {
  card: Card;
  onDelete: (cardId: string) => void;
  onUpdate: (
    cardId: string,
    title: string,
    details: string,
    meta: CardMeta
  ) => void;
};

export const KanbanCard = ({ card, onDelete, onUpdate }: KanbanCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(card.title);
  const [details, setDetails] = useState(card.details);
  const [priority, setPriority] = useState<Priority>(cardPriority(card));
  const [dueDate, setDueDate] = useState(card.dueDate ?? "");
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id, disabled: isEditing, data: { type: "card" } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!title.trim()) {
      return;
    }

    onUpdate(card.id, title.trim(), details.trim() || "No details yet.", {
      priority,
      dueDate,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTitle(card.title);
    setDetails(card.details);
    setPriority(cardPriority(card));
    setDueDate(card.dueDate ?? "");
    setIsEditing(false);
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx(
        "overflow-hidden rounded-2xl border border-transparent bg-white shadow-[0_12px_24px_rgba(3,33,71,0.08)]",
        "transition-all duration-150",
        isDragging && "opacity-60 shadow-[0_18px_32px_rgba(3,33,71,0.16)]"
      )}
      data-testid={`card-${card.id}`}
    >
      {isEditing ? (
        <form className="space-y-3 p-4" onSubmit={handleSubmit}>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-xl border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
            aria-label={`Edit title for ${card.title}`}
          />
          <textarea
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            rows={3}
            className="w-full resize-none rounded-xl border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--gray-text)] outline-none transition focus:border-[var(--primary-blue)]"
            aria-label={`Edit details for ${card.title}`}
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as Priority)}
              aria-label={`Edit priority for ${card.title}`}
              className="rounded-xl border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
            >
              {PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {value.charAt(0).toUpperCase() + value.slice(1)}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              aria-label={`Edit due date for ${card.title}`}
              className="rounded-xl border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-full bg-[var(--secondary-purple)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110"
            >
              Save
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-full border border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="min-w-0">
          <div
            className="group flex h-8 cursor-grab items-center px-4 active:cursor-grabbing"
            aria-label={`Drag ${card.title}`}
            data-testid={`card-drag-handle-${card.id}`}
            {...attributes}
            {...listeners}
          >
            <div className="h-1.5 w-full rounded-full bg-transparent transition group-hover:bg-[rgba(32,157,215,0.14)]" />
          </div>
          <div className="min-w-0 px-4 pb-4">
            <div className="min-w-0">
              <h4
                className="overflow-hidden text-ellipsis whitespace-nowrap font-display text-[clamp(0.82rem,0.7rem+0.35vw,0.98rem)] font-semibold leading-tight text-[var(--navy-dark)]"
                title={card.title}
              >
                {card.title}
              </h4>
              <p
                className="mt-2 overflow-hidden break-words text-sm leading-6 text-[var(--gray-text)]"
                title={card.details}
              >
                {card.details}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <PriorityBadge priority={cardPriority(card)} />
                {card.dueDate ? <DueDateChip dueDate={card.dueDate} /> : null}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-end gap-1 border-t border-[var(--stroke)] pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-[var(--gray-text)] transition hover:border-[var(--stroke)] hover:text-[var(--primary-blue)]"
                aria-label={`Edit ${card.title}`}
                title={`Edit ${card.title}`}
              >
                <PencilIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(card.id)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-[var(--gray-text)] transition hover:border-[var(--stroke)] hover:text-[#b42318]"
                aria-label={`Delete ${card.title}`}
                title={`Delete ${card.title}`}
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
};
