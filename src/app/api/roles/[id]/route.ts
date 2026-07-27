import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { safeJsonParse } from "@/lib/utils";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user?.profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const role = await prisma.role.findFirst({
    where: { id, profileId: user.profile.id },
    include: {
      contacts: true,
      drafts: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    role: {
      ...role,
      skillMatches: safeJsonParse(role.skillMatches, [] as string[]),
      skillGaps: safeJsonParse(role.skillGaps, [] as string[]),
    },
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user?.profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = (await req.json()) as { status?: string };
  if (!body.status || !["new", "shortlisted", "passed", "applied"].includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const existing = await prisma.role.findFirst({
    where: { id, profileId: user.profile.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const role = await prisma.role.update({
    where: { id },
    data: { status: body.status },
  });
  return NextResponse.json({ role });
}
