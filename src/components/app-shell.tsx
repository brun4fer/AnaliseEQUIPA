"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Home, Map, Plus, Settings, Shield } from "lucide-react";

import { cn } from "@/lib/cn";

const links = [
  { href: "/", label: "Jogos", icon: Home },
  { href: "/matches/new", label: "Novo jogo", icon: Plus },
  { href: "/maps", label: "Mapas", icon: Map },
  { href: "/reports", label: "Relatórios", icon: BarChart3 },
  { href: "/settings", label: "Configuração", icon: Settings }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <div className="min-h-screen">
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1700px] flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-7">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-leaf-400/30 bg-leaf-400/10 text-leaf-400 shadow-glow"><Shield size={23} /></span>
          <span><span className="block text-sm font-bold text-white">FEIRENSE · ANÁLISE</span><span className="block text-xs text-slate-500">Equipa, vídeo e mapas</span></span>
        </Link>
        <nav className="flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-black/20 p-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return <Link key={href} href={href} className={cn("flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition", active ? "bg-leaf-400 text-ink-950" : "text-slate-400 hover:bg-white/[.07] hover:text-white")}><Icon size={15} />{label}</Link>;
          })}
        </nav>
      </div>
    </header>
    <main className="mx-auto max-w-[1700px] px-4 py-6 lg:px-7">{children}</main>
  </div>;
}
