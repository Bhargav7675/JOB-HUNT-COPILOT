import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { InstallAppCard } from "@/components/install-app-card";
import { PushNotificationsCard } from "@/components/push-notifications-card";
import { SettingsForm } from "@/components/settings-form";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  if (!user) redirect("/login");
  if (!user.profile) redirect("/onboarding");
  const profile = user.profile;

  return (
    <AppShell title="Settings" subtitle="AI keys, schedule, autofill applications, and account details.">
      <div className="mb-6 space-y-5">
        <InstallAppCard />
        <PushNotificationsCard />
      </div>
      <SettingsForm
        initial={{
          fullName: profile.fullName,
          email: profile.email,
          phone: profile.phone,
          linkedinUrl: profile.linkedinUrl,
          headline: profile.headline,
          searchBrief: profile.searchBrief,
          locationPref: profile.locationPref,
          experienceYears: profile.experienceYears,
          voiceNotes: profile.voiceNotes,
          resumeText: profile.resumeText,
          openaiApiKey: profile.openaiApiKey ? `${profile.openaiApiKey.slice(0, 3)}••••${profile.openaiApiKey.slice(-4)}` : "",
          llmProvider: (profile.llmProvider as "auto" | "openai" | "anthropic") || "auto",
          llmModel: profile.llmModel || "",
          llmBaseUrl: profile.llmBaseUrl || "",
          hunterApiKey: profile.hunterApiKey ? `${profile.hunterApiKey.slice(0, 3)}••••${profile.hunterApiKey.slice(-4)}` : "",
          adzunaAppId: profile.adzunaAppId,
          adzunaAppKey: profile.adzunaAppKey ? `${profile.adzunaAppKey.slice(0, 3)}••••${profile.adzunaAppKey.slice(-4)}` : "",
          maxRolesPerRun: profile.maxRolesPerRun,
          maxAgeDays: profile.maxAgeDays,
          overnightEnabled: profile.overnightEnabled,
          overnightHourUtc: profile.overnightHourUtc,
          scheduleTimezone: profile.scheduleTimezone || "UTC",
          scheduleHourLocal: profile.scheduleHourLocal ?? profile.overnightHourUtc ?? 8,
          autoApplyEnabled: profile.autoApplyEnabled,
          autoApplyMinScore: profile.autoApplyMinScore,
          autoApplyMinAtsScore: profile.autoApplyMinAtsScore,
          maxAutoAppliesPerRun: profile.maxAutoAppliesPerRun,
        }}
      />
    </AppShell>
  );
}
