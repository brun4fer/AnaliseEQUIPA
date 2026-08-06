"use client";

import { useEffect, useState } from "react";
import { Crosshair, Loader2, Plus, Target } from "lucide-react";

import { Badge, Button, Input, Label, Panel } from "@/components/ui";
import type { MomentTypeRecord, SettingsPayload, SubMomentTypeRecord } from "@/lib/domain";
import { apiFetch } from "@/lib/http";

export function SettingsClient() {
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [momentForm, setMomentForm] = useState({ name: "", code: "", color: "#2dd66f" });
  const [subForm, setSubForm] = useState({ name: "", code: "", color: "#38bdf8", requiresFieldLocation: true, requiresGoalLocation: false });

  useEffect(() => { apiFetch<SettingsPayload>("/api/settings").then(setSettings).catch((caught: Error) => setError(caught.message)).finally(() => setLoading(false)); }, []);

  async function addMoment(event: React.FormEvent) {
    event.preventDefault(); if (!settings) return;
    try { const saved = await apiFetch<MomentTypeRecord>("/api/settings/moment-types", { method: "POST", body: JSON.stringify(momentForm) }); setSettings({ ...settings, momentTypes: [...settings.momentTypes, saved] }); setMomentForm({ name: "", code: "", color: "#2dd66f" }); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível guardar."); }
  }

  async function addSubmoment(event: React.FormEvent) {
    event.preventDefault(); if (!settings) return;
    try { const saved = await apiFetch<SubMomentTypeRecord>("/api/settings/submoment-types", { method: "POST", body: JSON.stringify(subForm) }); setSettings({ ...settings, subMomentTypes: [...settings.subMomentTypes, saved] }); setSubForm({ name: "", code: "", color: "#38bdf8", requiresFieldLocation: true, requiresGoalLocation: false }); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível guardar."); }
  }

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-slate-400"><Loader2 className="mr-2 animate-spin" />A carregar configuração…</div>;
  if (!settings) return <Panel className="p-4 text-red-100">{error}</Panel>;
  return <div className="space-y-5"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-leaf-400">Taxonomia configurável</p><h1 className="mt-2 text-3xl font-bold text-white">Momentos e submomentos</h1><p className="mt-2 text-sm text-slate-400">As cores usadas nos botões são as mesmas usadas nos pontos do campo e da baliza.</p></div>{error ? <div className="rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-100">{error}</div> : null}<div className="grid gap-5 xl:grid-cols-2">
    <Panel className="overflow-hidden"><div className="border-b border-white/10 p-4"><Label>Tipos de momento</Label></div><div className="divide-y divide-white/[.06]">{settings.momentTypes.map((type) => <div key={type.id} className="flex items-center gap-3 p-3"><span className="h-4 w-4 rounded-full" style={{ backgroundColor: type.color }} /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-white">{type.name}</span><span className="text-xs text-slate-500">{type.code}</span></span>{type.defaultShortcut ? <Badge>{type.defaultShortcut}</Badge> : null}</div>)}</div><form onSubmit={addMoment} className="grid gap-3 border-t border-white/10 bg-black/10 p-4 sm:grid-cols-[1fr_8rem_4rem_auto]"><Input placeholder="Nome" value={momentForm.name} onChange={(event) => setMomentForm({ ...momentForm, name: event.target.value })} required /><Input placeholder="Código" value={momentForm.code} onChange={(event) => setMomentForm({ ...momentForm, code: event.target.value.toUpperCase() })} required /><Input type="color" className="p-1" value={momentForm.color} onChange={(event) => setMomentForm({ ...momentForm, color: event.target.value })} /><Button variant="primary"><Plus size={15} />Adicionar</Button></form></Panel>
    <Panel className="overflow-hidden"><div className="border-b border-white/10 p-4"><Label>Tipos de submomento</Label></div><div className="divide-y divide-white/[.06]">{settings.subMomentTypes.map((type) => <div key={type.id} className="flex items-center gap-3 p-3"><span className="h-4 w-4 rounded-full" style={{ backgroundColor: type.color }} /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-white">{type.name}</span><span className="text-xs text-slate-500">{type.code}</span></span>{type.requiresFieldLocation ? <Badge><Crosshair size={12} className="mr-1" />Campo</Badge> : null}{type.requiresGoalLocation ? <Badge><Target size={12} className="mr-1" />Baliza</Badge> : null}</div>)}</div><form onSubmit={addSubmoment} className="space-y-3 border-t border-white/10 bg-black/10 p-4"><div className="grid gap-3 sm:grid-cols-[1fr_8rem_4rem]"><Input placeholder="Nome" value={subForm.name} onChange={(event) => setSubForm({ ...subForm, name: event.target.value })} required /><Input placeholder="Código" value={subForm.code} onChange={(event) => setSubForm({ ...subForm, code: event.target.value.toUpperCase() })} required /><Input type="color" className="p-1" value={subForm.color} onChange={(event) => setSubForm({ ...subForm, color: event.target.value })} /></div><div className="flex flex-wrap items-center gap-4"><label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={subForm.requiresFieldLocation} onChange={(event) => setSubForm({ ...subForm, requiresFieldLocation: event.target.checked })} />Exige ponto no campo</label><label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={subForm.requiresGoalLocation} onChange={(event) => setSubForm({ ...subForm, requiresGoalLocation: event.target.checked })} />Exige ponto na baliza</label><Button className="ml-auto" variant="primary"><Plus size={15} />Adicionar</Button></div></form></Panel>
  </div></div>;
}
