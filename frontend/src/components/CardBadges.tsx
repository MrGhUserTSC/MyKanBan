import type { Priority } from "@/lib/kanban";

const PRIORITY_STYLES: Record<Priority, string> = {
  low: "border-[var(--stroke)] bg-[var(--surface)] text-[var(--gray-text)]",
  medium: "border-[#f4e2ad] bg-[#fdf6e3] text-[#8a6d0b]",
  high: "border-[#f3d3d0] bg-[#fff4f2] text-[#b42318]",
};

const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const PriorityBadge = ({ priority }: { priority: Priority }) => (
  <span
    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] ${PRIORITY_STYLES[priority]}`}
    aria-label={`Priority: ${PRIORITY_LABELS[priority]}`}
  >
    {PRIORITY_LABELS[priority]}
  </span>
);

const formatDueDate = (value: string): string => {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const DueDateChip = ({ dueDate }: { dueDate: string }) => {
  if (!dueDate) {
    return null;
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-[var(--stroke)] bg-white px-2 py-0.5 text-[0.65rem] font-semibold text-[var(--navy-dark)]"
      aria-label={`Due ${formatDueDate(dueDate)}`}
    >
      Due {formatDueDate(dueDate)}
    </span>
  );
};
