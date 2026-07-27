import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasLlmKey, llmChat, type ChatMessage } from "@/lib/llm";
import { profileLlm } from "@/lib/profile-llm";
import { runJobHuntPipeline } from "@/lib/agent/pipeline";

export const runtime = "nodejs";
export const maxDuration = 120;

const bodySchema = z.object({
  message: z.string().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(8000),
      }),
    )
    .max(24)
    .optional(),
});

function wantsAgentRun(text: string) {
  return /\b(run (the )?agent|scout( now)?|start (a )?search|find (new )?jobs|refresh roles|auto[- ]?apply now)\b/i.test(
    text,
  );
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user?.profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = user.profile;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  const llm = profileLlm(profile);
  if (!hasLlmKey(llm)) {
    return NextResponse.json(
      {
        error:
          "Add your Claude or OpenAI API key in Settings first. This chat agent uses the same key as ranking and resume tailoring.",
      },
      { status: 400 },
    );
  }

  const roles = await prisma.role.findMany({
    where: { profileId: profile.id },
    orderBy: [{ matchScore: "desc" }, { updatedAt: "desc" }],
    take: 8,
    select: {
      id: true,
      title: true,
      company: true,
      location: true,
      matchScore: true,
      atsScoreAfter: true,
      status: true,
      rankReason: true,
      url: true,
    },
  });

  const latestRun = await prisma.agentRun.findFirst({
    where: { profileId: profile.id },
    orderBy: { createdAt: "desc" },
    select: { status: true, createdAt: true, rankedCount: true, error: true, trigger: true },
  });

  let runResult: Record<string, unknown> | null = null;
  if (wantsAgentRun(parsed.data.message)) {
    const active = await prisma.agentRun.findFirst({
      where: { profileId: profile.id, status: "running" },
    });
    if (!active) {
      try {
        runResult = await runJobHuntPipeline({ profileId: profile.id, trigger: "manual" });
      } catch (e) {
        runResult = { ok: false, error: e instanceof Error ? e.message : "Run failed" };
      }
    } else {
      runResult = { ok: false, error: "An agent run is already in progress." };
    }
  }

  const context = {
    user: { name: profile.fullName, email: profile.email, brief: profile.searchBrief, location: profile.locationPref },
    settings: {
      autoApplyEnabled: profile.autoApplyEnabled,
      autoApplyMinScore: profile.autoApplyMinScore,
      visaSponsorship: profile.visaSponsorship,
      scheduleTimezone: profile.scheduleTimezone,
      scheduleHourLocal: profile.scheduleHourLocal,
      overnightEnabled: profile.overnightEnabled,
    },
    latestRun,
    topRoles: roles,
    justRanAgent: runResult,
  };

  const system = `You are Job Hunt Copilot's in-app AI agent for ${profile.fullName}.
You help with job search strategy, reviewing ranked roles, outreach drafts, ATS resumes, and auto-apply settings.
Use ONLY the provided account context. Never invent emails, applications, or experience.
Be concise, premium, and actionable. Use short paragraphs or bullets.
If the user asked to run/scout/refresh and a run just completed, summarize the result clearly.
If they need an API key reminder: they configure one key in Settings and the same key powers ranking, tailoring, and this chat.
Do not claim you sent emails — outreach is copy-only unless they paste/send themselves.`;

  const messages: ChatMessage[] = [
    { role: "system", content: system },
    {
      role: "user",
      content: `Account context (JSON):\n${JSON.stringify(context).slice(0, 14000)}`,
    },
    ...(parsed.data.history || []).slice(-12).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: parsed.data.message },
  ];

  try {
    const reply = await llmChat(llm, messages, { temperature: 0.4 });
    return NextResponse.json({
      ok: true,
      reply: reply || "I couldn’t generate a reply. Try again.",
      runResult,
      provider: profile.llmProvider || "auto",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Agent failed" },
      { status: 500 },
    );
  }
}
