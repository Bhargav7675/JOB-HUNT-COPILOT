import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { submitApplicationForRole } from "@/lib/agent/pipeline";

export const runtime = "nodejs";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user?.profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { force?: boolean };

  try {
    const application = await submitApplicationForRole({
      profileId: user.profile.id,
      roleId: id,
      force: Boolean(body.force),
    });
    return NextResponse.json({ ok: true, application });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Apply failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
