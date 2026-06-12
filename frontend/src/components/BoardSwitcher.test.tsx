import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BoardSwitcher } from "@/components/BoardSwitcher";
import type { BoardSummary } from "@/lib/api";

const boards: BoardSummary[] = [
  { id: 1, name: "Roadmap", position: 0, created_at: "t", updated_at: "t" },
  { id: 2, name: "Sprint", position: 1, created_at: "t", updated_at: "t" },
];

const renderSwitcher = (overrides: Partial<Parameters<typeof BoardSwitcher>[0]> = {}) => {
  const props = {
    boards,
    activeBoardId: 1,
    onSelect: vi.fn(),
    onCreate: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  render(<BoardSwitcher {...props} />);
  return props;
};

describe("BoardSwitcher", () => {
  it("lists boards and reflects the active selection", () => {
    renderSwitcher();
    const select = screen.getByLabelText(/select board/i) as HTMLSelectElement;

    expect(select.value).toBe("1");
    expect(screen.getByRole("option", { name: "Roadmap" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Sprint" })).toBeInTheDocument();
  });

  it("calls onSelect when a different board is chosen", async () => {
    const props = renderSwitcher();

    await userEvent.selectOptions(screen.getByLabelText(/select board/i), "2");

    expect(props.onSelect).toHaveBeenCalledWith(2);
  });

  it("creates a board through the inline form", async () => {
    const props = renderSwitcher();

    await userEvent.click(screen.getByRole("button", { name: /new board/i }));
    await userEvent.type(screen.getByLabelText(/new board name/i), "Backlog");
    await userEvent.click(screen.getByRole("button", { name: /^create$/i }));

    expect(props.onCreate).toHaveBeenCalledWith("Backlog");
  });

  it("does not create a board for a blank name", async () => {
    const props = renderSwitcher();

    await userEvent.click(screen.getByRole("button", { name: /new board/i }));
    await userEvent.type(screen.getByLabelText(/new board name/i), "   ");
    await userEvent.click(screen.getByRole("button", { name: /^create$/i }));

    expect(props.onCreate).not.toHaveBeenCalled();
  });

  it("renames the active board, pre-filling its current name", async () => {
    const props = renderSwitcher();

    await userEvent.click(screen.getByRole("button", { name: /rename/i }));
    const input = screen.getByLabelText(/board name/i) as HTMLInputElement;
    expect(input.value).toBe("Roadmap");

    await userEvent.clear(input);
    await userEvent.type(input, "Roadmap 2026");
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(props.onRename).toHaveBeenCalledWith(1, "Roadmap 2026");
  });

  it("deletes the active board", async () => {
    const props = renderSwitcher();

    await userEvent.click(screen.getByRole("button", { name: /delete/i }));

    expect(props.onDelete).toHaveBeenCalledWith(1);
  });

  it("disables delete when only one board remains", () => {
    renderSwitcher({ boards: [boards[0]] });

    expect(screen.getByRole("button", { name: /delete/i })).toBeDisabled();
  });
});
