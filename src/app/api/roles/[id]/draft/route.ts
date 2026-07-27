import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user?.profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: roleId } = await ctx.params;
  const body = (await req.json()) as { draftId?: string; action?: "approve" | "copied" | "discard" };
  if (!body.draftId || !body.action) {
    return NextResponse.json({ error: "draftId and action required" }, { status: 400 });
  }

  const role = await prisma.role.findFirst({
    where: { id: roleId, profileId: user.profile.id },
  });
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const draft = await prisma.outreachDraft.findFirst({
    where: { id: body.draftId, roleId },
  });
  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });

  const status =
    body.action === "approve" ? "approved" : body.action === "copied" ? "copied" : "discarded";

  const updated = await prisma.outreachDraft.update({
    where: { id: draft.id },
    data: { status },
  });

  return NextResponse.json({
    draft: updated,
    notice: "Draft updated. Email was NOT sent — copy and send yourself.",
  });
}
