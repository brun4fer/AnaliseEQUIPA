import Link from "next/link";
import { ArrowRight, BarChart3, FolderOutput, Map } from "lucide-react";

import { Button, Panel } from "@/components/ui";

export default function ReportsPage() {
  return <div className="space-y-5"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-leaf-400">Relatórios</p><h1 className="mt-2 text-3xl font-bold text-white">Exploração e exportação</h1><p className="mt-2 text-sm text-slate-400">A base está preparada para filtros, reprodução contínua e exportação organizada por momento e submomento.</p></div><div className="grid gap-4 md:grid-cols-3"><Card icon={Map} title="Mapas agregados" text="Filtra ocorrências por jogo e por tipo." href="/maps" action="Abrir mapas" /><Card icon={BarChart3} title="Indicadores" text="Contagens e distribuição espacial serão afinadas com a equipa técnica." /><Card icon={FolderOutput} title="Exportar clips" text="O motor local de exportação será ligado depois de fecharmos a taxonomia final." /></div></div>;
}

function Card({ icon: Icon, title, text, href, action }: { icon: typeof Map; title: string; text: string; href?: string; action?: string }) {
  return <Panel className="p-5"><Icon className="text-leaf-400" /><h2 className="mt-4 font-bold text-white">{title}</h2><p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{text}</p>{href ? <Link href={href}><Button className="mt-4" size="sm">{action}<ArrowRight size={14} /></Button></Link> : <span className="mt-4 inline-block text-xs text-slate-600">A definir</span>}</Panel>;
}
