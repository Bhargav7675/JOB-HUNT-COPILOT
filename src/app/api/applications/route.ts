import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await requireUser();
  if (!user?.profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const applications = await prisma.application.findMany({
    where: { profileId: user.profile.id },
    include: {
      role: {
        select: {
          id: true,
          title: true,
          company: true,
          url: true,
          matchScore: true,
          atsScoreAfter: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ applications });
}
