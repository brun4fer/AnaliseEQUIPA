"use client";

import { FormEvent, useEffect, useState } from "react";
import { Crosshair, Loader2, Pencil, Plus, Save, Target, Trash2, X } from "lucide-react";

import { Badge, Button, Input, Label, Panel } from "@/components/ui";
import type { MomentTypeRecord, SettingsPayload, SubMomentTypeRecord } from "@/lib/domain";
import { apiFetch } from "@/lib/http";

const emptyMoment = { name: "", code: "", color: "#2dd66f", defaultShortcut: "" };
const emptySubmoment = { name: "", code: "", color: "#38bdf8", defaultShortcut: "", requiresFieldLocation: true, requiresGoalLocation: false };

export function SettingsClient() {
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [momentForm, setMomentForm] = useState(emptyMoment);
  const [subForm, setSubForm] = useState(emptySubmoment);
  const [editingMomentId, setEditingMomentId] = useState<string | null>(null);
  const [editingSubmomentId, setEditingSubmomentId] = useState<string | null>(null);

  useEffect(() => { apiFetch<SettingsPayload>("/api/settings").then(setSettings).catch((caught: Error) => setError(caught.message)).finally(() => setLoading(false)); }, []);

  async function saveMoment(event: FormEvent) {
    event.preventDefault(); if (!settings) return;
    setError(null);
    try {
      const saved = await apiFetch<MomentTypeRecord>(`/api/settings/moment-types${editingMomentId ? `/${editingMomentId}` : ""}`, { method: editingMomentId ? "PATCH" : "POST", body: JSON.stringify(momentForm) });
      setSettings({ ...settings, momentTypes: editingMomentId ? settings.momentTypes.map((item) => item.id === saved.id ? saved : item) : [...settings.momentTypes, saved] });
      cancelMomentEdit();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save the moment type."); }
  }

  async function saveSubmoment(event: FormEvent) {
    event.preventDefault(); if (!settings) return;
    setError(null);
    try {
      const saved = await apiFetch<SubMomentTypeRecord>(`/api/settings/submoment-types${editingSubmomentId ? `/${editingSubmomentId}` : ""}`, { method: editingSubmomentId ? "PATCH" : "POST", body: JSON.stringify(subForm) });
      setSettings({ ...settings, subMomentTypes: editingSubmomentId ? settings.subMomentTypes.map((item) => item.id === saved.id ? saved : item) : [...settings.subMomentTypes, saved] });
      cancelSubmomentEdit();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save the submoment type."); }
  }

  async function remove(kind: "moment" | "submoment", id: string, name: string) {
    if (!settings || !confirm(`Delete “${name}”?`)) return;
    try {
      await apiFetch(`/api/settings/${kind}-types/${id}`, { method: "DELETE" });
      setSettings(kind === "moment" ? { ...settings, momentTypes: settings.momentTypes.filter((item) => item.id !== id) } : { ...settings, subMomentTypes: settings.subMomentTypes.filter((item) => item.id !== id) });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not delete this type."); }
  }

  function editMoment(type: MomentTypeRecord) { setEditingMomentId(type.id); setMomentForm({ name: type.name, code: type.code, color: type.color, defaultShortcut: type.defaultShortcut || "" }); }
  function editSubmoment(type: SubMomentTypeRecord) { setEditingSubmomentId(type.id); setSubForm({ name: type.name, code: type.code, color: type.color, defaultShortcut: type.defaultShortcut || "", requiresFieldLocation: type.requiresFieldLocation, requiresGoalLocation: type.requiresGoalLocation }); }
  function cancelMomentEdit() { setEditingMomentId(null); setMomentForm(emptyMoment); }
  function cancelSubmomentEdit() { setEditingSubmomentId(null); setSubForm(emptySubmoment); }

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-slate-400"><Loader2 className="mr-2 animate-spin" />Loading settings…</div>;
  if (!settings) return <Panel className="p-4 text-red-100">{error}</Panel>;

  return <div className="space-y-5"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-leaf-400">Configurable taxonomy</p><h1 className="mt-2 text-3xl font-bold text-white">Moments and submoments</h1><p className="mt-2 text-sm text-slate-400">Edit names, colors, requirements and unique keyboard shortcuts. Types already in use can be renamed but not deleted.</p></div>{error ? <div className="rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-100">{error}</div> : null}<div className="grid gap-5 xl:grid-cols-2">
    <Panel className="overflow-hidden"><div className="border-b border-white/10 p-4"><Label>Moment types</Label></div><div className="divide-y divide-white/[.06]">{settings.momentTypes.map((type) => <div key={type.id} className="flex items-center gap-3 p-3"><span className="h-4 w-4 rounded-full" style={{ backgroundColor: type.color }} /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-white">{type.name}</span><span className="text-xs text-slate-500">{type.code}</span></span>{type.defaultShortcut ? <Badge>{type.defaultShortcut}</Badge> : null}<Button size="icon" onClick={() => editMoment(type)}><Pencil size={14} /></Button><Button size="icon" variant="danger" onClick={() => void remove("moment", type.id, type.name)}><Trash2 size={14} /></Button></div>)}</div><form onSubmit={saveMoment} className="grid gap-3 border-t border-white/10 bg-black/10 p-4 sm:grid-cols-[1fr_7rem_4rem_5rem_auto]"><Input placeholder="Name" value={momentForm.name} onChange={(event) => setMomentForm({ ...momentForm, name: event.target.value })} required /><Input placeholder="Code" value={momentForm.code} onChange={(event) => setMomentForm({ ...momentForm, code: event.target.value.toUpperCase() })} required /><Input type="color" className="p-1" value={momentForm.color} onChange={(event) => setMomentForm({ ...momentForm, color: event.target.value })} /><Input maxLength={1} placeholder="Key" value={momentForm.defaultShortcut} onChange={(event) => setMomentForm({ ...momentForm, defaultShortcut: event.target.value.slice(-1) })} /><div className="flex gap-1"><Button variant="primary" size="icon">{editingMomentId ? <Save size={15} /> : <Plus size={15} />}</Button>{editingMomentId ? <Button type="button" size="icon" onClick={cancelMomentEdit}><X size={15} /></Button> : null}</div></form></Panel>
    <Panel className="overflow-hidden"><div className="border-b border-white/10 p-4"><Label>Submoment types</Label></div><div className="divide-y divide-white/[.06]">{settings.subMomentTypes.map((type) => <div key={type.id} className="flex items-center gap-3 p-3"><span className="h-4 w-4 rounded-full" style={{ backgroundColor: type.color }} /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-white">{type.name}</span><span className="text-xs text-slate-500">{type.code}</span></span>{type.defaultShortcut ? <Badge>{type.defaultShortcut}</Badge> : null}{type.requiresFieldLocation ? <Badge><Crosshair size={12} />Pitch</Badge> : null}{type.requiresGoalLocation ? <Badge><Target size={12} />Goal</Badge> : null}<Button size="icon" onClick={() => editSubmoment(type)}><Pencil size={14} /></Button><Button size="icon" variant="danger" onClick={() => void remove("submoment", type.id, type.name)}><Trash2 size={14} /></Button></div>)}</div><form onSubmit={saveSubmoment} className="space-y-3 border-t border-white/10 bg-black/10 p-4"><div className="grid gap-3 sm:grid-cols-[1fr_8rem_4rem_5rem]"><Input placeholder="Name" value={subForm.name} onChange={(event) => setSubForm({ ...subForm, name: event.target.value })} required /><Input placeholder="Code" value={subForm.code} onChange={(event) => setSubForm({ ...subForm, code: event.target.value.toUpperCase() })} required /><Input type="color" className="p-1" value={subForm.color} onChange={(event) => setSubForm({ ...subForm, color: event.target.value })} /><Input maxLength={1} placeholder="Key" value={subForm.defaultShortcut} onChange={(event) => setSubForm({ ...subForm, defaultShortcut: event.target.value.slice(-1) })} /></div><div className="flex flex-wrap items-center gap-4"><label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={subForm.requiresFieldLocation} onChange={(event) => setSubForm({ ...subForm, requiresFieldLocation: event.target.checked })} />Requires a pitch location</label><label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={subForm.requiresGoalLocation} onChange={(event) => setSubForm({ ...subForm, requiresGoalLocation: event.target.checked })} />Requires a goal location</label><Button className="ml-auto" variant="primary">{editingSubmomentId ? <Save size={15} /> : <Plus size={15} />}{editingSubmomentId ? "Save" : "Add"}</Button>{editingSubmomentId ? <Button type="button" onClick={cancelSubmomentEdit}><X size={15} />Cancel</Button> : null}</div></form></Panel>
  </div></div>;
}
