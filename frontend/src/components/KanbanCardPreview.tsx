import { cardPriority, type Card } from "@/lib/kanban";
import { DueDateChip, PriorityBadge } from "@/components/CardBadges";

type KanbanCardPreviewProps = {
  card: Card;
};

export const KanbanCardPreview = ({ card }: KanbanCardPreviewProps) => (
  <article className="overflow-hidden rounded-2xl border border-transparent bg-white shadow-[0_18px_32px_rgba(3,33,71,0.16)]">
    <div className="h-8 px-4 pt-3">
      <div className="h-1.5 w-full rounded-full bg-[rgba(32,157,215,0.14)]" />
    </div>
    <div className="min-w-0 px-4 pb-4">
      <div className="min-w-0">
        <h4
          className="overflow-hidden text-ellipsis whitespace-nowrap font-display text-[clamp(0.82rem,0.7rem+0.35vw,0.98rem)] font-semibold leading-tight text-[var(--navy-dark)]"
          title={card.title}
        >
          {card.title}
        </h4>
        <p className="mt-2 overflow-hidden break-words text-sm leading-6 text-[var(--gray-text)]">
          {card.details}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <PriorityBadge priority={cardPriority(card)} />
          {card.dueDate ? <DueDateChip dueDate={card.dueDate} /> : null}
        </div>
      </div>
    </div>
  </article>
);
