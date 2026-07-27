import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <AppShell title="Create your account" subtitle="Set up a private workspace in under a minute.">
      <AuthForm mode="signup" />
    </AppShell>
  );
}
