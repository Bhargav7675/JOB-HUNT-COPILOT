"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type Phase = "splash" | "ready";

export function LandingSplash() {
  const [phase, setPhase] = useState<Phase>("splash");

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = reduced ? 400 : 2100;
    const timer = window.setTimeout(() => setPhase("ready"), delay);
    return () => window.clearTimeout(timer);
  }, []);

  const ready = phase === "ready";

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
