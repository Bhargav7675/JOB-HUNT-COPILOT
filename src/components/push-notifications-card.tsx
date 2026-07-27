"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function PushNotificationsCard() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/push");
    if (!res.ok) return;
    const data = await res.json();
    setConfigured(Boolean(data.configured));
    setEnabled(Boolean(data.enabled));
  }

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(ok);
    void refresh();
  }, []);

  async function enable() {
    setBusy(true);
    setNote(null);
    try {
      if (!supported) throw new Error("Push is not supported in this browser.");

      const meta = await fetch("/api/push");
      const metaData = await meta.json();
      if (!metaData.publicKey) throw new Error("Push keys are not configured on the server.");

      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notification permission was denied.");

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const existing = await reg.pushManager.getSubscription();
      const subscription =
        existing ||
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(metaData.publicKey),
        }));

      const payload = subscription.toJSON();
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Could not save push subscription.");

      setEnabled(true);
      setConfigured(true);
      setNote("Push enabled. You’ll get alerts when agent runs finish.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not enable push");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setNote(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      } else {
        await fetch("/api/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
      }
      setEnabled(false);
      setNote("Push disabled on this device.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not disable push");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Test failed");
      setNote(data.sent ? "Test notification sent." : "No active subscriptions on this account.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Test failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="surface space-y-4 rounded-[1.35rem] p-4 sm:rounded-[1.6rem] sm:p-6">
      <div>
        <p className="eyebrow">Alerts</p>
        <h2 className="display mt-1 text-[1.55rem] sm:text-[1.85rem]">Push notifications</h2>
        <p className="mt-1.5 text-sm leading-relaxed muted">
          Alerts when runs finish or auto-apply updates. Android Chrome works directly; iPhone needs Add to Home Screen.
        </p>
      </div>

      {!supported ? (
        <p className="text-sm text-[var(--danger)]">This browser does not support web push.</p>
      ) : null}

      {!configured && supported ? (
        <p className="text-sm muted">Server push keys will be available after deploy.</p>
      ) : null}

      <div className="stack-actions">
        {!enabled ? (
          <button className="btn btn-primary" disabled={busy || !supported} onClick={() => void enable()}>
            {busy ? "Enabling…" : "Enable push"}
          </button>
        ) : (
          <>
            <button className="btn btn-primary" disabled={busy} onClick={() => void test()}>
              Send test
            </button>
            <button className="btn btn-secondary" disabled={busy} onClick={() => void disable()}>
              Disable on this device
            </button>
          </>
        )}
      </div>
      {note ? <p className="text-sm text-[var(--accent-strong)]">{note}</p> : null}
    </div>
  );
}
