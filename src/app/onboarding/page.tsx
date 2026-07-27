import { AppShell } from "@/components/app-shell";
import { OnboardingForm } from "@/components/onboarding-form";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await requireUser();
  if (!user) redirect("/signup");
  if (user.profile) redirect("/dashboard");

  return (
    <AppShell
      title={`Welcome, ${user.name.split(" ")[0]}`}
      subtitle="Upload your resume once. Tell the agent what you’re looking for in one line. It takes it from there."
    >
      <OnboardingForm defaultName={user.name} defaultEmail={user.email} />
    </AppShell>
  );
}
