import Link from "next/link";
import { getSession } from "@/lib/auth";
import { BrandLogo } from "@/components/brand-logo";
import { LogoutButton } from "@/components/logout-button";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/roles", label: "Roles" },
  { href: "/agent", label: "Agent" },
  { href: "/settings", label: "Settings" },
];

export async function AppShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  const session = await getSession();

  return (
    <div className={`shell ${session ? "shell-authed" : ""}`}>
      <header className="shell-header">
        <div className="min-w-0 flex-1">
          <BrandLogo href={session ? "/dashboard" : "/"} size="md" />
          <p className="mt-1.5 hidden text-[0.82rem] font-medium tracking-wide muted sm:block">
            Scout · Rank · Tailor · Apply
            {session ? ` · ${session.name}` : ""}
          </p>
          {session ? <p className="mt-1 truncate text-xs font-medium muted sm:hidden">{session.name}</p> : null}
        </div>

        {session ? (
          <nav className="desktop-nav flex flex-wrap items-center justify-end gap-2">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="btn btn-ghost !min-h-10 !px-3.5 !py-2 text-sm">
                {l.label}
              </Link>
            ))}
            <LogoutButton />
          </nav>
        ) : (
          <nav className="flex shrink-0 items-center gap-2">
            <Link href="/login" className="btn btn-secondary !min-h-10 !px-3 !py-2 text-sm sm:!px-4">
              Sign in
            </Link>
            <Link href="/signup" className="btn btn-primary !min-h-10 !px-3 !py-2 text-sm sm:!px-4">
              Start
            </Link>
          </nav>
        )}
      </header>

      <div className="page-header">
        <h1 className="display page-title">{title}</h1>
        {subtitle ? <p className="page-sub">{subtitle}</p> : null}
      </div>

      {children}
      {session ? <MobileBottomNav /> : null}
    </div>
  );
}
