"use client";

import { useEffect, useMemo, useState } from "react";
import { Filter, Loader2, MapPinned, Target } from "lucide-react";

import { GoalSurface, PitchSurface } from "@/components/analysis-surfaces";
import { Badge, Label, Panel, Select } from "@/components/ui";
import type { MapPoint, MatchSummary, SettingsPayload } from "@/lib/domain";
import { apiFetch } from "@/lib/http";

export function MapsDashboard() {
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [matchId, setMatchId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([apiFetch<MapPoint[]>("/api/maps"), apiFetch<MatchSummary[]>("/api/matches"), apiFetch<SettingsPayload>("/api/settings")])
      .then(([mapPoints, matchRows, settingsData]) => { setPoints(mapPoints); setMatches(matchRows); setSettings(settingsData); })
      .catch((caught: Error) => setError(caught.message)).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => points.filter((point) => (!matchId || point.matchId === matchId) && (!typeId || point.subMomentTypeId === typeId)), [matchId, points, typeId]);
  const fieldPoints = filtered.filter((point) => point.fieldX !== null && point.fieldY !== null).map((point) => ({ id: point.id, x: point.fieldX!, y: point.fieldY!, color: point.color, label: `${point.subMomentTypeName} · ${point.matchTitle}` }));
  const goalPoints = filtered.filter((point) => point.goalX !== null && point.goalY !== null).map((point) => ({ id: point.id, x: point.goalX!, y: point.goalY!, color: point.color, label: `${point.subMomentTypeName} · ${point.matchTitle}` }));

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-slate-400"><Loader2 className="mr-2 animate-spin" />A construir mapas…</div>;
  return <div className="space-y-5">
    <div><p className="text-xs font-bold uppercase tracking-[.22em] text-leaf-400">Leitura espacial</p><h1 className="mt-2 text-3xl font-bold text-white">Mapas de ocorrências</h1><p className="mt-2 text-sm text-slate-400">Cada ponto representa um submomento; a cor identifica imediatamente o tipo.</p></div>
    {error ? <Panel className="border-red-400/20 p-4 text-red-100">{error}</Panel> : null}
    <Panel className="grid gap-4 p-4 md:grid-cols-[1fr_1fr_auto] md:items-end"><label className="grid gap-2"><Label>Jogo</Label><Select value={matchId} onChange={(event) => setMatchId(event.target.value)}><option value="">Todos os jogos</option>{matches.map((match) => <option key={match.id} value={match.id}>{match.title}</option>)}</Select></label><label className="grid gap-2"><Label>Submomento</Label><Select value={typeId} onChange={(event) => setTypeId(event.target.value)}><option value="">Todos os tipos</option>{settings?.subMomentTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</Select></label><Badge className="h-10 justify-center px-4"><Filter size={14} className="mr-2" />{filtered.length} ocorrências</Badge></Panel>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,.65fr)]">
      <Panel className="p-4"><div className="flex items-center justify-between"><div><Label>Campo</Label><p className="mt-1 text-xs text-slate-500">Origem ou local da ação.</p></div><MapPinned className="text-leaf-400" /></div><PitchSurface className="mt-4" points={fieldPoints} /></Panel>
      <Panel className="p-4"><div className="flex items-center justify-between"><div><Label>Baliza</Label><p className="mt-1 text-xs text-slate-500">Destino de remates e ações configuradas.</p></div><Target className="text-fire-400" /></div><GoalSurface className="mt-4" points={goalPoints} /></Panel>
    </div>
    <Panel className="p-4"><Label>Legenda</Label><div className="mt-3 flex flex-wrap gap-2">{settings?.subMomentTypes.map((type) => { const count = filtered.filter((point) => point.subMomentTypeId === type.id).length; return <span key={type.id} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[.04] px-3 py-2 text-xs text-slate-300"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: type.color }} />{type.name}<strong className="text-white">{count}</strong></span>; })}</div></Panel>
  </div>;
}
