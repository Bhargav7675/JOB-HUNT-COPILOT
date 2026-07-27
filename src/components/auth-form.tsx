"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode,
          name,
          email,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Auth failed");

      const me = await fetch("/api/auth");
      const meData = await me.json();
      router.push(meData.user?.hasProfile ? "/dashboard" : "/onboarding");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auth failed");
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
        <h1 className="display text-[1.85rem] leading-none sm:text-[2.35rem]">
          {mode === "signup" ? "Create your space" : "Welcome back"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed muted">
          {mode === "signup"
            ? "Create private account access with email and password."
            : "Sign in with your email and password to open your ranked roles and drafts."}
        </p>
      </div>

      {mode === "signup" ? (
        <div>
          <label className="label">Full name</label>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Your name" />
        </div>
      ) : null}

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
      <div>
        <div className="mb-0.5 flex items-center justify-between gap-2">
          <label className="label !mb-0">Password</label>
          {mode === "login" ? (
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-[var(--accent-strong)] underline decoration-[var(--accent)]/30 underline-offset-2"
            >
              Forgot password?
            </Link>
          ) : null}
        </div>
        <div className="relative">
          <input
            className="field !pr-12"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
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

      <button className="btn btn-primary w-full" disabled={busy} type="submit">
        {busy ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
      </button>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      <p className="text-center text-sm muted">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <Link
              className="font-semibold text-[var(--accent-strong)] underline decoration-[var(--accent)]/30 underline-offset-2"
              href="/login"
            >
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link
              className="font-semibold text-[var(--accent-strong)] underline decoration-[var(--accent)]/30 underline-offset-2"
              href="/signup"
            >
              Create an account
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
