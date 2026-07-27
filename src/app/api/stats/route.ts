import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = user.profile;
  if (!profile) {
    return NextResponse.json({
      ready: false,
      stats: { roles: 0, draftOutreach: 0, runs: 0, verifiedContacts: 0 },
      latestRun: null,
      topRoles: [],
      brief: null,
      name: user.name,
    });
  }

  const [roles, drafts, runs, verifiedContacts] = await Promise.all([
    prisma.role.count({ where: { profileId: profile.id } }),
    prisma.outreachDraft.count({
      where: { status: "draft", role: { profileId: profile.id } },
    }),
    prisma.agentRun.count({ where: { profileId: profile.id } }),
    prisma.contact.count({
      where: { profileId: profile.id, emailStatus: "verified" },
    }),
  ]);

  const latestRun = await prisma.agentRun.findFirst({
    where: { profileId: profile.id },
    orderBy: { createdAt: "desc" },
  });
  const topRoles = await prisma.role.findMany({
    where: { profileId: profile.id },
    orderBy: { matchScore: "desc" },
    take: 5,
    select: { id: true, title: true, company: true, matchScore: true },
  });

  return NextResponse.json({
    ready: true,
    stats: { roles, draftOutreach: drafts, runs, verifiedContacts },
    latestRun,
    topRoles,
    brief: profile.searchBrief,
    name: profile.fullName,
  });
}
