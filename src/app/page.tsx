import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LandingSplash } from "@/components/landing-splash";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  if (session) {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: { profile: true },
    });
    redirect(user?.profile ? "/dashboard" : "/onboarding");
  }

  return <LandingSplash />;
}
