"use client";

import { useState } from "react";
import { Button, Input, Label, Panel } from "@/components/ui";
import type { SettingsPayload, SubMomentTypeRecord } from "@/lib/domain";
import { apiFetch } from "@/lib/http";

export function SubmomentTypeDialog({ type, momentTypeId, onSaved, onClose }: {
  type: SubMomentTypeRecord | null; momentTypeId: string;
  onSaved: (settings: SettingsPayload, typeId: string) => void; onClose: () => void;
}) {
  const [name, setName] = useState(type?.name || "");
  const [color, setColor] = useState(type?.color || "#38bdf8");
  const [field, setField] = useState(type?.requiresFieldLocation ?? true);
  const [goal, setGoal] = useState(type?.requiresGoalLocation ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const saved = await apiFetch<SubMomentTypeRecord>(`/api/settings/submoment-types${type ? `/${type.id}` : ""}`, {
        method: type ? "PATCH" : "POST",
        body: JSON.stringify({ ...type, name: name.trim(), code: type?.code || `CUSTOM_${crypto.randomUUID()}`, color, requiresFieldLocation: field, requiresGoalLocation: goal, momentTypeId })
      });
      const settings = await apiFetch<SettingsPayload>("/api/settings");
      onSaved(settings, saved.id);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save the submoment type."); }
    finally { setSaving(false); }
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label={type ? "Edit submoment type" : "Add submoment type"}>
    <Panel className="w-full max-w-md p-5"><h2 className="text-lg font-bold text-white">{type ? "Edit submoment type" : "Add submoment type"}</h2>
      <p className="mt-2 text-xs text-slate-400">{type ? "Changes apply wherever this type is used in your team. Saved occurrences are preserved." : "The new type will be available for this moment in your team's matches."}</p>
      <form onSubmit={save} className="mt-4 grid gap-4">
        <label className="grid gap-2"><Label>Name</Label><Input autoFocus required maxLength={100} value={name} onChange={(e) => setName(e.target.value)}/></label>
        <label className="flex items-center gap-3"><Label>Color</Label><input type="color" value={color} onChange={(e) => setColor(e.target.value)}/></label>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={field} onChange={(e) => setField(e.target.checked)}/>Requires pitch location</label>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={goal} onChange={(e) => setGoal(e.target.checked)}/>Requires goal location</label>
        {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
        <div className="flex justify-end gap-2"><Button type="button" disabled={saving} onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" disabled={saving || !name.trim()}>{saving ? "Saving…" : "Save"}</Button></div>
      </form>
    </Panel>
  </div>;
}
