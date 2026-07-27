import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <AppShell title="Reset access" subtitle="Recover your account with a one-time password reset link.">
      <ForgotPasswordForm />
    </AppShell>
  );
}
