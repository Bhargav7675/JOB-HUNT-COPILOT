import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  resumeExportBaseName,
  tailoredResumeToLatex,
  tailoredResumeToPdfBytes,
} from "@/lib/resume-formats";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

async function loadRole(id: string, profileId: string) {
  return prisma.role.findFirst({
    where: { id, profileId },
    include: { profile: { select: { fullName: true } } },
  });
}

export async function GET(req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user?.profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const url = new URL(req.url);
  const format = (url.searchParams.get("format") || "pdf").toLowerCase();

  const role = await loadRole(id, user.profile.id);
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!role.tailoredResumeText?.trim()) {
    return NextResponse.json(
      { error: "No tailored resume yet. Run Re-tailor first." },
      { status: 400 },
    );
  }

  const fullName = role.profile.fullName || user.profile.fullName;
  const base = resumeExportBaseName(role.company, role.title, fullName);

  if (format === "tex" || format === "latex") {
    const latex =
      role.tailoredLatex?.trim() ||
      tailoredResumeToLatex({
        fullName,
        company: role.company,
        title: role.title,
        resumeText: role.tailoredResumeText,
      });
    return new NextResponse(latex, {
      status: 200,
      headers: {
        "Content-Type": "application/x-tex; charset=utf-8",
        "Content-Disposition": `attachment; filename="${base}.tex"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (format === "txt" || format === "text") {
    return new NextResponse(role.tailoredResumeText, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${base}.txt"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // Default: real downloadable PDF (text-based, single-column)
  const bytes = tailoredResumeToPdfBytes({
    fullName,
    company: role.company,
    title: role.title,
    resumeText: role.tailoredResumeText,
  });

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${base}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
