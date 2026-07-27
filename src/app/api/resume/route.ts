import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { extractResumeText } from "@/lib/resume";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const form = await req.formData();
    const file = form.get("file");
    const pasted = form.get("text");

    if (typeof pasted === "string" && pasted.trim().length > 40) {
      return NextResponse.json({ text: pasted.trim(), fileName: "pasted.txt" });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Upload a resume file or paste text." }, { status: 400 });
    }

    const text = await extractResumeText(file);
    return NextResponse.json({ text, fileName: file.name, mimeType: file.type });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Resume parse failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
