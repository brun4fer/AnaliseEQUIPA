"use client";

import { FormEvent, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Users } from "lucide-react";

import { Badge, Button, Input, Label, Panel } from "@/components/ui";
import type { AccountPayload } from "@/lib/domain";
import { apiFetch } from "@/lib/http";

export function TeamManagementPanel() {
  const [account, setAccount] = useState<AccountPayload | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [busy, setBusy] = useState<"rename" | "create" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<AccountPayload>("/api/account").then((value) => { setAccount(value); setRenameValue(value.teamName || ""); }).catch((error: Error) => setNotice(error.message));
  }, []);

  async function rename(event: FormEvent) {
    event.preventDefault();
    if (!account) return;
    setBusy("rename"); setNotice(null);
    try {
      const saved = await apiFetch<{ id: string; teamName: string }>("/api/account/team", { method: "PATCH", body: JSON.stringify({ teamName: renameValue }) });
      setAccount({ ...account, teamName: saved.teamName, teams: account.teams.map((team) => team.id === saved.id ? { ...team, name: saved.teamName } : team) });
      setNotice("Team name updated.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not rename the team."); }
    finally { setBusy(null); }
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy("create"); setNotice(null);
    try {
      await apiFetch("/api/account/team", { method: "POST", body: JSON.stringify({ teamName: newTeamName }) });
      window.location.href = "/settings";
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not create the team."); setBusy(null); }
  }

  return <Panel className="overflow-hidden">
    <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4"><div><div className="flex items-center gap-2"><Users size={17} className="text-leaf-400" /><h2 className="font-bold text-white">Teams</h2></div><p className="mt-1 text-xs text-slate-500">Rename the current team or create an independent workspace for a new club or season.</p></div><Badge>{account?.teams.length || 0}</Badge></div>
    {notice ? <div className="border-b border-white/10 bg-white/[.03] px-4 py-2 text-xs text-slate-300">{notice}</div> : null}
    <div className="grid gap-4 p-4 lg:grid-cols-2">
      <form onSubmit={rename} className="grid gap-3 rounded-lg border border-white/10 bg-white/[.025] p-3"><div><Label>Current team</Label><p className="mt-1 text-[10px] text-slate-500">Renaming keeps all existing matches and analysis.</p></div><Input value={renameValue} minLength={2} maxLength={80} onChange={(event) => setRenameValue(event.target.value)} required /><Button variant="primary" disabled={busy !== null || !account || renameValue.trim() === account.teamName}><Pencil size={14} />{busy === "rename" ? "Saving…" : "Rename team"}</Button></form>
      <form onSubmit={create} className="grid gap-3 rounded-lg border border-white/10 bg-white/[.025] p-3"><div><Label>New team</Label><p className="mt-1 text-[10px] text-slate-500">Creates a separate space with its own matches, settings and reports, then switches to it.</p></div><Input value={newTeamName} minLength={2} maxLength={80} placeholder="New team name" onChange={(event) => setNewTeamName(event.target.value)} required /><Button disabled={busy !== null || newTeamName.trim().length < 2}>{busy === "create" ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}{busy === "create" ? "Creating…" : "Create new team"}</Button></form>
    </div>
  </Panel>;
}
