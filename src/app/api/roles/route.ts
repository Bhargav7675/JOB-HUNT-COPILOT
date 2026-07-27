import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { safeJsonParse } from "@/lib/utils";

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user?.profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const minScore = Number(searchParams.get("minScore") || "0");

  const roles = await prisma.role.findMany({
    where: {
      profileId: user.profile.id,
      ...(status ? { status } : {}),
      matchScore: { gte: minScore },
    },
    include: {
      contacts: true,
      drafts: { orderBy: { createdAt: "desc" } },
    },
    orderBy: [{ matchScore: "desc" }, { updatedAt: "desc" }],
    take: 100,
  });

  return NextResponse.json({
    roles: roles.map((r) => ({
      ...r,
      skillMatches: safeJsonParse(r.skillMatches, [] as string[]),
      skillGaps: safeJsonParse(r.skillGaps, [] as string[]),
    })),
  });
}
