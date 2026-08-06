"use client";

import { useEffect, useMemo, useState } from "react";
import { Filter, Loader2, MapPinned, Target } from "lucide-react";

import { GoalSurface, PitchSurface } from "@/components/analysis-surfaces";
import { Badge, Label, Panel, Select } from "@/components/ui";
import type { MapPoint, MatchSummary, SettingsPayload } from "@/lib/domain";
import { apiFetch } from "@/lib/http";
import { normalizeFieldX, type AttackDirection } from "@/lib/match-periods";
import { formatTime } from "@/lib/time";

export function MapsDashboard() {
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [matchId, setMatchId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [period, setPeriod] = useState("identified");
  const [orientation, setOrientation] = useState<"normalized" | "original">("normalized");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([apiFetch<MapPoint[]>("/api/maps"), apiFetch<MatchSummary[]>("/api/matches"), apiFetch<SettingsPayload>("/api/settings")])
      .then(([mapPoints, matchRows, settingsData]) => { setPoints(mapPoints); setMatches(matchRows); setSettings(settingsData); })
      .catch((caught: Error) => setError(caught.message)).finally(() => setLoading(false));
  }, []);

  const baseFiltered = useMemo(() => points.filter((point) => (!matchId || point.matchId === matchId) && (!typeId || point.subMomentTypeId === typeId)), [matchId, points, typeId]);
  const filtered = useMemo(() => baseFiltered.filter((point) => {
    if (period === "identified") return point.period !== null;
    if (period === "unassigned") return point.period === null;
    if (period === "all") return true;
    return point.period === period;
  }), [baseFiltered, period]);
  const unassignedCount = baseFiltered.filter((point) => point.period === null).length;
  const fieldPoints = filtered.filter((point) => point.fieldX !== null && point.fieldY !== null).map((point) => ({
    id: point.id,
    x: orientation === "normalized" && point.attackDirection ? normalizeFieldX(point.fieldX!, point.attackDirection) : point.fieldX!,
    y: point.fieldY!,
    color: point.color,
    label: point.subMomentTypeName,
    details: [point.timeSeconds === null ? "Time not recorded" : `Time: ${formatTime(point.timeSeconds)}`, `Match: ${point.matchTitle}`]
  }));
  const goalPoints = filtered.filter((point) => point.goalX !== null && point.goalY !== null).map((point) => ({ id: point.id, x: point.goalX!, y: point.goalY!, color: point.color, label: point.subMomentTypeName, details: [point.timeSeconds === null ? "Time not recorded" : `Time: ${formatTime(point.timeSeconds)}`, `Match: ${point.matchTitle}`] }));
  const directions = new Set(filtered.map((point) => point.attackDirection).filter((direction): direction is AttackDirection => direction !== null));
  const filteredHasUnassigned = filtered.some((point) => point.period === null);
  const pitchDirection: AttackDirection | null = orientation === "normalized" && directions.size > 0 ? "left_to_right" : directions.size === 1 && !filteredHasUnassigned ? [...directions][0] : null;

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-slate-400"><Loader2 className="mr-2 animate-spin" />Building maps…</div>;
  return <div className="space-y-5">
    <div><p className="text-xs font-bold uppercase tracking-[.22em] text-leaf-400">Spatial analysis</p><h1 className="mt-2 text-3xl font-bold text-white">Occurrence maps</h1><p className="mt-2 text-sm text-slate-400">Each point represents a submoment; its color identifies the type.</p></div>
    {error ? <Panel className="border-red-400/20 p-4 text-red-100">{error}</Panel> : null}
    <Panel className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_.8fr_1fr_auto] xl:items-end"><label className="grid gap-2"><Label>Match</Label><Select value={matchId} onChange={(event) => setMatchId(event.target.value)}><option value="">All matches</option>{matches.map((match) => <option key={match.id} value={match.id}>{match.title}</option>)}</Select></label><label className="grid gap-2"><Label>Submoment</Label><Select value={typeId} onChange={(event) => setTypeId(event.target.value)}><option value="">All types</option>{settings?.subMomentTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</Select></label><label className="grid gap-2"><Label>Match period</Label><Select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="identified">Identified halves</option><option value="first_half">1st half</option><option value="second_half">2nd half</option><option value="unassigned">Unassigned</option><option value="all">All occurrences</option></Select></label> <div className="grid gap-1"><Badge className="h-10 justify-center px-4"><Filter size={14} className="mr-2" />{filtered.length} occurrences</Badge>{unassignedCount > 0 ? <span className="text-center text-[10px] text-amber-200">{unassignedCount} awaiting period markers</span> : null}</div></Panel>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,.65fr)]">
      <Panel className="p-4"><div className="flex items-center justify-between"><div><Label>Pitch</Label><p className="mt-1 text-xs text-slate-500">{orientation === "normalized" ? "Only identified periods are comparable; their attacks are aligned to the right." : "Points are shown at their original pitch coordinates."}</p></div><MapPinned className="text-leaf-400" /></div><PitchSurface className="mt-4" points={fieldPoints} direction={pitchDirection} directionLabel={orientation === "normalized" ? "Normalized attack" : "Attack"} /></Panel>
      <Panel className="p-4"><div className="flex items-center justify-between"><div><Label>Goal</Label><p className="mt-1 text-xs text-slate-500">Destination of shots and configured actions.</p></div><Target className="text-fire-400" /></div><GoalSurface className="mt-4" points={goalPoints} /></Panel>
    </div>
    <Panel className="p-4"><Label>Legend</Label><div className="mt-3 flex flex-wrap gap-2">{settings?.subMomentTypes.map((type) => { const count = filtered.filter((point) => point.subMomentTypeId === type.id).length; return <span key={type.id} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[.04] px-3 py-2 text-xs text-slate-300"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: type.color }} />{type.name}<strong className="text-white">{count}</strong></span>; })}</div></Panel>
  </div>;
}
