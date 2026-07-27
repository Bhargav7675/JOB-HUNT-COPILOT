import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { runJobHuntPipeline } from "@/lib/agent/pipeline";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.profile) {
    return NextResponse.json({ error: "Complete onboarding first." }, { status: 400 });
  }

  const { prisma } = await import("@/lib/db");
  const active = await prisma.agentRun.findFirst({
    where: { profileId: user.profile.id, status: "running" },
  });
  if (active) {
    return NextResponse.json({ error: "A run is already in progress.", runId: active.id }, { status: 409 });
  }

  try {
    const result = await runJobHuntPipeline({ profileId: user.profile.id, trigger: "manual" });
    return NextResponse.json({
      ok: true,
      ...result,
      message: "Agent finished. Drafts only — nothing was sent.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pipeline failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
