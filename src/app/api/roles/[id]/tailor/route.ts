import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { persistTailoredResume } from "@/lib/agent/pipeline";
import { safeJsonParse } from "@/lib/utils";
import type { RankedJob } from "@/lib/agent/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user?.profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const role = await prisma.role.findFirst({
    where: { id, profileId: user.profile.id },
  });
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const job: RankedJob = {
    externalId: role.externalId,
    source: role.source,
    title: role.title,
    company: role.company,
    location: role.location || undefined,
    remoteType: role.remoteType || undefined,
    url: role.url,
    description: role.description,
    postedAt: role.postedAt,
    matchScore: role.matchScore,
    rankReason: role.rankReason || "",
    skillMatches: safeJsonParse(role.skillMatches, [] as string[]),
    skillGaps: safeJsonParse(role.skillGaps, [] as string[]),
  };

  const { tailored } = await persistTailoredResume(role.id, user.profile.resumeText, job, {
    apiKey: user.profile.openaiApiKey,
    provider: user.profile.llmProvider,
    model: user.profile.llmModel,
    baseUrl: user.profile.llmBaseUrl,
  });

  return NextResponse.json({
    ok: true,
    atsScoreBefore: tailored.atsBefore.score,
    atsScoreAfter: tailored.atsAfter.score,
    changeSummary: tailored.changeSummary,
    tailoredResumeText: tailored.tailoredResumeText,
    resumeSuggestions: tailored.resumeSuggestions,
    matched: tailored.atsAfter.matched,
    missing: tailored.atsAfter.missing,
  });
}
