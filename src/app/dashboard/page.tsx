import { redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { AppShell } from "@/components/app-shell";
import { InstallAppCard } from "@/components/install-app-card";
import { PushNotificationsCard } from "@/components/push-notifications-card";
import { RoleCard } from "@/components/role-card";
import { RunAgentButton } from "@/components/run-agent-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { safeJsonParse } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  if (!user) redirect("/login");
  if (!user.profile) redirect("/onboarding");
  const profile = user.profile;

  const [roles, latestRun, draftCount, verifiedCount] = await Promise.all([
    prisma.role.findMany({
      where: { profileId: profile.id },
      include: { contacts: true, drafts: { orderBy: { createdAt: "desc" } } },
      orderBy: [{ matchScore: "desc" }, { updatedAt: "desc" }],
      take: 20,
    }),
    prisma.agentRun.findFirst({
      where: { profileId: profile.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.outreachDraft.count({
      where: { status: "draft", role: { profileId: profile.id } },
    }),
    prisma.contact.count({
      where: { profileId: profile.id, emailStatus: "verified" },
    }),
  ]);

  return (
    <AppShell
      title="Morning dashboard"
      subtitle={`Brief: “${profile.searchBrief}”. Skim cards, copy what you like, send yourself.`}
    >
      <section className="stat-grid">
        {[
          { label: "Ranked roles", value: String(roles.length) },
          { label: "Draft outreach", value: String(draftCount) },
          { label: "Verified emails", value: String(verifiedCount) },
          {
            label: "Latest run",
            value: latestRun
              ? latestRun.status === "running"
                ? "Running"
                : formatDistanceToNow(latestRun.createdAt, { addSuffix: true })
              : "Not yet",
          },
        ].map((s, i) => (
          <div
            key={s.label}
            className="surface stat-card card-enter"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <p className="stat-label">{s.label}</p>
            <p className="display stat-value">{s.value}</p>
          </div>
        ))}
      </section>

      <section className="mb-5 space-y-5 sm:mb-8">
        <InstallAppCard />
        <PushNotificationsCard />
      </section>

      <section className="surface mb-5 rounded-[1.35rem] p-4 sm:mb-8 sm:rounded-[1.6rem] sm:p-6">
        <div className="flex flex-col gap-4">
          <div>
            <p className="eyebrow">Control</p>
            <h2 className="display mt-1 text-[1.55rem] sm:text-[1.85rem]">Run your agent</h2>
            <p className="mt-1.5 text-sm leading-relaxed muted">
              Stages: scout open roles from connected boards → analyze/rank against your real resume → tailored
              LaTeX/PDF → contacts &amp; outreach → optional autofill. Coverage is connected boards only — not every job
              on the internet.
            </p>
          </div>
          <RunAgentButton />
        </div>
        {latestRun?.error ? (
          <p className="mt-4 text-sm text-[var(--danger)]">Last error: {latestRun.error}</p>
        ) : null}
      </section>

      <section className="space-y-3 sm:space-y-4">
        <div className="flex items-end justify-between gap-3">
          <h2 className="display text-[1.65rem] sm:text-[2.15rem]">Best-fit roles</h2>
          <p className="text-xs font-semibold tracking-wide muted sm:text-sm">By match score</p>
        </div>
        {roles.length === 0 ? (
          <div className="surface rounded-[1.5rem] p-8 text-center sm:p-12">
            <p className="display text-[1.75rem] sm:text-3xl">Nothing here yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed muted">
              Run the agent once to populate ranked roles, tailored resumes, and outreach drafts.
            </p>
          </div>
        ) : (
          <div className="grid gap-3.5 sm:gap-4">
            {roles.map((role, index) => (
              <RoleCard
                key={role.id}
                index={index}
                role={{
                  ...role,
                  skillMatches: safeJsonParse(role.skillMatches, [] as string[]),
                }}
              />
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
