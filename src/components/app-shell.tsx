"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CircleHelp, Goal, Home, LogOut, Map, Plus, Settings, Wrench } from "lucide-react";

import { cn } from "@/lib/cn";

const links = [
  { href: "/", label: "Matches", icon: Home },
  { href: "/matches/new", label: "New match", icon: Plus },
  { href: "/maps", label: "Maps", icon: Map },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/help", label: "Help", icon: CircleHelp },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login" || pathname === "/change-password") return <main className="min-h-screen">{children}</main>;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-pitch-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex min-w-0 shrink-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-300/30 bg-cyan-300/10 text-cyan-200 shadow-glow">
              <Goal size={22} strokeWidth={2.2} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-cyan-100">FEIRENSE · ANALYSIS</span>
              <span className="block truncate text-xs text-slate-400">Team, video and maps</span>
            </span>
          </Link>

          <div className="flex min-w-0 items-center gap-2 overflow-x-auto">
            <nav className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/[.03] p-1">
              {links.map(({ href, label, icon: Icon }) => {
                const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm text-slate-300 transition hover:bg-white/[.08] hover:text-white",
                      active && "bg-cyan-300/10 text-cyan-100 ring-1 ring-cyan-300/20",
                    )}
                  >
                    <Icon size={16} />
                    <span className="hidden sm:inline">{label}</span>
                  </Link>
                );
              })}
            </nav>
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/[.08] hover:text-white"
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1800px] px-4 py-5 sm:px-6">{children}</main>
    </div>
  );
}
