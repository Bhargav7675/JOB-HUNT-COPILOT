"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [emailed, setEmailed] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "forgot-password", email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start reset");
      setDone(true);
      setEmailed(Boolean(data.emailed));
      setResetUrl(typeof data.resetUrl === "string" ? data.resetUrl : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start reset");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="surface card-enter mx-auto w-full max-w-md space-y-4 rounded-[1.5rem] p-5 sm:rounded-[1.75rem] sm:p-8"
    >
      <div className="flex justify-center pb-1">
        <Image
          src="/logo.png"
          alt="Job Hunt Copilot"
          width={58}
          height={58}
          priority
          className="rounded-[15px] shadow-[0_14px_32px_rgba(15,118,110,0.28)]"
        />
      </div>
      <div className="text-center">
        <h1 className="display text-[1.85rem] leading-none sm:text-[2.35rem]">Forgot password</h1>
        <p className="mt-2 text-sm leading-relaxed muted">
          Enter your account email and we’ll send a reset link (or show one if email isn’t configured).
        </p>
      </div>

      {done ? (
        <div className="space-y-3 rounded-2xl border border-[var(--line)] bg-white/60 p-4 text-sm leading-relaxed">
          <p className="font-semibold text-[var(--accent-strong)]">
            {emailed
              ? "If an account exists for that email, a reset link is on the way."
              : "If an account exists for that email, use the reset link below."}
          </p>
          {resetUrl ? (
            <p className="break-all">
              <Link className="font-semibold text-[var(--accent-strong)] underline underline-offset-2" href={resetUrl}>
                {resetUrl}
              </Link>
            </p>
          ) : null}
          <p className="muted">The link expires in 1 hour.</p>
        </div>
      ) : (
        <>
          <div>
            <label className="label">Email</label>
            <input
              className="field"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@email.com"
              autoComplete="email"
            />
          </div>
          <button className="btn btn-primary w-full" disabled={busy} type="submit">
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </>
      )}

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      <p className="text-center text-sm muted">
        Remembered it?{" "}
        <Link
          className="font-semibold text-[var(--accent-strong)] underline decoration-[var(--accent)]/30 underline-offset-2"
          href="/login"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
