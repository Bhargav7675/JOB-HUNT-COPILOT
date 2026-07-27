"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Copy, Link2 } from "lucide-react";
import { getPublicAppUrl } from "@/lib/app-url";

type Phase = "splash" | "ready";

export function LandingSplash() {
  const [phase, setPhase] = useState<Phase>("splash");
  const [mobileUrl, setMobileUrl] = useState(getPublicAppUrl());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = reduced ? 400 : 2100;
    const timer = window.setTimeout(() => setPhase("ready"), delay);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    setMobileUrl(getPublicAppUrl());
  }, []);

  async function copyMobileLink() {
    try {
      await navigator.clipboard.writeText(mobileUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const ready = phase === "ready";
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=8&data=${encodeURIComponent(mobileUrl)}`;

  return (
    <main className={`shell landing ${ready ? "landing-ready" : "landing-splash"}`}>
      <div className="landing-mesh" aria-hidden />

      <div className={`splash-stage ${ready ? "is-done" : ""}`} aria-hidden={ready}>
        <Image
          src="/logo.svg"
          alt="Job Hunt Copilot"
          width={152}
          height={152}
          priority
          className="splash-logo"
        />
      </div>

      <header className={`landing-top landing-reveal ${ready ? "is-visible" : ""}`}>
        <div className="flex min-w-0 items-center gap-2.5">
          <Image
            src="/logo.svg"
            alt=""
            width={34}
            height={34}
            priority
            className="shrink-0 rounded-[10px]"
          />
          <p className="display truncate text-[1.45rem] leading-none tracking-[-0.04em]">Job Hunt Copilot</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href="/login" className="btn btn-secondary !min-h-10 !px-3.5 !py-2 text-sm" tabIndex={ready ? 0 : -1}>
            Sign in
          </Link>
          <Link href="/signup" className="btn btn-primary !min-h-10 !px-3.5 !py-2 text-sm" tabIndex={ready ? 0 : -1}>
            Start
          </Link>
        </div>
      </header>

      <section className={`landing-hero landing-reveal ${ready ? "is-visible" : ""}`} aria-label="Job Hunt Copilot">
        <Image
          src="/logo.svg"
          alt="Job Hunt Copilot"
          width={128}
          height={128}
          priority
          className="landing-logo"
        />
        <h1 className="display landing-brand">Job Hunt Copilot</h1>
        <p className="landing-headline">Your private agent for ranked roles, tailored resumes, and auto-apply.</p>
        <p className="landing-sub">
          One brief. One resume. Overnight scouting that feels like a morning ritual — not a spreadsheet.
        </p>
        <div className="stack-actions landing-cta">
          <Link href="/signup" className="btn btn-primary" tabIndex={ready ? 0 : -1}>
            Get started free
          </Link>
          <Link href="/login" className="btn btn-secondary" tabIndex={ready ? 0 : -1}>
            Sign in to your account
          </Link>
        </div>

        <div
          className="landing-mobile-link mt-6 w-full max-w-md rounded-[1.25rem] border border-[var(--line)] bg-white/55 p-4 text-left backdrop-blur-sm"
          aria-label="Mobile link"
        >
          <div className="flex items-start gap-2">
            <Link2 className="mt-0.5 shrink-0 text-[var(--accent-strong)]" size={18} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--ink)]">Mobile link</p>
              <p className="mt-0.5 text-xs muted">Scan or copy to open the PWA on your phone.</p>
            </div>
          </div>
          <div className="mt-3 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrSrc}
              alt="QR code linking to Job Hunt Copilot"
              width={120}
              height={120}
              className="mx-auto shrink-0 rounded-xl border border-[var(--line)] bg-white p-1.5 sm:mx-0"
            />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="break-all font-mono text-xs text-[var(--ink)]">{mobileUrl}</p>
              <button
                type="button"
                className="btn btn-secondary !min-h-10 w-full !px-3.5 !py-2 text-sm sm:w-auto"
                tabIndex={ready ? 0 : -1}
                onClick={() => void copyMobileLink()}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? "Copied" : "Copy mobile link"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section
        className={`landing-strip landing-reveal ${ready ? "is-visible" : ""}`}
        aria-label="How it works"
      >
        <p>
          <span>Scout</span> boards overnight
        </p>
        <p>
          <span>Rank + tailor</span> to your brief
        </p>
        <p>
          <span>Auto-apply</span> on supported ATS
        </p>
      </section>
    </main>
  );
}
