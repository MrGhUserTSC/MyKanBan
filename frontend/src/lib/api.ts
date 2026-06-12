import type { BoardData } from "@/lib/kanban";

export type SessionUser = { username: string };

export type BoardSummary = {
  id: number;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
};

const jsonHeaders = { "Content-Type": "application/json" };

const asError = async (response: Response, fallback: string): Promise<never> => {
  const detail = (await response.json().catch(() => null)) as
    | { detail?: string }
    | null;
  throw new Error(detail?.detail ?? fallback);
};

export const fetchSession = async (): Promise<SessionUser> => {
  const response = await fetch("/api/session", { method: "GET", cache: "no-store" });
  if (!response.ok) {
    throw new Error("Authentication required.");
  }
  return (await response.json()) as SessionUser;
};

export const login = async (
  username: string,
  password: string
): Promise<SessionUser> => {
  const response = await fetch("/api/login", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    return asError(response, "Login failed. Try again.");
  }
  return (await response.json()) as SessionUser;
};

export const register = async (
  username: string,
  password: string
): Promise<SessionUser> => {
  const response = await fetch("/api/register", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    return asError(response, "Could not create your account.");
  }
  return (await response.json()) as SessionUser;
};

export const logout = async (): Promise<void> => {
  await fetch("/api/logout", { method: "POST" });
};

export const listBoards = async (): Promise<BoardSummary[]> => {
  const response = await fetch("/api/boards", { method: "GET", cache: "no-store" });
  if (!response.ok) {
    throw new Error("Unable to load your boards.");
  }
  return (await response.json()) as BoardSummary[];
};

export const createBoard = async (name: string): Promise<BoardSummary> => {
  const response = await fetch("/api/boards", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    return asError(response, "Unable to create the board.");
  }
  return (await response.json()) as BoardSummary;
};

export const renameBoard = async (
  boardId: number,
  name: string
): Promise<BoardSummary> => {
  const response = await fetch(`/api/boards/${boardId}`, {
    method: "PATCH",
    headers: jsonHeaders,
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    return asError(response, "Unable to rename the board.");
  }
  return (await response.json()) as BoardSummary;
};

export const deleteBoard = async (boardId: number): Promise<void> => {
  const response = await fetch(`/api/boards/${boardId}`, { method: "DELETE" });
  if (!response.ok) {
    return asError(response, "Unable to delete the board.");
  }
};

export const fetchBoard = async (boardId: number): Promise<BoardData> => {
  const response = await fetch(`/api/boards/${boardId}`, {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Unable to load your board.");
  }
  return (await response.json()) as BoardData;
};

export const saveBoard = async (
  boardId: number,
  board: BoardData
): Promise<void> => {
  const response = await fetch(`/api/boards/${boardId}`, {
    method: "PUT",
    headers: jsonHeaders,
    body: JSON.stringify(board),
  });
  if (!response.ok) {
    throw new Error("Unable to save your board.");
  }
};

export type ChatResult = {
  reply: string;
  board: BoardData;
  updated: boolean;
};

export const sendChat = async (
  message: string,
  boardId: number
): Promise<ChatResult> => {
  const response = await fetch("/api/ai/chat", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ message, board_id: boardId }),
  });
  if (!response.ok) {
    return asError(response, "Unable to send your message.");
  }
  return (await response.json()) as ChatResult;
};
