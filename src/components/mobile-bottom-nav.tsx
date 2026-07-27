"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bot, Briefcase, LayoutDashboard, LogOut, Settings } from "lucide-react";

const links = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/roles", label: "Roles", icon: Briefcase },
  { href: "/agent", label: "Agent", icon: Bot },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    router.push("/");
    router.refresh();
  }

  return (
    <nav className="mobile-nav" aria-label="Primary">
      {links.map((l) => {
        const Icon = l.icon;
        const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link key={l.href} href={l.href} className={active ? "active" : undefined}>
            <Icon />
            <span>{l.label}</span>
          </Link>
        );
      })}
      <button type="button" onClick={() => void logout()}>
        <LogOut />
        <span>Log out</span>
      </button>
    </nav>
  );
}
