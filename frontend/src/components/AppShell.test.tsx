import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/AppShell";
import { initialData } from "@/lib/kanban";

const fetchMock = vi.fn();

describe("AppShell", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("shows the login screen when no active session exists", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false });

    render(<AppShell />);

    expect(
      await screen.findByRole("heading", {
        name: /log in to open your kanban board/i,
      })
    ).toBeInTheDocument();
  });

  it("shows an error when login fails", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false });
    fetchMock.mockResolvedValueOnce({ ok: false });

    render(<AppShell />);

    await screen.findByRole("heading", {
      name: /log in to open your kanban board/i,
    });
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(
      await screen.findByText(/use username "user" and password "password"/i)
    ).toBeInTheDocument();
  });

  it("renders the board after a successful login", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ username: "user" }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => initialData,
    });

    render(<AppShell />);

    await screen.findByRole("heading", {
      name: /log in to open your kanban board/i,
    });
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(
      await screen.findByRole("heading", { name: "Kanban Studio" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /board chat/i })
    ).toBeInTheDocument();
  });

  it("logs out back to the sign-in screen", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ username: "user" }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => initialData,
    });
    fetchMock.mockResolvedValueOnce({ ok: true });

    render(<AppShell />);

    await screen.findByRole("heading", { name: "Kanban Studio" });
    await userEvent.click(screen.getByRole("button", { name: /log out/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          name: /log in to open your kanban board/i,
        })
      ).toBeInTheDocument();
    });
  });

  it("shows a board load message for an active session", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ username: "user" }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => initialData,
    });

    render(<AppShell />);

    expect(
      await screen.findByRole("heading", { name: "Kanban Studio" })
    ).toBeInTheDocument();
  });

  it("shows assistant replies and updates the board from chat", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ username: "user" }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => initialData,
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        reply: "I added the card.",
        updated: true,
        board: {
          ...initialData,
          columns: [
            {
              ...initialData.columns[0],
              cardIds: [...initialData.columns[0].cardIds, "card-new"],
            },
            ...initialData.columns.slice(1),
          ],
          cards: {
            ...initialData.cards,
            "card-new": {
              id: "card-new",
              title: "AI card",
              details: "Created by the assistant.",
            },
          },
        },
      }),
    });

    render(<AppShell />);

    await screen.findByRole("heading", { name: "Kanban Studio" });
    await userEvent.type(
      screen.getByPlaceholderText(/ask the assistant/i),
      "Create a card"
    );
    await userEvent.click(screen.getByRole("button", { name: /send message/i }));

    expect(await screen.findByText("I added the card.")).toBeInTheDocument();
    expect(screen.getByText("AI card")).toBeInTheDocument();
  });
});
