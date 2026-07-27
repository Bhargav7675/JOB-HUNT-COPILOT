"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function RunAgentButton({ label = "Run agent now" }: { label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  async function run() {
    setBusy(true);
    setElapsed(0);
    setError(null);
    setMessage("Scouting boards, ranking fit, verifying contacts, drafting outreach…");
    try {
      const res = await fetch("/api/agent/run", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Run failed");
      setMessage(
        `Done — ${data.ranked} ranked, ${data.applied ?? 0} auto-applied, ${data.contacts} contacts, ${data.drafts} drafts.`,
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 w-full sm:w-auto">
      <button className="btn btn-primary w-full sm:w-auto" disabled={busy} onClick={() => void run()}>
        {busy ? (
          <>
            <span className="running-dot" />
            Running… {elapsed}s
          </>
        ) : (
          label
        )}
      </button>
      {message ? <p className="text-sm leading-relaxed text-[var(--accent-strong)]">{message}</p> : null}
      {error ? <p className="text-sm leading-relaxed text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
