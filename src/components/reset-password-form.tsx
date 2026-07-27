"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset-password", token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not reset password");
      setDone(true);
      setTimeout(() => {
        router.push("/login");
        router.refresh();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="surface mx-auto w-full max-w-md space-y-4 rounded-[1.5rem] p-5 text-center sm:p-8">
        <p className="text-sm text-[var(--danger)]">This reset link is missing or invalid.</p>
        <Link href="/forgot-password" className="btn btn-primary">
          Request a new link
        </Link>
      </div>
    );
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
        <h1 className="display text-[1.85rem] leading-none sm:text-[2.35rem]">Set new password</h1>
        <p className="mt-2 text-sm leading-relaxed muted">Choose a new password for your account (8+ characters).</p>
      </div>

      {done ? (
        <p className="text-center text-sm font-semibold text-[var(--accent-strong)]">Password updated. Taking you to sign in…</p>
      ) : (
        <>
          <div>
            <label className="label">New password</label>
            <div className="relative">
              <input
                className="field !pr-12"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--ink-muted)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div>
            <label className="label">Confirm password</label>
            <input
              className="field"
              type={showPassword ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              placeholder="Repeat password"
              autoComplete="new-password"
            />
          </div>
          <button className="btn btn-primary w-full" disabled={busy} type="submit">
            {busy ? "Saving…" : "Update password"}
          </button>
        </>
      )}

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      <p className="text-center text-sm muted">
        <Link
          className="font-semibold text-[var(--accent-strong)] underline decoration-[var(--accent)]/30 underline-offset-2"
          href="/login"
        >
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
