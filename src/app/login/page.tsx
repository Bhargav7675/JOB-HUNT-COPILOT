import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <AppShell title="Sign in" subtitle="Email and password access to your private dashboard.">
      <AuthForm mode="login" />
    </AppShell>
  );
}
