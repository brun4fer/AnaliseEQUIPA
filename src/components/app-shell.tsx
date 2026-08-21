"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, CircleHelp, Goal, Home, LockKeyhole, LogOut, Map, Plus, Settings, Wrench } from "lucide-react";

import { ManagementAccessDialog } from "@/components/management-access-dialog";
import { cn } from "@/lib/cn";
import type { AccountPayload } from "@/lib/domain";
import { apiFetch } from "@/lib/http";

const links = [
  { href: "/", label: "Matches", icon: Home, protected: true },
  { href: "/matches/new", label: "New match", icon: Plus, protected: true },
  { href: "/maps", label: "Maps", icon: Map, protected: false },
  { href: "/reports", label: "Reports", icon: BarChart3, protected: false },
  { href: "/maintenance", label: "Maintenance", icon: Wrench, protected: true },
  { href: "/settings", label: "Settings", icon: Settings, protected: true },
  { href: "/help", label: "Help", icon: CircleHelp, protected: false },
];

function isManagementPath(pathname: string) {
  return pathname === "/" || pathname.startsWith("/matches") || pathname.startsWith("/maintenance") || pathname.startsWith("/settings") || pathname.startsWith("/analysis");
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [account, setAccount] = useState<AccountPayload | null>(null);
  const [showManagementAccess, setShowManagementAccess] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  useEffect(() => {
    if (!["/login", "/register", "/change-password", "/onboarding"].includes(pathname)) {
      apiFetch<AccountPayload>("/api/account").then((next) => {
        setAccount(next);
        if (!next.managementAccess.configured || (isManagementPath(pathname) && !next.managementAccess.unlocked)) setShowManagementAccess(true);
      }).catch(() => undefined);
    }
  }, [pathname]);
  if (pathname === "/login" || pathname === "/register" || pathname === "/change-password" || pathname === "/onboarding") return <main className="min-h-screen">{children}</main>;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-pitch-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-2 px-2 py-2 sm:gap-4 sm:px-4">
          <Link href="/" className="flex min-w-0 shrink-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-300/30 bg-cyan-300/10 text-cyan-200 shadow-glow">
              <Goal size={22} strokeWidth={2.2} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-cyan-100">{(account?.teamName || "TEAM").toUpperCase()} · ANALYSIS</span>
              <span className="block truncate text-xs text-slate-400">Team, video and maps</span>
            </span>
          </Link>

          <div className="flex min-w-0 items-center gap-2">
            <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-lg border border-white/10 bg-white/[.03] p-1 sm:flex-none">
              {links.map(({ href, label, icon: Icon, protected: needsManagement }) => {
                const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={(event) => {
                      if (needsManagement && account && !account.managementAccess.unlocked) {
                        event.preventDefault();
                        setPendingHref(href);
                        setShowManagementAccess(true);
                      }
                    }}
                    className={cn(
                      "inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm text-slate-300 transition hover:bg-white/[.08] hover:text-white",
                      active && "bg-cyan-300/10 text-cyan-100 ring-1 ring-cyan-300/20",
                    )}
                  >
                    <Icon size={16} />
                    <span className="hidden sm:inline">{label}</span>
                    {needsManagement && account && !account.managementAccess.unlocked ? <LockKeyhole size={10} className="text-amber-300" aria-label="Locked" /> : null}
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
      <main className="mx-auto max-w-[1800px] px-2 py-3 sm:px-4">{children}</main>
      {showManagementAccess && account ? <ManagementAccessDialog configured={account.managementAccess.configured} canDismiss={!isManagementPath(pathname)} onDismiss={() => { setShowManagementAccess(false); setPendingHref(null); }} onUnlocked={() => {
        setAccount({ ...account, managementAccess: { configured: true, unlocked: true } });
        setShowManagementAccess(false);
        const target = pendingHref;
        setPendingHref(null);
        if (target && target !== pathname) window.location.href = target;
        else if (isManagementPath(pathname)) window.location.reload();
      }} /> : null}
    </div>
  );
}
