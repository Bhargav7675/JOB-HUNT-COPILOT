import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ token?: string }> };

export default async function ResetPasswordPage({ searchParams }: Props) {
  const session = await getSession();
  if (session) redirect("/dashboard");

  const { token } = await searchParams;

  return (
    <AppShell title="New password" subtitle="Choose a strong password you haven’t used elsewhere.">
      <ResetPasswordForm token={token || ""} />
    </AppShell>
  );
}
