"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DraftActions({
  roleId,
  draftId,
  subject,
  body,
  email,
}: {
  roleId: string;
  draftId: string;
  subject: string;
  body: string;
  email?: string | null;
}) {
  const router = useRouter();
  const [note, setNote] = useState<string | null>(null);

  async function mark(action: "approve" | "copied" | "discard") {
    const res = await fetch(`/api/roles/${roleId}/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftId, action }),
    });
    const data = await res.json();
    setNote(data.notice || "Updated");
    router.refresh();
  }

  async function copy() {
    const text = `Subject: ${subject}\n\n${body}${email ? `\n\nTo: ${email}` : ""}`;
    await navigator.clipboard.writeText(text);
    await mark("copied");
    setNote("Copied to clipboard. Send it yourself — the agent never sends.");
  }

  return (
    <div className="space-y-3">
      <div className="stack-actions">
        <button className="btn btn-primary" onClick={() => void copy()}>
          Copy message
        </button>
        <button className="btn btn-secondary" onClick={() => void mark("approve")}>
          Mark approved
        </button>
        <button className="btn btn-secondary" onClick={() => void mark("discard")}>
          Discard
        </button>
      </div>
      {note ? <p className="text-sm text-[var(--accent-strong)]">{note}</p> : null}
    </div>
  );
}
