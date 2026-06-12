"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { AIChatSidebar, type ChatMessage } from "@/components/AIChatSidebar";
import { KanbanBoard } from "@/components/KanbanBoard";
import { LayoutIcon, SpinnerIcon } from "@/components/icons";
import type { BoardData } from "@/lib/kanban";
import {
  type BoardSummary,
  createBoard,
  deleteBoard,
  fetchBoard,
  fetchSession,
  listBoards,
  login,
  logout,
  register,
  renameBoard,
  saveBoard,
  sendChat,
} from "@/lib/api";

type AuthState =
  | { status: "loading" }
  | { status: "unauthenticated"; error: string | null }
  | { status: "authenticated"; username: string };

type AuthMode = "login" | "register";

type SaveState = {
  message: string | null;
  status: "idle" | "saving" | "error";
};

const BOARD_SAVE_DEBOUNCE_MS = 400;

const createMessageId = () =>
  `msg-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36)}`;

export const AppShell = () => {
  const [authState, setAuthState] = useState<AuthState>({ status: "loading" });
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<number | null>(null);
  const [board, setBoard] = useState<BoardData | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatSending, setIsChatSending] = useState(false);
  const [isBoardLoading, setIsBoardLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>({
    status: "idle",
    message: null,
  });
  const pendingSavesRef = useRef(0);
  const saveQueueRef = useRef(Promise.resolve());
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      try {
        const session = await fetchSession();
        if (!cancelled) {
          setAuthState({ status: "authenticated", username: session.username });
        }
      } catch {
        if (!cancelled) {
          setAuthState({ status: "unauthenticated", error: null });
        }
      }
    };

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, []);

  // Load the list of boards once the user is authenticated.
  useEffect(() => {
    if (authState.status !== "authenticated") {
      setBoards([]);
      setActiveBoardId(null);
      setBoard(null);
      setBoardError(null);
      setChatError(null);
      setChatMessages([]);
      setSaveState({ status: "idle", message: null });
      return;
    }

    let cancelled = false;

    const loadBoards = async () => {
      try {
        const summaries = await listBoards();
        if (cancelled) {
          return;
        }
        setBoards(summaries);
        setActiveBoardId((current) =>
          current && summaries.some((board) => board.id === current)
            ? current
            : (summaries[0]?.id ?? null)
        );
      } catch (error) {
        if (!cancelled) {
          setBoardError(
            error instanceof Error ? error.message : "Unable to load your boards."
          );
        }
      }
    };

    void loadBoards();

    return () => {
      cancelled = true;
    };
  }, [authState]);

  // Load the active board's content whenever the selection changes.
  useEffect(() => {
    if (authState.status !== "authenticated" || activeBoardId === null) {
      return;
    }

    let cancelled = false;
    setIsBoardLoading(true);
    setBoardError(null);

    const loadBoard = async () => {
      try {
        const nextBoard = await fetchBoard(activeBoardId);
        if (!cancelled) {
          setBoard(nextBoard);
          setSaveState({ status: "idle", message: null });
        }
      } catch (error) {
        if (!cancelled) {
          setBoardError(
            error instanceof Error ? error.message : "Unable to load your board."
          );
        }
      } finally {
        if (!cancelled) {
          setIsBoardLoading(false);
        }
      }
    };

    void loadBoard();

    return () => {
      cancelled = true;
    };
  }, [authState, activeBoardId]);

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const username = String(formData.get("username") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      const session =
        authMode === "register"
          ? await register(username, password)
          : await login(username, password);
      setAuthState({ status: "authenticated", username: session.username });
      form.reset();
    } catch (error) {
      setAuthState({
        status: "unauthenticated",
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong. Try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetClientState = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    pendingSavesRef.current = 0;
    saveQueueRef.current = Promise.resolve();
    setBoard(null);
    setBoards([]);
    setActiveBoardId(null);
    setBoardError(null);
    setChatError(null);
    setChatMessages([]);
    setSaveState({ status: "idle", message: null });
  };

  const handleLogout = async () => {
    await logout();
    resetClientState();
    setAuthMode("login");
    setAuthState({ status: "unauthenticated", error: null });
  };

  const queueBoardSave = (boardId: number, nextBoard: BoardData) => {
    pendingSavesRef.current += 1;

    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(() => saveBoard(boardId, nextBoard))
      .then(() => {
        pendingSavesRef.current -= 1;
        if (pendingSavesRef.current === 0) {
          setSaveState({ status: "idle", message: null });
        }
      })
      .catch((error) => {
        pendingSavesRef.current -= 1;
        setSaveState({
          status: "error",
          message:
            error instanceof Error ? error.message : "Unable to save your board.",
        });
      });
  };

  const handleBoardChange = (nextBoard: BoardData) => {
    if (activeBoardId === null) {
      return;
    }
    const boardId = activeBoardId;
    setBoard(nextBoard);
    setBoardError(null);
    setSaveState({ status: "saving", message: null });

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      queueBoardSave(boardId, nextBoard);
    }, BOARD_SAVE_DEBOUNCE_MS);
  };

  const handleSelectBoard = (boardId: number) => {
    if (boardId !== activeBoardId) {
      setActiveBoardId(boardId);
    }
  };

  const handleCreateBoard = async (name: string) => {
    try {
      const created = await createBoard(name);
      setBoards((current) => [...current, created]);
      setActiveBoardId(created.id);
    } catch (error) {
      setBoardError(
        error instanceof Error ? error.message : "Unable to create the board."
      );
    }
  };

  const handleRenameBoard = async (boardId: number, name: string) => {
    try {
      const updated = await renameBoard(boardId, name);
      setBoards((current) =>
        current.map((board) => (board.id === boardId ? updated : board))
      );
    } catch (error) {
      setBoardError(
        error instanceof Error ? error.message : "Unable to rename the board."
      );
    }
  };

  const handleDeleteBoard = async (boardId: number) => {
    try {
      await deleteBoard(boardId);
      setBoards((current) => {
        const remaining = current.filter((board) => board.id !== boardId);
        if (boardId === activeBoardId) {
          setActiveBoardId(remaining[0]?.id ?? null);
        }
        return remaining;
      });
    } catch (error) {
      setBoardError(
        error instanceof Error ? error.message : "Unable to delete the board."
      );
    }
  };

  const handleSendChatMessage = async (message: string) => {
    if (activeBoardId === null) {
      return;
    }
    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: "user",
      content: message,
    };

    setChatError(null);
    setIsChatSending(true);
    setChatMessages((current) => [...current, userMessage]);

    try {
      const payload = await sendChat(message, activeBoardId);
      setBoard(payload.board);
      setBoardError(null);
      setSaveState({ status: "idle", message: null });
      setChatMessages((current) => [
        ...current,
        { id: createMessageId(), role: "assistant", content: payload.reply },
      ]);
    } catch (error) {
      setChatError(
        error instanceof Error ? error.message : "Unable to send your message."
      );
    } finally {
      setIsChatSending(false);
    }
  };

  if (authState.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--secondary-purple)] text-white">
            <SpinnerIcon className="h-6 w-6" />
          </span>
          <p className="text-sm font-medium text-[var(--gray-text)]">
            Checking your session…
          </p>
        </div>
      </div>
    );
  }

  if (authState.status === "authenticated") {
    if (isBoardLoading || !board) {
      return (
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--secondary-purple)] text-white">
              <SpinnerIcon className="h-6 w-6" />
            </span>
            <p className="text-sm font-medium text-[var(--gray-text)]">
              Loading your board…
            </p>
            {boardError ? (
              <p className="mt-2 rounded-2xl border border-[#f3d3d0] bg-[#fff4f2] px-4 py-3 text-sm text-[#b42318]">
                {boardError}
              </p>
            ) : null}
          </div>
        </div>
      );
    }

    return (
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />
        <main className="relative mx-auto grid min-h-screen max-w-[1720px] gap-6 px-4 py-8 sm:px-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <KanbanBoard
            initialBoard={board}
            onBoardChange={handleBoardChange}
            username={authState.username}
            onLogout={handleLogout}
            saveError={saveState.message}
            saveStatus={saveState.status}
            boards={boards}
            activeBoardId={activeBoardId}
            onSelectBoard={handleSelectBoard}
            onCreateBoard={handleCreateBoard}
            onRenameBoard={handleRenameBoard}
            onDeleteBoard={handleDeleteBoard}
          />
          <AIChatSidebar
            error={chatError}
            isSending={isChatSending}
            messages={chatMessages}
            onSend={handleSendChatMessage}
          />
        </main>
      </div>
    );
  }

  const isRegister = authMode === "register";

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.24)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.16)_0%,_rgba(117,57,145,0.04)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-md items-center px-6 py-12">
        <section className="w-full rounded-[32px] border border-[var(--stroke)] bg-white/90 p-8 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex flex-col items-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--secondary-purple)] text-white">
              <LayoutIcon className="h-7 w-7" />
            </span>
            <h1 className="mt-5 font-display text-3xl font-semibold text-[var(--navy-dark)]">
              {isRegister
                ? "Create your account"
                : "Log in to open your kanban board"}
            </h1>
            <p className="mt-2 text-sm text-[var(--gray-text)]">
              {isRegister
                ? "Pick a username and password to get your own boards."
                : "Sign in to pick up where you left off."}
            </p>
          </div>

          <form className="mt-8 space-y-4" onSubmit={handleAuthSubmit}>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
                Username
              </span>
              <input
                name="username"
                defaultValue={isRegister ? "" : "user"}
                autoComplete="username"
                className="mt-2 w-full rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
                Password
              </span>
              <input
                name="password"
                type="password"
                defaultValue={isRegister ? "" : "password"}
                autoComplete={isRegister ? "new-password" : "current-password"}
                className="mt-2 w-full rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
              />
            </label>

            {authState.error ? (
              <p className="rounded-2xl border border-[#f3d3d0] bg-[#fff4f2] px-4 py-3 text-sm text-[#b42318]">
                {authState.error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full bg-[var(--secondary-purple)] px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting
                ? isRegister
                  ? "Creating account..."
                  : "Signing in..."
                : isRegister
                  ? "Create account"
                  : "Sign in"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setAuthMode(isRegister ? "login" : "register");
              setAuthState({ status: "unauthenticated", error: null });
            }}
            className="mt-6 w-full text-center text-sm font-semibold text-[var(--primary-blue)] transition hover:brightness-110"
          >
            {isRegister
              ? "Already have an account? Sign in"
              : "Need an account? Create one"}
          </button>

          {isRegister ? null : (
            <p className="mt-4 text-center text-xs text-[var(--gray-text)]">
              Demo login ·{" "}
              <span className="font-semibold text-[var(--navy-dark)]">user</span> /{" "}
              <span className="font-semibold text-[var(--navy-dark)]">password</span>
            </p>
          )}
        </section>
      </main>
    </div>
  );
};
