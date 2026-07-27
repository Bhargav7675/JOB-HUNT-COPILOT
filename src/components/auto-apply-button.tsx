"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AutoApplyButton({
  roleId,
  status,
}: {
  roleId: string;
  status?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function apply(force = false) {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`/api/roles/${roleId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Apply failed");
      const app = data.application;
      setNote(
        app.status === "submitted"
          ? `Submitted via ${app.method}. ${app.confirmationText || ""}`
          : `${app.status}: ${app.error || "See application history."}`,
      );
      router.refresh();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Apply failed");
    } finally {
      setBusy(false);
    }
  }

  const already = status === "submitted";

  return (
    <div className="space-y-2">
      <div className="stack-actions">
        <button
          className="btn btn-primary"
          disabled={busy || already}
          onClick={() => void apply(false)}
        >
          {busy ? "Applying…" : already ? "Already applied" : "Auto-apply now"}
        </button>
        {already ? (
          <button className="btn btn-secondary" disabled={busy} onClick={() => void apply(true)}>
            Re-apply
          </button>
        ) : null}
      </div>
      {status ? <p className="text-xs uppercase tracking-wide muted">Status: {status}</p> : null}
      {note ? <p className="text-sm text-[var(--accent-strong)]">{note}</p> : null}
    </div>
  );
}
