import { prisma } from "@/lib/db";
import type { LlmConfig } from "@/lib/llm";
import { autoApplyToRole, isLikelyAutoApplySupported } from "./auto-apply";
import { findContacts } from "./contacts";
import { draftOutreach } from "./outreach";
import { rankJobs } from "./rank";
import { formatPortalLog, scoutAllJobs } from "./scout";
import { tailorResumeForRole } from "./tailor-resume";
import type { PipelineProgress } from "./types";

function profileLlm(profile: {
  openaiApiKey?: string | null;
  llmProvider?: string | null;
  llmModel?: string | null;
  llmBaseUrl?: string | null;
}): LlmConfig {
  return {
    apiKey: profile.openaiApiKey,
    provider: profile.llmProvider || "auto",
    model: profile.llmModel,
    baseUrl: profile.llmBaseUrl,
  };
}

async function appendLog(runId: string, progress: PipelineProgress) {
  const run = await prisma.agentRun.findUnique({ where: { id: runId } });
  if (!run) return;
  const logs = JSON.parse(run.logs || "[]") as PipelineProgress[];
  logs.push(progress);
  await prisma.agentRun.update({
    where: { id: runId },
    data: { logs: JSON.stringify(logs) },
  });
}

async function persistTailoredResume(
  roleId: string,
  resumeText: string,
  job: Parameters<typeof tailorResumeForRole>[0]["job"],
  llm?: LlmConfig,
  fullName?: string,
) {
  const tailored = await tailorResumeForRole({
    resumeText,
    job,
    llm,
    fullName,
  });

  if (tailored.guardLog.length) {
    console.info(`[pipeline] hallucination guard for role ${roleId}:`, tailored.guardLog.slice(0, 15));
  }

  const updated = await prisma.role.update({
    where: { id: roleId },
    data: {
      resumeSuggestions: tailored.resumeSuggestions,
      tailoredResumeText: tailored.tailoredResumeText,
      tailoredLatex: tailored.tailoredLatex,
      atsScoreBefore: tailored.atsBefore.score,
      atsScoreAfter: tailored.atsAfter.score,
      atsKeywordsMatched: JSON.stringify(tailored.atsAfter.matched),
      atsKeywordsMissing: JSON.stringify(tailored.atsAfter.missing),
      atsExplanation: tailored.atsExplanation,
      resumeChangeSummary: tailored.changeSummary,
      resumeGuardLog: JSON.stringify(tailored.guardLog.slice(0, 40)),
    },
  });

  return { tailored, role: updated };
}

export async function submitApplicationForRole(options: {
  profileId: string;
  roleId: string;
  force?: boolean;
}) {
  const profile = await prisma.profile.findUnique({ where: { id: options.profileId } });
  if (!profile) throw new Error("Profile not found");

  const role = await prisma.role.findFirst({
    where: { id: options.roleId, profileId: options.profileId },
  });
  if (!role) throw new Error("Role not found");

  const existing = await prisma.application.findUnique({
    where: { profileId_roleId: { profileId: profile.id, roleId: role.id } },
  });
  if (existing?.status === "submitted" && !options.force) {
    return existing;
  }

  const application = existing
    ? await prisma.application.update({
        where: { id: existing.id },
        data: { status: "applying", error: null, applyUrl: role.url },
      })
    : await prisma.application.create({
        data: {
          profileId: profile.id,
          roleId: role.id,
          status: "applying",
          applyUrl: role.url,
        },
      });

  if (!isLikelyAutoApplySupported(role.url, role.source)) {
    return prisma.application.update({
      where: { id: application.id },
      data: {
        status: "unsupported",
        method: "unsupported",
        error: "This board is not autofill-supported yet (Greenhouse, Lever, Ashby). Open the posting and apply manually.",
      },
    });
  }

  const result = await autoApplyToRole({
    applyUrl: role.url,
    source: role.source,
    applicant: {
      fullName: profile.fullName,
      email: profile.email,
      phone: profile.phone,
      linkedinUrl: profile.linkedinUrl,
      locationPref: profile.locationPref,
      resumeText: profile.resumeText,
      tailoredResumeText: role.tailoredResumeText,
    },
  });

  const updated = await prisma.application.update({
    where: { id: application.id },
    data: {
      status: result.status,
      method: result.method,
      error: result.error,
      confirmationText: result.confirmationText,
      applyUrl: result.applyUrl,
      submittedAt: result.status === "submitted" ? new Date() : null,
    },
  });

  if (result.status === "submitted") {
    await prisma.role.update({
      where: { id: role.id },
      data: { status: "applied" },
    });
    try {
      const { sendPushToUser } = await import("@/lib/push");
      await sendPushToUser(profile.userId, {
        title: "Application submitted",
        body: `${role.title} @ ${role.company}`,
        url: `/roles/${role.id}`,
        tag: `apply-${role.id}`,
      });
    } catch {
      // ignore
    }
  } else if (result.status === "failed" || result.status === "unsupported") {
    try {
      const { sendPushToUser } = await import("@/lib/push");
      await sendPushToUser(profile.userId, {
        title: `Auto-apply ${result.status}`,
        body: `${role.title} @ ${role.company}${result.error ? ` — ${result.error.slice(0, 80)}` : ""}`,
        url: `/roles/${role.id}`,
        tag: `apply-${role.id}`,
      });
    } catch {
      // ignore
    }
  }

  return updated;
}

