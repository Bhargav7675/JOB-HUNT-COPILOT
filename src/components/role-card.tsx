"use client";

import Link from "next/link";
import { scoreColor, truncate } from "@/lib/utils";

export type RoleCardData = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  source: string;
  url: string;
  matchScore: number;
  rankReason: string | null;
  skillMatches: string[];
  status: string;
  atsScoreBefore?: number | null;
  atsScoreAfter?: number | null;
  tailoredResumeText?: string | null;
  contacts: Array<{
    id: string;
    fullName: string;
    email: string | null;
    emailStatus: string;
    linkedinUrl: string | null;
  }>;
  drafts: Array<{
    id: string;
    subject: string;
    body: string;
    status: string;
  }>;
};

export function RoleCard({ role, index = 0 }: { role: RoleCardData; index?: number }) {
  const contact = role.contacts[0];
  const draft = role.drafts[0];

  return (
    <article
      className="surface surface-interactive card-enter rounded-[1.35rem] p-4 sm:rounded-[1.5rem] sm:p-6"
      style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="eyebrow !text-[0.62rem]">{role.source}</p>
          <h3 className="display mt-1.5 text-[1.45rem] leading-[1.12] sm:text-[1.75rem]">
            <Link href={`/roles/${role.id}`} className="transition-colors hover:text-[var(--accent-strong)]">
              {role.title}
            </Link>
          </h3>
          <p className="mt-1.5 text-sm font-medium text-[var(--ink-muted)]">
            {role.company}
            {role.location ? ` · ${role.location}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <div className={`score-pill ${scoreColor(role.matchScore)}`}>
            <div className="score-num">{role.matchScore}</div>
            <div className="score-label">fit</div>
          </div>
          {role.atsScoreAfter != null ? (
            <div className={`score-pill ${scoreColor(role.atsScoreAfter)}`}>
              <div className="score-num">{role.atsScoreAfter}</div>
              <div className="score-label">ats</div>
            </div>
          ) : null}
        </div>
      </div>

      {role.rankReason ? (
        <p className="mt-3 text-sm leading-relaxed text-[var(--ink-muted)] sm:mt-4">{role.rankReason}</p>
      ) : null}

      {role.skillMatches.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {role.skillMatches.slice(0, 5).map((s) => (
            <span key={s} className="chip">
              {s}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 border-t border-[var(--line)] pt-3.5 sm:mt-5 sm:gap-4 sm:pt-4 md:grid-cols-3">
        <div>
          <p className="stat-label">Contact</p>
          {contact ? (
            <div className="mt-1.5 text-sm">
              <p className="font-semibold tracking-tight">{contact.fullName}</p>
              {contact.email ? (
                <p className="break-all text-[var(--ink-muted)]">
                  {contact.email}{" "}
                  <span className="text-xs">({contact.emailStatus})</span>
                </p>
              ) : (
                <p className="muted">Email unavailable</p>
              )}
            </div>
          ) : (
            <p className="mt-1.5 text-sm muted">No contact yet</p>
          )}
        </div>
        <div className="hidden sm:block">
          <p className="stat-label">Outreach</p>
          {draft ? (
            <div className="mt-1.5 text-sm">
              <p className="font-semibold tracking-tight">{draft.subject}</p>
              <p className="mt-1 muted">{truncate(draft.body, 100)}</p>
            </div>
          ) : (
            <p className="mt-1.5 text-sm muted">Draft pending</p>
          )}
        </div>
        <div>
          <p className="stat-label">ATS resume</p>
          {role.tailoredResumeText ? (
            <p className="mt-1.5 text-sm font-semibold tracking-tight">
              Ready
              {role.atsScoreBefore != null && role.atsScoreAfter != null
                ? ` · ${role.atsScoreBefore}%→${role.atsScoreAfter}%`
                : ""}
            </p>
          ) : (
            <p className="mt-1.5 text-sm muted">Open to tailor</p>
          )}
        </div>
      </div>

      <div className="stack-actions mt-4 sm:mt-5">
        <Link className="btn btn-primary" href={`/roles/${role.id}`}>
          Open card
        </Link>
        <a className="btn btn-secondary" href={role.url} target="_blank" rel="noreferrer">
          View posting
        </a>
      </div>
    </article>
  );
}
