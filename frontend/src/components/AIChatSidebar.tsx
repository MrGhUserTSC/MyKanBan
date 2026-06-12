"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { SendIcon, SparkleIcon } from "@/components/icons";

export type ChatMessage = {
  content: string;
  id: string;
  role: "assistant" | "user";
};

type AIChatSidebarProps = {
  error: string | null;
  isSending: boolean;
  messages: ChatMessage[];
  onSend: (message: string) => Promise<void>;
};

export const AIChatSidebar = ({
  error,
  isSending,
  messages,
  onSend,
}: AIChatSidebarProps) => {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }

    list.scrollTop = list.scrollHeight;
  }, [messages, isSending]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message) {
      return;
    }

    setDraft("");
    await onSend(message);
  };

  return (
    <aside className="flex h-[640px] flex-col rounded-[28px] border border-[var(--stroke)] bg-white/88 shadow-[var(--shadow)] backdrop-blur xl:sticky xl:top-8 xl:h-[calc(100vh-4rem)]">
      <div className="flex items-center gap-3 border-b border-[var(--stroke)] px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--secondary-purple)] text-white">
          <SparkleIcon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold leading-tight text-[var(--navy-dark)]">
            Board chat
          </h2>
          <p className="text-xs text-[var(--gray-text)]">
            Summarize or edit your board
          </p>
        </div>
      </div>

      <div
        ref={listRef}
        className="flex-1 space-y-4 overflow-y-auto px-5 py-5"
      >
        {messages.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-[var(--stroke)] bg-[var(--surface)] px-5 py-6 text-sm leading-6 text-[var(--gray-text)]">
            Try asking:
            <br />
            "Summarize my current board"
            <br />
            "Create a backlog card for launch checklist"
          </div>
        ) : null}

        {messages.map((message) => (
          <article
            key={message.id}
            data-testid={`chat-message-${message.role}`}
            className={
              message.role === "user"
                ? "ml-auto max-w-[85%] rounded-[24px] bg-[var(--secondary-purple)] px-4 py-3 text-sm leading-6 text-white"
                : "max-w-[90%] rounded-[24px] border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-sm leading-6 text-[var(--navy-dark)]"
            }
          >
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] opacity-70">
              {message.role === "user" ? "You" : "Assistant"}
            </p>
            <p className="whitespace-pre-wrap">{message.content}</p>
          </article>
        ))}

        {isSending ? (
          <div className="max-w-[90%] rounded-[24px] border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-sm leading-6 text-[var(--gray-text)]">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em]">
              Assistant
            </p>
            Thinking...
          </div>
        ) : null}
      </div>

      <div className="border-t border-[var(--stroke)] px-5 py-5">
        {error ? (
          <p className="mb-4 rounded-2xl border border-[#f3d3d0] bg-[#fff4f2] px-4 py-3 text-sm text-[#b42318]">
            {error}
          </p>
        ) : null}

        <form className="space-y-3" onSubmit={handleSubmit}>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={4}
            placeholder="Ask the assistant to summarize the board or make a change..."
            className="w-full resize-none rounded-[24px] border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-sm leading-6 text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
          />
          <button
            type="submit"
            disabled={isSending || !draft.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--secondary-purple)] px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <SendIcon className="h-4 w-4" />
            {isSending ? "Sending..." : "Send message"}
          </button>
        </form>
      </div>
    </aside>
  );
};
