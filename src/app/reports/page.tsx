import Link from "next/link";
import { ArrowRight, BarChart3, FolderOutput, Map } from "lucide-react";

import { Button, Panel } from "@/components/ui";

export default function ReportsPage() {
  return <div className="space-y-5"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-leaf-400">Reports</p><h1 className="mt-2 text-3xl font-bold text-white">Exploration and export</h1><p className="mt-2 text-sm text-slate-400">The foundation is ready for filters, continuous playback and exports organized by moment and submoment.</p></div><div className="grid gap-4 md:grid-cols-3"><Card icon={Map} title="Aggregated maps" text="Filter occurrences by match and type." href="/maps" action="Open maps" /><Card icon={BarChart3} title="Metrics" text="Counts and spatial distribution will be refined with the coaching staff." /><Card icon={FolderOutput} title="Export clips" text="The local export engine will be connected after the final taxonomy is approved." /></div></div>;
}

function Card({ icon: Icon, title, text, href, action }: { icon: typeof Map; title: string; text: string; href?: string; action?: string }) {
  return <Panel className="p-5"><Icon className="text-leaf-400" /><h2 className="mt-4 font-bold text-white">{title}</h2><p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{text}</p>{href ? <Link href={href}><Button className="mt-4" size="sm">{action}<ArrowRight size={14} /></Button></Link> : <span className="mt-4 inline-block text-xs text-slate-600">To be defined</span>}</Panel>;
}
