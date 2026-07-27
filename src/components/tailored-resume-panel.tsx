"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export function TailoredResumePanel({
  roleId,
  company,
  title,
  tailoredResumeText,
  changeSummary,
  suggestions,
  atsBefore,
  atsAfter,
  matched,
  missing,
}: {
  roleId: string;
  company: string;
  title: string;
  tailoredResumeText: string | null;
  changeSummary: string | null;
  suggestions: string | null;
  atsBefore: number | null;
  atsAfter: number | null;
  matched: string[];
  missing: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [text, setText] = useState(tailoredResumeText || "");

  const delta = useMemo(() => {
    if (atsBefore == null || atsAfter == null) return null;
    return atsAfter - atsBefore;
  }, [atsBefore, atsAfter]);

  async function retailor() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`/api/roles/${roleId}/tailor`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Tailor failed");
      setText(data.tailoredResumeText || "");
      setNote(`ATS ${data.atsScoreBefore}% → ${data.atsScoreAfter}%`);
      router.refresh();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Tailor failed");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(text);
    setNote("Tailored resume copied. Paste into Docs/Word and export PDF if needed.");
  }

  function download() {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${company}_${title}_ATS_resume.txt`.replace(/[^\w.\-]+/g, "_").slice(0, 100);
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="surface space-y-4 rounded-[1.35rem] p-4 sm:rounded-[1.6rem] sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="display text-[1.45rem] sm:text-2xl">ATS-tailored resume</h2>
          <p className="mt-1 text-sm leading-relaxed muted">
            Keeps your wording. Surfaces keywords you already support — never invents skills.
          </p>
        </div>
        <div className="w-full shrink-0 rounded-2xl border border-[var(--line)] bg-white px-3 py-2 text-center sm:w-auto">
          <p className="text-[10px] font-semibold uppercase tracking-wide muted">ATS match</p>
          <p className="display text-2xl leading-none">
            {atsBefore ?? "—"}
            <span className="mx-1 text-base muted">→</span>
            {atsAfter ?? "—"}
          </p>
          {delta != null ? (
            <p className={`mt-1 text-xs font-semibold ${delta >= 0 ? "text-[var(--accent-strong)]" : "text-[var(--danger)]"}`}>
              {delta >= 0 ? `+${delta}` : delta} pts
            </p>
          ) : null}
        </div>
      </div>

      {changeSummary ? <p className="text-sm leading-relaxed">{changeSummary}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide muted">Keywords matched</p>
          <div className="mt-2 flex flex-wrap gap-1.5 sm:gap-2">
            {matched.length ? (
              matched.slice(0, 16).map((k) => (
                <span key={k} className="rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[11px] font-medium sm:px-2.5 sm:text-xs">
                  {k}
                </span>
              ))
            ) : (
              <span className="text-sm muted">Run tailor to compute</span>
            )}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide muted">Still missing (not invented)</p>
          <div className="mt-2 flex flex-wrap gap-1.5 sm:gap-2">
            {missing.length ? (
              missing.slice(0, 12).map((k) => (
                <span key={k} className="rounded-full border border-[var(--line)] px-2 py-1 text-[11px] sm:px-2.5 sm:text-xs">
                  {k}
                </span>
              ))
            ) : (
              <span className="text-sm muted">None flagged</span>
            )}
          </div>
        </div>
      </div>

      {suggestions ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide muted">Honest improvement notes</p>
          <pre className="mt-2 whitespace-pre-wrap rounded-2xl bg-[#f3f7f9] p-3 text-sm leading-relaxed sm:p-4">
            {suggestions}
          </pre>
        </div>
      ) : null}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide muted">Tailored plain-text resume</p>
        <textarea
          className="field mt-2 min-h-[220px] font-mono text-[13px] leading-relaxed sm:min-h-[320px]"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Run the agent or tap Re-tailor to generate a role-specific ATS resume."
        />
      </div>

      <div className="stack-actions">
        <button className="btn btn-primary" disabled={!text || busy} onClick={() => void copy()}>
          Copy tailored resume
        </button>
        <button className="btn btn-secondary" disabled={!text || busy} onClick={download}>
          Download .txt
        </button>
        <button className="btn btn-secondary" disabled={busy} onClick={() => void retailor()}>
          {busy ? "Tailoring…" : "Re-tailor for this role"}
        </button>
      </div>
      {note ? <p className="text-sm leading-relaxed text-[var(--accent-strong)]">{note}</p> : null}
    </section>
  );
}