export async function runJobHuntPipeline(options: {
  profileId: string;
  trigger?: "manual" | "overnight" | "cron";
}) {
  const profile = await prisma.profile.findUnique({ where: { id: options.profileId } });
  if (!profile) throw new Error("Profile not found. Complete onboarding first.");

  const run = await prisma.agentRun.create({
    data: {
      profileId: profile.id,
      status: "running",
      trigger: options.trigger || "manual",
      startedAt: new Date(),
      logs: JSON.stringify([
        {
          stage: "start",
          message: "Agent run started",
          at: new Date().toISOString(),
        },
      ]),
    },
  });

  try {
    await appendLog(run.id, {
      stage: "scout",
      message: `Stage 1/5 — Scouting open & newly posted roles from connected boards (not the whole internet). Location: ${profile.locationPref || "United States"}, experience: ${profile.experienceYears} yrs${profile.visaSponsorship ? ", visa sponsorship needed" : ""}, max age ${profile.maxAgeDays}d…`,
      at: new Date().toISOString(),
    });

    const { jobs: scouted, portals, visaFilter } = await scoutAllJobs({
      brief: profile.searchBrief,
      location: profile.locationPref || "United States",
      experienceYears: profile.experienceYears,
      visaSponsorship: profile.visaSponsorship,
      maxAgeDays: profile.maxAgeDays,
      adzunaAppId: profile.adzunaAppId,
      adzunaAppKey: profile.adzunaAppKey,
    });

    await appendLog(run.id, {
      stage: "scout",
      message: `Portals queried — ${formatPortalLog(portals)}`,
      at: new Date().toISOString(),
    });

    if (visaFilter.needed && visaFilter.message) {
      await appendLog(run.id, {
        stage: "scout",
        message: visaFilter.message,
        at: new Date().toISOString(),
      });
    }

    await prisma.agentRun.update({
      where: { id: run.id },
      data: { scoutingCount: scouted.length },
    });

    await appendLog(run.id, {
      stage: "scout",
      message: `Found ${scouted.length} open roles from connected boards matching your brief`,
      at: new Date().toISOString(),
    });

    await appendLog(run.id, {
      stage: "rank",
      message: "Stage 2/5 — LLM analyzing & ranking roles against your real resume (no invented skills)…",
      at: new Date().toISOString(),
    });

    const ranked = await rankJobs({
      resumeText: profile.resumeText,
      brief: [
        profile.searchBrief,
        `Target location: ${profile.locationPref || "United States"}`,
        `Years of experience: ${profile.experienceYears}`,
        profile.visaSponsorship
          ? "Candidate needs visa sponsorship (H-1B / work authorization). Prefer roles that mention sponsorship, H-1B, OPT, or will sponsor."
          : null,
      ]
        .filter(Boolean)
        .join(". "),
      jobs: scouted,
      visaSponsorship: profile.visaSponsorship,
      llm: profileLlm(profile),
    });

    const top = ranked.slice(0, profile.maxRolesPerRun);

    await prisma.agentRun.update({
      where: { id: run.id },
      data: { rankedCount: top.length },
    });

    let contactCount = 0;
    let draftCount = 0;
    let applyCount = 0;

    for (const job of top) {
      const role = await prisma.role.upsert({
        where: {
          profileId_externalId: {
            profileId: profile.id,
            externalId: job.externalId,
          },
        },
        create: {
          profileId: profile.id,
          runId: run.id,
          externalId: job.externalId,
          source: job.source,
          title: job.title,
          company: job.company,
          location: job.location,
          remoteType: job.remoteType,
          url: job.url,
          description: job.description,
          postedAt: job.postedAt || undefined,
          matchScore: job.matchScore,
          rankReason: job.rankReason,
          skillMatches: JSON.stringify(job.skillMatches),
          skillGaps: JSON.stringify(job.skillGaps),
          status: "new",
        },
        update: {
          runId: run.id,
          matchScore: job.matchScore,
          rankReason: job.rankReason,
          skillMatches: JSON.stringify(job.skillMatches),
          skillGaps: JSON.stringify(job.skillGaps),
          description: job.description,
          url: job.url,
          postedAt: job.postedAt || undefined,
        },
      });

      await appendLog(run.id, {
        stage: "resume",
        message: `Stage 3/5 — ATS-tailoring + LaTeX/PDF for ${job.title} @ ${job.company} (facts from your resume only)`,
        at: new Date().toISOString(),
      });

      const { role: tailoredRole } = await persistTailoredResume(
        role.id,
        profile.resumeText,
        job,
        profileLlm(profile),
        profile.fullName,
      );

      // Autofill / auto-apply for high-fit roles when enabled
      if (
        profile.autoApplyEnabled &&
        applyCount < profile.maxAutoAppliesPerRun &&
        job.matchScore >= profile.autoApplyMinScore &&
        (tailoredRole.atsScoreAfter ?? 0) >= profile.autoApplyMinAtsScore
      ) {
        await appendLog(run.id, {
          stage: "apply",
          message: `Autofilling application for ${job.title} @ ${job.company}`,
          at: new Date().toISOString(),
        });
        try {
          const application = await submitApplicationForRole({
            profileId: profile.id,
            roleId: role.id,
          });
          if (application.status === "submitted") applyCount += 1;
          await appendLog(run.id, {
            stage: "apply",
            message: `Autofill ${application.status} for ${job.company}`,
            at: new Date().toISOString(),
          });
        } catch (error) {
          await appendLog(run.id, {
            stage: "apply",
            message: `Autofill error: ${error instanceof Error ? error.message : "failed"}`,
            at: new Date().toISOString(),
          });
        }
      }

      if (job.matchScore < 55) continue;

      await appendLog(run.id, {
        stage: "contacts",
        message: `Stage 4/5 — Contacts + outreach drafts for ${job.title} @ ${job.company}`,
        at: new Date().toISOString(),
      });

      const contacts = await findContacts({
        job,
        hunterApiKey: profile.hunterApiKey,
      });

      await prisma.outreachDraft.deleteMany({ where: { roleId: role.id } });
      await prisma.contact.deleteMany({ where: { roleId: role.id } });

      for (const c of contacts) {
        const contact = await prisma.contact.create({
          data: {
            profileId: profile.id,
            roleId: role.id,
            fullName: c.fullName,
            title: c.title,
            email: c.email,
            emailStatus: c.emailStatus,
            confidence: c.confidence,
            linkedinUrl: c.linkedinUrl,
            source: c.source,
          },
        });
        contactCount += 1;

        const outreach = await draftOutreach({
          fullName: profile.fullName,
          voiceNotes: profile.voiceNotes,
          resumeText: profile.resumeText,
          job,
          contact: c,
          llm: profileLlm(profile),
        });

        await prisma.outreachDraft.create({
          data: {
            roleId: role.id,
            contactId: contact.id,
            subject: outreach.subject,
            body: outreach.body,
            status: "draft",
          },
        });
        draftCount += 1;
      }
    }

    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "completed",
        finishedAt: new Date(),
        contactCount,
        draftCount,
      },
    });

    await appendLog(run.id, {
      stage: "done",
      message: `Stage 5/5 done. Ranked ${top.length} roles from connected boards, tailored LaTeX/PDF resumes, ${applyCount} autofilled/applied, ${contactCount} contacts, ${draftCount} drafts.`,
      at: new Date().toISOString(),
    });

    // Notify the account owner
    try {
      const { sendPushToUser } = await import("@/lib/push");
      const owner = await prisma.profile.findUnique({
        where: { id: profile.id },
        select: { userId: true },
      });
      if (owner) {
        const topRole = top[0];
        await sendPushToUser(owner.userId, {
          title: "Agent run finished",
          body: topRole
            ? `${top.length} roles ranked · ${applyCount} applied. Top: ${topRole.title} @ ${topRole.company}`
            : `${top.length} roles ranked · ${applyCount} auto-applied.`,
          url: "/dashboard",
          tag: `run-${run.id}`,
        });
      }
    } catch {
      // push should never fail the pipeline
    }

    return {
      runId: run.id,
      ranked: top.length,
      contacts: contactCount,
      drafts: draftCount,
      applied: applyCount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown pipeline failure";
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        error: message,
      },
    });
    await appendLog(run.id, {
      stage: "error",
      message,
      at: new Date().toISOString(),
    });
    throw error;
  }
}

export { persistTailoredResume };
