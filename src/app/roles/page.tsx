import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { RoleCard } from "@/components/role-card";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { safeJsonParse } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const user = await requireUser();
  if (!user) redirect("/login");
  if (!user.profile) redirect("/onboarding");

  const roles = await prisma.role.findMany({
    where: { profileId: user.profile.id },
    include: { contacts: true, drafts: { orderBy: { createdAt: "desc" } } },
    orderBy: [{ matchScore: "desc" }, { updatedAt: "desc" }],
  });

  return (
    <AppShell title="All roles" subtitle="Every scouted role ranked by fit. Open a card to review drafts and resume tweaks.">
      <div className="grid gap-4">
        {roles.length === 0 ? (
          <div className="surface rounded-[1.35rem] p-6 text-center muted sm:rounded-[1.6rem] sm:p-10">No roles yet — run the agent from the dashboard.</div>
        ) : (
          roles.map((role, index) => (
            <RoleCard
              key={role.id}
              index={index}
              role={{
                ...role,
                skillMatches: safeJsonParse(role.skillMatches, [] as string[]),
              }}
            />
          ))
        )}
      </div>
    </AppShell>
  );
}
