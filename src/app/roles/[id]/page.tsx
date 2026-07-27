import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AutoApplyButton } from "@/components/auto-apply-button";
import { DraftActions } from "@/components/draft-actions";
import { TailoredResumePanel } from "@/components/tailored-resume-panel";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { safeJsonParse, scoreColor } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function RoleDetailPage({ params }: Props) {
  const user = await requireUser();
  if (!user) redirect("/login");
  if (!user.profile) redirect("/onboarding");

  const { id } = await params;
  const role = await prisma.role.findFirst({
    where: { id, profileId: user.profile.id },
    include: {
      contacts: true,
      drafts: { include: { contact: true }, orderBy: { createdAt: "desc" } },
      applications: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!role) notFound();

  const skillMatches = safeJsonParse(role.skillMatches, [] as string[]);
  const skillGaps = safeJsonParse(role.skillGaps, [] as string[]);
  const atsMatched = safeJsonParse(role.atsKeywordsMatched, [] as string[]);
  const atsMissing = safeJsonParse(role.atsKeywordsMissing, [] as string[]);
  const latestApp = role.applications[0];

  return (
    <AppShell title={role.title} subtitle={`${role.company}${role.location ? ` · ${role.location}` : ""}`}>
      <div className="mb-5 space-y-3 sm:mb-6">
        <div className="stack-actions">
          <Link href="/dashboard" className="btn btn-secondary">
            ← Dashboard
          </Link>
          <a href={role.url} target="_blank" rel="noreferrer" className="btn btn-primary">
            Open posting
          </a>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-xl border px-2.5 py-1.5 text-sm font-semibold sm:rounded-2xl sm:px-3 sm:py-2 ${scoreColor(role.matchScore)}`}>
            Fit {role.matchScore}
          </span>
          {role.atsScoreAfter != null ? (
            <span className={`rounded-xl border px-2.5 py-1.5 text-sm font-semibold sm:rounded-2xl sm:px-3 sm:py-2 ${scoreColor(role.atsScoreAfter)}`}>
              ATS {role.atsScoreBefore ?? "—"}→{role.atsScoreAfter}
            </span>
          ) : null}
          <span className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide muted">
            {role.source}
          </span>
        </div>
      </div>

      <section className="surface mb-5 rounded-[1.35rem] p-4 sm:rounded-[1.6rem] sm:p-6">
        <h2 className="display text-[1.45rem] sm:text-2xl">Autofill application</h2>
        <p className="mt-1 text-sm leading-relaxed muted">
          Fills and submits on supported ATS portals (Greenhouse, Lever, Ashby) with your tailored resume, name, email,
          phone, and LinkedIn.
        </p>
        <div className="mt-4">
          <AutoApplyButton roleId={role.id} status={latestApp?.status} />
        </div>
        {latestApp?.confirmationText || latestApp?.error ? (
          <p className="mt-3 break-words text-sm muted">{latestApp.confirmationText || latestApp.error}</p>
        ) : null}
      </section>

      <div className="mb-5">
        <TailoredResumePanel
          roleId={role.id}
          company={role.company}
          title={role.title}
          tailoredResumeText={role.tailoredResumeText}
          changeSummary={role.resumeChangeSummary}
          suggestions={role.resumeSuggestions}
          atsBefore={role.atsScoreBefore}
          atsAfter={role.atsScoreAfter}
          matched={atsMatched}
          missing={atsMissing}
        />
      </div>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="surface space-y-4 rounded-[1.35rem] p-4 sm:rounded-[1.6rem] sm:p-6">
          <h2 className="display text-[1.45rem] sm:text-2xl">Why it ranks here</h2>
          <p className="text-sm leading-relaxed">{role.rankReason}</p>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide muted">Matches</p>
            <div className="mt-2 flex flex-wrap gap-1.5 sm:gap-2">
              {skillMatches.map((s) => (
                <span key={s} className="rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[11px] font-medium sm:px-2.5 sm:text-xs">
                  {s}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide muted">Gaps</p>
            <div className="mt-2 flex flex-wrap gap-1.5 sm:gap-2">
              {skillGaps.length ? (
                skillGaps.map((s) => (
                  <span key={s} className="rounded-full border border-[var(--line)] px-2 py-1 text-[11px] sm:px-2.5 sm:text-xs">
                    {s}
                  </span>
                ))
              ) : (
                <span className="text-sm muted">None flagged</span>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide muted">Description</p>
            <p className="mt-2 max-h-60 overflow-auto text-sm leading-relaxed muted sm:max-h-80">{role.description}</p>
          </div>
        </section>

        <section className="space-y-4 sm:space-y-5">
          <div className="surface rounded-[1.35rem] p-4 sm:rounded-[1.6rem] sm:p-6">
            <h2 className="display text-[1.45rem] sm:text-2xl">Contacts</h2>
            <div className="mt-4 space-y-3 sm:space-y-4">
              {role.contacts.length === 0 ? (
                <p className="text-sm muted">No contacts enriched for this role.</p>
              ) : (
                role.contacts.map((c) => (
                  <div key={c.id} className="rounded-2xl border border-[var(--line)] p-3.5 sm:p-4">
                    <p className="font-semibold">{c.fullName}</p>
                    <p className="text-sm muted">{c.title}</p>
                    {c.email ? (
                      <p className="mt-1 break-all text-sm">
                        {c.email} <span className="muted">({c.emailStatus})</span>
                      </p>
                    ) : (
                      <p className="mt-1 text-sm muted">Email not verified — not guessed.</p>
                    )}
                    {c.linkedinUrl ? (
                      <a className="mt-2 inline-block text-sm text-[var(--accent-strong)] underline" href={c.linkedinUrl} target="_blank" rel="noreferrer">
                        LinkedIn
                      </a>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="surface rounded-[1.35rem] p-4 sm:rounded-[1.6rem] sm:p-6">
            <h2 className="display text-[1.45rem] sm:text-2xl">Outreach drafts</h2>
            <p className="mt-1 text-sm leading-relaxed muted">Optional coffee-chat drafts — separate from autofill.</p>
            <div className="mt-4 space-y-4 sm:space-y-5">
              {role.drafts.length === 0 ? (
                <p className="text-sm muted">No drafts yet.</p>
              ) : (
                role.drafts.map((d) => (
                  <div key={d.id} className="space-y-3 rounded-2xl border border-[var(--line)] p-3.5 sm:p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 font-semibold leading-snug">{d.subject}</p>
                      <span className="shrink-0 text-[11px] uppercase tracking-wide muted">{d.status}</span>
                    </div>
                    <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed">{d.body}</pre>
                    <DraftActions
                      roleId={role.id}
                      draftId={d.id}
                      subject={d.subject}
                      body={d.body}
                      email={d.contact?.email}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
