"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Send, Sparkles } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What should I focus on today?",
  "Summarize my best-fit roles",
  "Run the agent and scout new jobs",
  "How can I improve my outreach?",
];

export function AgentChat({ hasKey, provider }: { hasKey: boolean; provider: string }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: hasKey
        ? "I’m your Job Hunt Copilot agent — powered by the same API key in Settings. Ask about roles, outreach, ATS, or say “run the agent” to scout."
        : "Add your Claude or OpenAI API key in Settings first. I’ll use that same key for this chat and for ranking/tailoring.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    if (!hasKey) {
      setError("Add an API key in Settings to chat with the agent.");
      return;
    }

    setError(null);
    setInput("");
    const history = messages.filter((m) => m.role === "user" || m.role === "assistant").slice(1);
    setMessages((m) => [...m, { role: "user", content: message }]);
    setBusy(true);

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Agent failed");
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      if (data.runResult) router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Agent failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="surface flex min-h-[70vh] flex-col overflow-hidden rounded-[1.5rem] sm:min-h-[75vh]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
            <Bot size={18} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight">Copilot agent</p>
            <p className="truncate text-xs muted">
              Same key as Settings · {provider === "anthropic" ? "Claude" : provider === "openai" ? "OpenAI" : "Auto provider"}
            </p>
          </div>
        </div>
        <Sparkles size={16} className="shrink-0 text-[var(--accent)]" />
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
        {messages.map((m, i) => (
          <div
            key={`${m.role}-${i}`}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap sm:max-w-[80%] ${
                m.role === "user"
                  ? "bg-[var(--accent)] text-white"
                  : "border border-[var(--line)] bg-white/80 text-[var(--ink)]"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {busy ? (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-[var(--line)] bg-white/80 px-3.5 py-2.5 text-sm muted">
              Thinking…
            </div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {messages.length <= 1 ? (
        <div className="flex flex-wrap gap-2 border-t border-[var(--line)] px-4 py-3 sm:px-5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className="rounded-full border border-[var(--line)] bg-white/70 px-3 py-1.5 text-xs font-semibold text-[var(--ink-muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
              disabled={busy || !hasKey}
              onClick={() => void send(s)}
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      <form
        className="flex gap-2 border-t border-[var(--line)] p-3 sm:p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          className="field !py-3"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={hasKey ? "Ask your agent…" : "Add an API key in Settings to chat"}
          disabled={busy}
        />
        <button className="btn btn-primary !px-4" type="submit" disabled={busy || !input.trim()}>
          <Send size={18} />
        </button>
      </form>
      {error ? <p className="px-4 pb-3 text-sm text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
