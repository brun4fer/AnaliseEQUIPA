"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, Film, Loader2, MapPinned, Plus, Search } from "lucide-react";

import { Badge, Button, Input, Panel } from "@/components/ui";
import type { MatchSummary } from "@/lib/domain";
import { apiFetch } from "@/lib/http";

export function Dashboard() {
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    apiFetch<MatchSummary[]>("/api/matches").then(setMatches).catch((caught: Error) => setError(caught.message)).finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => matches.filter((match) => `${match.title} ${match.opponentName} ${match.competition}`.toLowerCase().includes(query.toLowerCase())), [matches, query]);
  const totalMoments = matches.reduce((sum, match) => sum + match.momentCount, 0);

  return <div className="space-y-6">
    <section className="flex flex-col gap-5 rounded-3xl border border-leaf-400/20 bg-gradient-to-br from-leaf-400/[.12] via-white/[.04] to-fire-500/[.07] p-6 shadow-glow lg:flex-row lg:items-end lg:justify-between">
      <div><Badge className="border-leaf-400/30 bg-leaf-400/10 text-leaf-400">OUR TEAM ANALYSIS</Badge><h1 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight text-white lg:text-5xl">From match video to spatial insight.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Tag moments and locate crosses, turnovers, shots and other events on the pitch and goal.</p></div>
      <Link href="/matches/new"><Button size="lg" variant="primary"><Plus size={17} />Create new match</Button></Link>
    </section>

    <div className="grid gap-4 md:grid-cols-3">
      <Metric icon={Film} label="Matches analyzed" value={matches.length} />
      <Metric icon={CalendarDays} label="Moments tagged" value={totalMoments} />
      <Metric icon={MapPinned} label="Maps" value="Pitch + goal" />
    </div>

    <Panel className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-white">Matches</h2><p className="mt-1 text-xs text-slate-500">Select a match to continue the analysis.</p></div><label className="relative block sm:w-80"><Search className="absolute left-3 top-2.5 text-slate-500" size={16} /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search opponent or competition" /></label></div>
      {loading ? <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-400"><Loader2 className="animate-spin" />Loading matches…</div> : error ? <div className="m-4 rounded-xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-100"><p className="font-semibold">The database is not configured yet.</p><p className="mt-1 text-amber-100/70">{error}</p><p className="mt-2">Fill in `.env.local`, then run `npm run prisma:push` followed by `npm run prisma:seed`.</p></div> : visible.length === 0 ? <div className="p-12 text-center text-sm text-slate-500">There are no matches to display yet.</div> : <div className="divide-y divide-white/[.06]">{visible.map((match) => <Link key={match.id} href={`/analysis/${match.id}`} className="flex items-center gap-4 p-4 transition hover:bg-white/[.045]"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-leaf-400/20 bg-leaf-400/10 text-leaf-400"><Film size={19} /></span><span className="min-w-0 flex-1"><span className="block truncate font-semibold text-white">{match.title}</span><span className="mt-1 block truncate text-xs text-slate-500">{match.competition || "No competition"}{match.matchDate ? ` · ${new Date(match.matchDate).toLocaleDateString("en-GB")}` : ""}</span></span><Badge>{match.momentCount} moments</Badge><ArrowRight className="text-slate-600" size={17} /></Link>)}</div>}
    </Panel>
  </div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Film; label: string; value: string | number }) {
  return <Panel className="flex items-center gap-4 p-4"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[.06] text-leaf-400"><Icon size={20} /></span><div><p className="text-2xl font-bold text-white">{value}</p><p className="text-xs text-slate-500">{label}</p></div></Panel>;
}
