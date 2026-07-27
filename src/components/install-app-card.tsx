"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Download, Link2, Share } from "lucide-react";
import { getPublicAppUrl } from "@/lib/app-url";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Platform = "ios" | "android" | "desktop-apple" | "desktop" | "unknown";

function detectPlatform(): Platform {
  if (typeof window === "undefined") return "unknown";
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOS) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Macintosh|Mac OS X/.test(ua)) return "desktop-apple";
  return "desktop";
}

function MobileLinkBlock({ compact = false }: { compact?: boolean }) {
  const [url, setUrl] = useState(getPublicAppUrl());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(getPublicAppUrl());
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=8&data=${encodeURIComponent(url)}`;

  return (
    <div
      className={
        compact
          ? "space-y-2 rounded-xl border border-[var(--line)] bg-white/50 p-3"
          : "space-y-3 rounded-2xl border border-[var(--line)] bg-white/60 p-3 sm:p-4"
      }
    >
      <div className="flex items-start gap-2">
        <Link2 className="mt-0.5 shrink-0 text-[var(--accent-strong)]" size={compact ? 16 : 18} />
        <div className="min-w-0 flex-1">
          <p className={`font-semibold text-[var(--ink)] ${compact ? "text-sm" : ""}`}>Mobile link</p>
          <p className={`mt-0.5 muted ${compact ? "text-xs" : "text-xs sm:text-sm"}`}>
            Open on your phone, then Add to Home Screen.
          </p>
        </div>
      </div>

      <div className={`flex flex-col gap-3 ${compact ? "" : "sm:flex-row sm:items-center"}`}>
        {!compact ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrSrc}
            alt="QR code for Job Hunt Copilot mobile link"
            width={140}
            height={140}
            className="mx-auto shrink-0 rounded-xl border border-[var(--line)] bg-white p-1.5 sm:mx-0"
          />
        ) : null}
        <div className="min-w-0 flex-1 space-y-2">
          <p className="break-all font-mono text-xs text-[var(--ink)] sm:text-sm">{url}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary !min-h-10 !px-3.5 !py-2 text-sm" onClick={() => void copyLink()}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "Copied" : "Copy mobile link"}
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary !min-h-10 !px-3.5 !py-2 text-sm"
            >
              Open link
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export function InstallAppCard({ compact = false }: { compact?: boolean }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [platform, setPlatform] = useState<Platform>("unknown");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    if (standalone) setInstalled(true);

    setPlatform(detectPlatform());

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      setHint("Installed on this device.");
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!deferred) return;
    setBusy(true);
    setHint(null);
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        setInstalled(true);
        setHint("Installed on this device.");
      }
      setDeferred(null);
    } catch {
      setHint("Could not open the install prompt. Use your browser menu instead.");
    } finally {
      setBusy(false);
    }
  }

  const title =
    platform === "ios" || platform === "android" ? "Install on your phone" : "Install on this device";

  if (installed) {
    return (
      <div className={compact ? "space-y-2" : "surface space-y-3 rounded-[1.35rem] p-4 sm:rounded-[1.6rem] sm:p-6"}>
        <p className={`flex items-center gap-2 font-semibold text-[var(--accent-strong)] ${compact ? "text-sm" : ""}`}>
          <Check size={18} /> Installed — open from your home screen
        </p>
        <MobileLinkBlock compact={compact} />
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-2" : "surface space-y-3 rounded-[1.35rem] p-4 sm:rounded-[1.6rem] sm:p-6"}>
      {!compact ? (
        <div>
          <p className="eyebrow">App</p>
          <h2 className="display mt-1 text-[1.55rem] sm:text-[1.85rem]">{title}</h2>
          <p className="mt-1.5 text-sm leading-relaxed muted">
            Add Job Hunt Copilot to your home screen for a full-screen app experience and push alerts.
          </p>
        </div>
      ) : (
        <p className="text-sm font-semibold text-[var(--ink)]">Install on phone or desktop</p>
      )}

      <MobileLinkBlock compact={compact} />

      {deferred ? (
        <button className="btn btn-primary w-full sm:w-auto" disabled={busy} onClick={() => void install()}>
          <Download size={18} />
          {busy ? "Opening…" : "Install app"}
        </button>
      ) : (
        <div className="space-y-3 text-sm leading-relaxed">
          {platform === "ios" ? (
            <ol className="list-decimal space-y-2 pl-4 muted">
              <li>
                Tap the <Share className="mx-0.5 inline" size={14} /> <span className="font-semibold text-[var(--ink)]">Share</span> button in Safari
              </li>
              <li>
                Scroll and tap <span className="font-semibold text-[var(--ink)]">Add to Home Screen</span>
              </li>
              <li>
                Tap <span className="font-semibold text-[var(--ink)]">Add</span> — then open the icon like any app
              </li>
            </ol>
          ) : null}

          {platform === "android" ? (
            <ol className="list-decimal space-y-2 pl-4 muted">
              <li>
                Tap the <span className="font-semibold text-[var(--ink)]">⋮</span> menu in Chrome
              </li>
              <li>
                Choose <span className="font-semibold text-[var(--ink)]">Install app</span> or{" "}
                <span className="font-semibold text-[var(--ink)]">Add to Home screen</span>
              </li>
              <li>Confirm — the icon appears on your home screen</li>
            </ol>
          ) : null}

          {platform === "desktop-apple" ? (
            <p className="muted">
              In Safari: <span className="font-semibold text-[var(--ink)]">File → Add to Dock</span> (or Share → Add to
              Dock).
            </p>
          ) : null}

          {platform === "desktop" || platform === "unknown" ? (
            <p className="muted">
              In Chrome / Edge: use the install icon in the address bar, or menu →{" "}
              <span className="font-semibold text-[var(--ink)]">Install Job Hunt Copilot</span>.
            </p>
          ) : null}

          {!compact ? (
            <div className="rounded-2xl border border-[var(--line)] bg-white/60 p-3 text-xs muted sm:text-sm">
              <p className="font-semibold text-[var(--ink)]">Also works on mobile</p>
              <p className="mt-1">
                <span className="font-semibold text-[var(--ink)]">iPhone:</span> Safari → Share → Add to Home Screen
              </p>
              <p>
                <span className="font-semibold text-[var(--ink)]">Android:</span> Chrome → ⋮ → Install app / Add to Home
                screen
              </p>
            </div>
          ) : null}
        </div>
      )}
      {hint ? <p className="text-sm text-[var(--accent-strong)]">{hint}</p> : null}
    </div>
  );
}
