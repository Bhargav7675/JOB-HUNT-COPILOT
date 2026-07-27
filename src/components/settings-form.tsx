"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatHourLabel } from "@/lib/schedule";

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

const HOURS = Array.from({ length: 24 }, (_, h) => h);

type ProfileFormProps = {
  initial: {
    fullName: string;
    email: string;
    phone: string | null;
    linkedinUrl: string | null;
    headline: string | null;
    searchBrief: string;
    locationPref: string | null;
    experienceYears: number;
    visaSponsorship: boolean;
    voiceNotes: string | null;
    resumeText: string;
    openaiApiKey: string;
    llmProvider: "auto" | "openai" | "anthropic";
    llmModel: string;
    llmBaseUrl: string;
    hunterApiKey: string;
    adzunaAppId: string | null;
    adzunaAppKey: string;
    maxRolesPerRun: number;
    maxAgeDays: number;
    overnightEnabled: boolean;
    overnightHourUtc: number;
    scheduleTimezone: string;
    scheduleHourLocal: number;
    autoApplyEnabled: boolean;
    autoApplyMinScore: number;
    autoApplyMinAtsScore: number;
    maxAutoAppliesPerRun: number;
  };
};

export function SettingsForm({ initial }: ProfileFormProps) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const scheduleHint = useMemo(() => {
    return `Preferred time: ${formatHourLabel(form.scheduleHourLocal)} (${form.scheduleTimezone}). The agent will scout, rank, tailor, and autofill applications on that cadence.`;
  }, [form.scheduleHourLocal, form.scheduleTimezone]);

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (!form.locationPref?.trim() || form.locationPref.trim().length < 2) {
        throw new Error("Location is required");
      }
      if (Number.isNaN(form.experienceYears) || form.experienceYears < 0) {
        throw new Error("Years of experience is required");
      }
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          locationPref: form.locationPref.trim(),
          experienceYears: form.experienceYears,
          overnightHourUtc: form.scheduleHourLocal,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === "string" ? data.error : "Could not save settings");
      }
      setMessage("Settings saved.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="surface space-y-5 rounded-[1.5rem] p-4 sm:rounded-[1.75rem] sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Full name</label>
          <input className="field" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="field" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </div>
        <div>
          <label className="label">Phone (for application autofill)</label>
          <input className="field" value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} placeholder="+1…" />
        </div>
        <div>
          <label className="label">LinkedIn URL</label>
          <input
            className="field"
            value={form.linkedinUrl || ""}
            onChange={(e) => set("linkedinUrl", e.target.value)}
            placeholder="https://linkedin.com/in/…"
          />
        </div>
      </div>
      <div>
        <label className="label">Search brief</label>
        <input className="field" value={form.searchBrief} onChange={(e) => set("searchBrief", e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Location (required)</label>
          <input
            className="field"
            value={form.locationPref || ""}
            onChange={(e) => set("locationPref", e.target.value)}
            placeholder="United States / Remote US / Austin, TX"
            required
          />
          <p className="mt-1 text-xs muted">Filters newly opened US board roles.</p>
        </div>
        <div>
          <label className="label">Years of experience (required)</label>
          <input
            className="field"
            type="number"
            min={0}
            max={50}
            value={form.experienceYears}
            onChange={(e) => set("experienceYears", Number(e.target.value))}
            required
          />
          <p className="mt-1 text-xs muted">Matches junior / mid / senior / staff openings.</p>
        </div>
      </div>
      <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-white/50 p-4">
        <label className="flex items-start gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={form.visaSponsorship}
            onChange={(e) => set("visaSponsorship", e.target.checked)}
          />
          <span>Visa sponsorship</span>
        </label>
        <p className="text-sm leading-relaxed muted">
          When on, scout and rank prioritize roles that mention H-1B, visa sponsorship, OPT, or “will sponsor.” If too
          few postings say so explicitly, we soften the filter so your run isn’t empty.
        </p>
      </div>
      <div>
        <label className="label">Resume text</label>
        <textarea className="field min-h-40" value={form.resumeText} onChange={(e) => set("resumeText", e.target.value)} />
      </div>
      <div>
        <label className="label">Voice notes</label>
        <textarea className="field min-h-24" value={form.voiceNotes || ""} onChange={(e) => set("voiceNotes", e.target.value)} />
      </div>

      <div className="space-y-4 rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] p-4">
        <div>
          <h3 className="display text-xl">AI provider</h3>
          <p className="mt-1 text-sm muted">
            Paste a Claude (`sk-ant-…`), OpenAI (`sk-…`), or OpenAI-compatible key. Auto-detect works from the key prefix.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Provider</label>
            <select
              className="field"
              value={form.llmProvider}
              onChange={(e) => set("llmProvider", e.target.value as typeof form.llmProvider)}
            >
              <option value="auto">Auto-detect</option>
              <option value="anthropic">Claude (Anthropic)</option>
              <option value="openai">OpenAI / compatible</option>
            </select>
          </div>
          <div>
            <label className="label">LLM API key</label>
            <input
              className="field"
              type="password"
              value={form.openaiApiKey}
              onChange={(e) => set("openaiApiKey", e.target.value)}
              placeholder="sk-ant-… or sk-…"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="label">Model (optional)</label>
            <input
              className="field"
              value={form.llmModel}
              onChange={(e) => set("llmModel", e.target.value)}
              placeholder={form.llmProvider === "anthropic" ? "claude-sonnet-4-20250514" : "gpt-4o-mini"}
            />
          </div>
          <div>
            <label className="label">Base URL (optional)</label>
            <input
              className="field"
              value={form.llmBaseUrl}
              onChange={(e) => set("llmBaseUrl", e.target.value)}
              placeholder="https://api.openai.com/v1 or Groq/OpenRouter"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-[var(--line)] bg-white/50 p-4">
        <div>
          <h3 className="display text-xl">Refresh & apply schedule</h3>
          <p className="mt-1 text-sm muted">{scheduleHint}</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={form.overnightEnabled}
            onChange={(e) => set("overnightEnabled", e.target.checked)}
          />
          Enable scheduled agent runs
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Timezone</label>
            <select
              className="field"
              value={form.scheduleTimezone}
              onChange={(e) => set("scheduleTimezone", e.target.value)}
              disabled={!form.overnightEnabled}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Run time</label>
            <select
              className="field"
              value={form.scheduleHourLocal}
              onChange={(e) => set("scheduleHourLocal", Number(e.target.value))}
              disabled={!form.overnightEnabled}
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {formatHourLabel(h)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs leading-relaxed muted">
          Hosted plan runs once daily (includes refresh + autofill). For exact-hour runs, ping{" "}
          <code className="text-[var(--ink)]">/api/cron/run?strict=1</code> hourly with your cron secret.
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] p-4">
        <div>
          <h3 className="display text-xl">Autofill applications</h3>
          <p className="mt-1 text-sm muted">
            When enabled, the agent fills and submits applications on supported ATS portals (Greenhouse, Lever, Ashby)
            using your profile and tailored resume — only for roles that meet your score thresholds below. CAPTCHA,
            login walls, or custom questionnaires may still block some boards. Outreach stays copy-only.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={form.autoApplyEnabled}
            onChange={(e) => set("autoApplyEnabled", e.target.checked)}
          />
          Enable autofill during agent runs
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Min fit score</label>
            <input
              className="field"
              type="number"
              min={0}
              max={100}
              value={form.autoApplyMinScore}
              onChange={(e) => set("autoApplyMinScore", Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label">Min ATS score</label>
            <input
              className="field"
              type="number"
              min={0}
              max={100}
              value={form.autoApplyMinAtsScore}
              onChange={(e) => set("autoApplyMinAtsScore", Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label">Max applies / run</label>
            <input
              className="field"
              type="number"
              min={0}
              max={20}
              value={form.maxAutoAppliesPerRun}
              onChange={(e) => set("maxAutoAppliesPerRun", Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Hunter.io API key</label>
          <input className="field" value={form.hunterApiKey} onChange={(e) => set("hunterApiKey", e.target.value)} />
        </div>
        <div>
          <label className="label">Adzuna App ID</label>
          <input className="field" value={form.adzunaAppId || ""} onChange={(e) => set("adzunaAppId", e.target.value)} />
        </div>
        <div>
          <label className="label">Adzuna App Key</label>
          <input className="field" value={form.adzunaAppKey} onChange={(e) => set("adzunaAppKey", e.target.value)} />
        </div>
        <div>
          <label className="label">Max roles per run</label>
          <input
            className="field"
            type="number"
            value={form.maxRolesPerRun}
            onChange={(e) => set("maxRolesPerRun", Number(e.target.value))}
          />
        </div>
        <div>
          <label className="label">Max posting age (days)</label>
          <input
            className="field"
            type="number"
            value={form.maxAgeDays}
            onChange={(e) => set("maxAgeDays", Number(e.target.value))}
          />
        </div>
      </div>

      <button className="btn btn-primary w-full sm:w-auto" disabled={busy} onClick={() => void save()}>
        {busy ? "Saving…" : "Save settings"}
      </button>
      {message ? <p className="text-sm text-[var(--accent-strong)]">{message}</p> : null}
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
