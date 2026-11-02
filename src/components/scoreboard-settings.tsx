"use client";

import { useState } from "react";
import { Button, Input, Label, Panel } from "@/components/ui";
import type { MatchDetail } from "@/lib/domain";
import { apiFetch } from "@/lib/http";
import { validateScoreboardSettings } from "@/lib/scoreboard";

export function ScoreboardSettings({ match, onSaved, onClose }: { match: MatchDetail; onSaved: (match: MatchDetail) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(() => ({ scoreboardEnabled: match.scoreboardEnabled, homeClubName: match.homeClubName || match.teamName || "Home", awayClubName: match.awayClubName || match.opponentName, homeClubShortName: match.homeClubShortName || "", awayClubShortName: match.awayClubShortName || "", homeTeamColor: match.homeTeamColor, awayTeamColor: match.awayTeamColor, homeClubLogoDataUrl: match.homeClubLogoDataUrl, awayClubLogoDataUrl: match.awayClubLogoDataUrl }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function upload(team: "home" | "away", file?: File) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 250_000) { setError("Use a PNG, JPEG or WebP badge smaller than 250 KB."); return; }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Could not read badge.")); reader.readAsDataURL(file); });
      setDraft((current) => ({ ...current, [`${team}ClubLogoDataUrl`]: dataUrl })); setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not read badge."); }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try { const input = validateScoreboardSettings(draft); onSaved(await apiFetch<MatchDetail>(`/api/matches/${match.id}`, { method: "PATCH", body: JSON.stringify(input) })); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save scoreboard settings."); }
    finally { setSaving(false); }
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label="Match scoreboard">
    <Panel className="max-h-[90vh] w-full max-w-xl overflow-y-auto p-5"><h2 className="text-lg font-bold text-white">Match scoreboard</h2>
      <form onSubmit={save} className="mt-4 grid gap-4"><label className="flex gap-2 text-sm"><input type="checkbox" checked={draft.scoreboardEnabled} onChange={(e) => setDraft({ ...draft, scoreboardEnabled: e.target.checked })}/>Show scoreboard and match clock for this match</label>
        <p className="text-xs text-slate-400">The clock follows the marked halves. Score and red card changes are saved at the current video time. Set the correct home and away teams here.</p>
        <div className="grid gap-4 sm:grid-cols-2">{(["home", "away"] as const).map((team) => <fieldset key={team} className="grid gap-3 rounded border border-white/10 p-3"><legend className="px-1 text-sm font-semibold">{team === "home" ? "Home" : "Away"}</legend>
          <label className="grid gap-1"><Label>Club name</Label><Input required maxLength={100} value={draft[`${team}ClubName`]} onChange={(e) => setDraft({ ...draft, [`${team}ClubName`]: e.target.value })}/></label>
          <label className="grid gap-1"><Label>Short name (optional)</Label><Input maxLength={4} value={draft[`${team}ClubShortName`]} onChange={(e) => setDraft({ ...draft, [`${team}ClubShortName`]: e.target.value })}/></label>
          <label className="flex gap-2"><Label>Match color</Label><input type="color" value={draft[`${team}TeamColor`]} onChange={(e) => setDraft({ ...draft, [`${team}TeamColor`]: e.target.value })}/></label>
          <label className="grid gap-1"><Label>Club badge</Label><input className="w-full text-xs" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void upload(team, e.target.files?.[0])}/></label>
          {draft[`${team}ClubLogoDataUrl`] ? <Button type="button" size="sm" onClick={() => setDraft({ ...draft, [`${team}ClubLogoDataUrl`]: null })}>Remove badge</Button> : null}
        </fieldset>)}</div>
        {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
        <div className="flex justify-end gap-2"><Button type="button" disabled={saving} onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" disabled={saving}>{saving ? "Saving…" : "Save"}</Button></div>
      </form>
    </Panel>
  </div>;
}
