import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { safeJsonParse } from "@/lib/utils";

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user?.profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const runId = searchParams.get("runId");

  if (runId) {
    const run = await prisma.agentRun.findFirst({
      where: { id: runId, profileId: user.profile.id },
    });
    if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ run: { ...run, logs: safeJsonParse(run.logs, []) } });
  }

  const runs = await prisma.agentRun.findMany({
    where: { profileId: user.profile.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return NextResponse.json({
    runs: runs.map((r) => ({ ...r, logs: safeJsonParse(r.logs, []) })),
  });
}
