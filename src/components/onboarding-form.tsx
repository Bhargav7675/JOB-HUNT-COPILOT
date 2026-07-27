"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Step = 1 | 2 | 3;

export function OnboardingForm({
  defaultName = "",
  defaultEmail = "",
}: {
  defaultName?: string;
  defaultEmail?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [headline, setHeadline] = useState("");
  const [searchBrief, setSearchBrief] = useState("");
  const [locationPref, setLocationPref] = useState("United States");
  const [experienceYears, setExperienceYears] = useState(3);
  const [voiceNotes, setVoiceNotes] = useState("Direct, warm, concise — no buzzword soup.");
  const [resumeText, setResumeText] = useState("");
  const [resumeFileName, setResumeFileName] = useState<string | undefined>();
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"auto" | "openai" | "anthropic">("auto");
  const [hunterApiKey, setHunterApiKey] = useState("");
  const [scheduleTimezone, setScheduleTimezone] = useState(
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" : "UTC",
  );
  const [scheduleHourLocal, setScheduleHourLocal] = useState(8);
  const [autoApplyEnabled, setAutoApplyEnabled] = useState(true);
  const [phone, setPhone] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");

  const canStep1 = fullName.trim().length > 1 && email.includes("@");
  const canStep2 =
    searchBrief.trim().length > 8 &&
    locationPref.trim().length > 1 &&
    experienceYears >= 0 &&
    resumeText.trim().length > 40;
  const progress = useMemo(() => (step / 3) * 100, [step]);

  async function onResumeFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/resume", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Resume parse failed");
      setResumeText(data.text);
      setResumeFileName(data.fileName);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Resume parse failed");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          headline,
          searchBrief,
          locationPref,
          experienceYears,
          phone: phone || undefined,
          linkedinUrl: linkedinUrl || undefined,
          voiceNotes,
          resumeText,
          resumeFileName,
          openaiApiKey: openaiApiKey || undefined,
          llmProvider,
          hunterApiKey: hunterApiKey || undefined,
          scheduleTimezone,
          scheduleHourLocal,
          overnightHourUtc: scheduleHourLocal,
          autoApplyEnabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not save profile");
      router.push("/dashboard?setup=1");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="surface card-enter mx-auto w-full max-w-3xl rounded-[1.5rem] p-4 sm:rounded-[1.75rem] sm:p-8">
      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-[var(--line)] sm:mb-6 sm:h-2">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#14958c,var(--accent))] transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="display text-[1.7rem] sm:text-3xl">Confirm your profile</h2>
          <p className="muted text-sm">Private to your account.</p>
          <div>
            <label className="label">Full name</label>
            <input className="field" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Alex Rivera" autoComplete="name" />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="alex@email.com" autoComplete="email" />
          </div>
          <div>
            <label className="label">Headline (optional)</label>
            <input className="field" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="AI Product Manager" />
          </div>
          <div className="stack-actions pt-1">
            <button className="btn btn-primary" disabled={!canStep1} onClick={() => setStep(2)}>
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="display text-[1.7rem] sm:text-3xl">Where & how senior</h2>
          <p className="muted text-sm">
            We’ll pull newly opened roles from top US boards matching your location and experience.
          </p>
          <div>
            <label className="label">Search brief</label>
            <input
              className="field"
              value={searchBrief}
              onChange={(e) => setSearchBrief(e.target.value)}
              placeholder="AI product manager roles"
              required
            />
          </div>
          <div>
            <label className="label">Location (required)</label>
            <input
              className="field"
              value={locationPref}
              onChange={(e) => setLocationPref(e.target.value)}
              placeholder="United States / Remote US / Austin, TX"
              required
            />
            <p className="mt-1 text-xs muted">Used to filter US job boards and remote-US roles.</p>
          </div>
          <div>
            <label className="label">Years of experience (required)</label>
            <input
              className="field"
              type="number"
              min={0}
              max={50}
              value={experienceYears}
              onChange={(e) => setExperienceYears(Number(e.target.value))}
              required
            />
            <p className="mt-1 text-xs muted">Helps match junior / mid / senior / staff-level openings.</p>
          </div>
          <div>
            <label className="label">Resume PDF or TXT</label>
            <input
              className="field"
              type="file"
              accept=".pdf,.txt,.md,text/plain,application/pdf"
              onChange={(e) => void onResumeFile(e.target.files?.[0] || null)}
            />
            {resumeFileName && resumeText.length > 40 ? (
              <p className="mt-2 text-sm text-[var(--accent-strong)]">
                Loaded {resumeFileName} ({resumeText.length.toLocaleString()} characters).
              </p>
            ) : null}
          </div>
          <div>
            <label className="label">Or paste resume text</label>
            <textarea
              className="field min-h-32 sm:min-h-40"
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="Paste your resume here…"
            />
          </div>
          <div className="stack-actions pt-1">
            <button className="btn btn-primary" disabled={!canStep2 || busy} onClick={() => setStep(3)}>
              Continue
            </button>
            <button className="btn btn-secondary" onClick={() => setStep(1)}>
              Back
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="display text-[1.7rem] sm:text-3xl">Keys, schedule & autofill</h2>
          <p className="muted text-sm">
            Add a Claude or OpenAI key for smarter ranking. Choose when the agent should refresh and whether to autofill
            applications on supported career portals.
          </p>
          <div>
            <label className="label">Voice notes for outreach</label>
            <textarea className="field min-h-24" value={voiceNotes} onChange={(e) => setVoiceNotes(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Phone (optional, for autofill)</label>
              <input
                className="field"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1…"
                autoComplete="tel"
              />
            </div>
            <div>
              <label className="label">LinkedIn URL (optional)</label>
              <input
                className="field"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/…"
              />
            </div>
          </div>
          <div>
            <label className="label">AI provider</label>
            <select
              className="field"
              value={llmProvider}
              onChange={(e) => setLlmProvider(e.target.value as typeof llmProvider)}
            >
              <option value="auto">Auto-detect from key</option>
              <option value="anthropic">Claude (Anthropic)</option>
              <option value="openai">OpenAI / compatible</option>
            </select>
          </div>
          <div>
            <label className="label">LLM API key (optional)</label>
            <input
              className="field"
              type="password"
              value={openaiApiKey}
              onChange={(e) => setOpenaiApiKey(e.target.value)}
              placeholder="sk-ant-… or sk-…"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Schedule timezone</label>
              <input
                className="field"
                value={scheduleTimezone}
                onChange={(e) => setScheduleTimezone(e.target.value)}
                placeholder="America/Chicago"
              />
            </div>
            <div>
              <label className="label">Daily run time</label>
              <select
                className="field"
                value={scheduleHourLocal}
                onChange={(e) => setScheduleHourLocal(Number(e.target.value))}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {((h + 11) % 12) + 1}:00 {h >= 12 ? "PM" : "AM"}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Hunter.io API key (optional)</label>
            <input className="field" type="password" value={hunterApiKey} onChange={(e) => setHunterApiKey(e.target.value)} placeholder="hunter-…" />
          </div>
          <div className="space-y-3 rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] p-3.5 sm:p-4">
            <label className="flex items-start gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={autoApplyEnabled}
                onChange={(e) => setAutoApplyEnabled(e.target.checked)}
              />
              <span>Autofill applications on supported portals</span>
            </label>
            <p className="text-sm leading-relaxed muted">
              Fills Greenhouse, Lever, and Ashby apply forms with your profile and tailored resume when fit/ATS scores
              meet your Settings thresholds. Does not work on every board (CAPTCHA/login). Outreach drafts stay
              copy-only — we never send emails for you.
            </p>
          </div>
          <div className="stack-actions pt-1">
            <button className="btn btn-primary" disabled={busy} onClick={() => void submit()}>
              {busy ? "Saving…" : "Launch Copilot"}
            </button>
            <button className="btn btn-secondary" onClick={() => setStep(2)} disabled={busy}>
              Back
            </button>
          </div>
        </div>
      )}

      {error ? <p className="mt-4 text-sm text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
