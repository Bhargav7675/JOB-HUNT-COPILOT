import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { localHourInTimezone } from "@/lib/schedule";
import { runJobHuntPipeline } from "@/lib/agent/pipeline";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Scheduled runner for accounts with overnight/schedule enabled.
 * Authorization: Bearer <CRON_SECRET>
 *
 * Modes:
 * - Default (Vercel Hobby daily): run each enabled profile at most once/day.
 * - strict=1 (hourly external cron / Pro): only run when local hour matches preference.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const secret = process.env.CRON_SECRET || "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const strict = url.searchParams.get("strict") === "1" || process.env.CRON_STRICT_HOUR === "1";
  const now = new Date();

  const profiles = await prisma.profile.findMany({
    where: { overnightEnabled: true },
  });

  const results = [];
  for (const profile of profiles) {
    const tz = profile.scheduleTimezone || "UTC";
    const preferred =
      typeof profile.scheduleHourLocal === "number" ? profile.scheduleHourLocal : profile.overnightHourUtc;
    const localHour = localHourInTimezone(now, tz);

    if (!force && strict && localHour !== preferred) {
      results.push({
        profileId: profile.id,
        skipped: true,
        reason: `Waiting for ${preferred}:00 in ${tz} (now ${localHour}:00)`,
      });
      continue;
    }

    const active = await prisma.agentRun.findFirst({
      where: { profileId: profile.id, status: "running" },
    });
    if (active) {
      results.push({ profileId: profile.id, skipped: true, reason: "Already running" });
      continue;
    }

    if (!force) {
      const recent = await prisma.agentRun.findFirst({
        where: {
          profileId: profile.id,
          trigger: { in: ["cron", "overnight"] },
          createdAt: { gte: new Date(Date.now() - (strict ? 50 : 20) * 60 * 60 * 1000) },
        },
      });
      if (recent) {
        results.push({
          profileId: profile.id,
          skipped: true,
          reason: strict ? "Already ran in the last hour" : "Already ran in the last 20 hours",
        });
        continue;
      }
    }

    try {
      const result = await runJobHuntPipeline({
        profileId: profile.id,
        trigger: "cron",
      });
      results.push({
        profileId: profile.id,
        ok: true,
        schedule: { timezone: tz, preferredHour: preferred, localHour, strict },
        ...result,
      });
    } catch (error) {
      results.push({
        profileId: profile.id,
        ok: false,
        error: error instanceof Error ? error.message : "failed",
      });
    }
  }

  return NextResponse.json({ ok: true, mode: strict ? "strict-hour" : "daily", processed: results.length, results });
}
