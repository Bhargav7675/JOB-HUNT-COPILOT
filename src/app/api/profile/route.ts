import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const profileSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  linkedinUrl: z.string().optional(),
  headline: z.string().optional(),
  searchBrief: z.string().min(8),
  locationPref: z.string().min(2, "Location is required"),
  experienceYears: z.number().int().min(0).max(50),
  voiceNotes: z.string().optional(),
  resumeText: z.string().min(40),
  resumeFileName: z.string().optional(),
  openaiApiKey: z.string().optional(),
  llmProvider: z.enum(["auto", "openai", "anthropic"]).optional(),
  llmModel: z.string().optional(),
  llmBaseUrl: z.string().optional(),
  hunterApiKey: z.string().optional(),
  adzunaAppId: z.string().optional(),
  adzunaAppKey: z.string().optional(),
  maxRolesPerRun: z.number().int().min(5).max(50).optional(),
  maxAgeDays: z.number().int().min(1).max(14).optional(),
  overnightEnabled: z.boolean().optional(),
  overnightHourUtc: z.number().int().min(0).max(23).optional(),
  scheduleTimezone: z.string().min(1).max(80).optional(),
  scheduleHourLocal: z.number().int().min(0).max(23).optional(),
  autoApplyEnabled: z.boolean().optional(),
  autoApplyMinScore: z.number().int().min(0).max(100).optional(),
  autoApplyMinAtsScore: z.number().int().min(0).max(100).optional(),
  maxAutoAppliesPerRun: z.number().int().min(0).max(20).optional(),
});

function mask(value: string) {
  if (value.length < 8) return "••••••••";
  return `${value.slice(0, 3)}••••${value.slice(-4)}`;
}

function looksMasked(value?: string) {
  return Boolean(value && value.includes("••••"));
}

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = user.profile;
  if (!profile) return NextResponse.json({ profile: null });

  return NextResponse.json({
    profile: {
      ...profile,
      openaiApiKey: profile.openaiApiKey ? mask(profile.openaiApiKey) : "",
      hunterApiKey: profile.hunterApiKey ? mask(profile.hunterApiKey) : "",
      adzunaAppKey: profile.adzunaAppKey ? mask(profile.adzunaAppKey) : "",
      hasLlm: Boolean(
        profile.openaiApiKey ||
          process.env.OPENAI_API_KEY ||
          process.env.ANTHROPIC_API_KEY ||
          process.env.LLM_API_KEY,
      ),
      hasOpenai: Boolean(profile.openaiApiKey || process.env.OPENAI_API_KEY),
      hasHunter: Boolean(profile.hunterApiKey || process.env.HUNTER_API_KEY),
      hasAdzuna: Boolean(
        (profile.adzunaAppId && profile.adzunaAppKey) ||
          (process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY),
      ),
    },
  });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const existing = user.profile;

  const scheduleHourLocal = data.scheduleHourLocal ?? data.overnightHourUtc;
  const overnightHourUtc = data.overnightHourUtc ?? data.scheduleHourLocal;

  const shared = {
    fullName: data.fullName,
    email: data.email,
    phone: data.phone || null,
    linkedinUrl: data.linkedinUrl || null,
    headline: data.headline,
    searchBrief: data.searchBrief,
    locationPref: data.locationPref.trim(),
    experienceYears: data.experienceYears,
    voiceNotes: data.voiceNotes,
    resumeText: data.resumeText,
    resumeFileName: data.resumeFileName,
    llmProvider: data.llmProvider,
    llmModel: data.llmModel || null,
    llmBaseUrl: data.llmBaseUrl || null,
    adzunaAppId: data.adzunaAppId || null,
    maxRolesPerRun: data.maxRolesPerRun,
    maxAgeDays: data.maxAgeDays,
    overnightEnabled: data.overnightEnabled,
    overnightHourUtc,
    scheduleTimezone: data.scheduleTimezone,
    scheduleHourLocal,
    autoApplyEnabled: data.autoApplyEnabled,
    autoApplyMinScore: data.autoApplyMinScore,
    autoApplyMinAtsScore: data.autoApplyMinAtsScore,
    maxAutoAppliesPerRun: data.maxAutoAppliesPerRun,
  };

  const profile = existing
    ? await prisma.profile.update({
        where: { id: existing.id },
        data: {
          ...shared,
          openaiApiKey: looksMasked(data.openaiApiKey) ? existing.openaiApiKey : data.openaiApiKey || null,
          hunterApiKey: looksMasked(data.hunterApiKey) ? existing.hunterApiKey : data.hunterApiKey || null,
          adzunaAppKey: looksMasked(data.adzunaAppKey) ? existing.adzunaAppKey : data.adzunaAppKey || null,
        },
      })
    : await prisma.profile.create({
        data: {
          userId: user.id,
          ...shared,
          openaiApiKey: data.openaiApiKey || null,
          hunterApiKey: data.hunterApiKey || null,
          adzunaAppKey: data.adzunaAppKey || null,
          llmProvider: data.llmProvider ?? "auto",
          maxRolesPerRun: data.maxRolesPerRun ?? 25,
          maxAgeDays: data.maxAgeDays ?? 2,
          overnightEnabled: data.overnightEnabled ?? true,
          overnightHourUtc: overnightHourUtc ?? 8,
          scheduleTimezone: data.scheduleTimezone ?? "UTC",
          scheduleHourLocal: scheduleHourLocal ?? 8,
          autoApplyEnabled: data.autoApplyEnabled ?? true,
          autoApplyMinScore: data.autoApplyMinScore ?? 70,
          autoApplyMinAtsScore: data.autoApplyMinAtsScore ?? 45,
          maxAutoAppliesPerRun: data.maxAutoAppliesPerRun ?? 5,
        },
      });

  return NextResponse.json({ profile: { id: profile.id } });
}
