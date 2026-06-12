import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/AppShell";
import { initialData } from "@/lib/kanban";

const fetchMock = vi.fn();

const boardSummary = {
  id: 1,
  name: "Product Roadmap",
  position: 0,
  created_at: "2026-01-01T00:00:00+00:00",
  updated_at: "2026-01-01T00:00:00+00:00",
};

const ok = (json: unknown) => ({ ok: true, json: async () => json });
const fail = (json: unknown = null) => ({ ok: false, json: async () => json });

// Convenience: queue the three fetches an authenticated session bootstraps with.
const queueAuthenticatedBootstrap = () => {
  fetchMock.mockResolvedValueOnce(ok({ username: "user" })); // GET /api/session
  fetchMock.mockResolvedValueOnce(ok([boardSummary])); // GET /api/boards
  fetchMock.mockResolvedValueOnce(ok(initialData)); // GET /api/boards/1
};

describe("AppShell", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("shows the login screen when no active session exists", async () => {
    fetchMock.mockResolvedValueOnce(fail());

    render(<AppShell />);

    expect(
      await screen.findByRole("heading", {
        name: /log in to open your kanban board/i,
      })
    ).toBeInTheDocument();
  });

  it("shows an error when login fails", async () => {
    fetchMock.mockResolvedValueOnce(fail()); // session
    fetchMock.mockResolvedValueOnce(fail({ detail: "Invalid credentials." })); // login

    render(<AppShell />);

    await screen.findByRole("heading", {
      name: /log in to open your kanban board/i,
    });
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(
      await screen.findByText(/invalid credentials/i)
    ).toBeInTheDocument();
  });

  it("renders the board after a successful login", async () => {
    fetchMock.mockResolvedValueOnce(fail()); // session
    fetchMock.mockResolvedValueOnce(ok({ username: "user" })); // login
    fetchMock.mockResolvedValueOnce(ok([boardSummary])); // boards list
    fetchMock.mockResolvedValueOnce(ok(initialData)); // board content

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

  it("lets a new user switch to the registration form", async () => {
    fetchMock.mockResolvedValueOnce(fail()); // session

    render(<AppShell />);

    await screen.findByRole("heading", {
      name: /log in to open your kanban board/i,
    });
    await userEvent.click(
      screen.getByRole("button", { name: /need an account/i })
    );

    expect(
      await screen.findByRole("heading", { name: /create your account/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^create account$/i })
    ).toBeInTheDocument();
    // The registration form starts blank rather than inheriting the demo defaults.
    expect(screen.getByLabelText(/username/i)).toHaveValue("");
    expect(screen.getByLabelText(/password/i)).toHaveValue("");
  });

  it("registers a new account and loads its board", async () => {
    fetchMock.mockResolvedValueOnce(fail()); // session
    fetchMock.mockResolvedValueOnce(ok({ username: "alice" })); // register
    fetchMock.mockResolvedValueOnce(ok([{ ...boardSummary, name: "My Board" }])); // boards
    fetchMock.mockResolvedValueOnce(ok(initialData)); // board content

    render(<AppShell />);

    await screen.findByRole("heading", {
      name: /log in to open your kanban board/i,
    });
    await userEvent.click(
      screen.getByRole("button", { name: /need an account/i })
    );
    await userEvent.click(
      screen.getByRole("button", { name: /^create account$/i })
    );

    expect(
      await screen.findByRole("heading", { name: "Kanban Studio" })
    ).toBeInTheDocument();
  });

  it("shows the board switcher with the active board selected", async () => {
    queueAuthenticatedBootstrap();

    render(<AppShell />);

    await screen.findByRole("heading", { name: "Kanban Studio" });

    const select = (await screen.findByLabelText(
      /select board/i
    )) as HTMLSelectElement;
    expect(select.value).toBe("1");
    expect(
      screen.getByRole("option", { name: "Product Roadmap" })
    ).toBeInTheDocument();
  });

  it("logs out back to the sign-in screen", async () => {
    queueAuthenticatedBootstrap();
    fetchMock.mockResolvedValueOnce(ok(null)); // logout

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

  it("shows assistant replies and updates the board from chat", async () => {
    queueAuthenticatedBootstrap();
    fetchMock.mockResolvedValueOnce(
      ok({
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
      })
    );

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
