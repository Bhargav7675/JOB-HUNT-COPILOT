import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { sendPushToUser } from "@/lib/push";

export async function POST() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await sendPushToUser(user.id, {
    title: "Job Hunt Copilot",
    body: "Push notifications are working.",
    url: "/dashboard",
    tag: "jhc-test",
  });

  if (result.skipped) {
    return NextResponse.json({ error: "Push is not configured on the server." }, { status: 503 });
  }

  return NextResponse.json({ ok: true, sent: result.sent });
}
