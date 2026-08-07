"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { Button, Input, Label, Panel } from "@/components/ui";

export default function OnboardingPage() {
  const router = useRouter();
  const [teamName, setTeamName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    const response = await fetch("/api/account/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamName }) });
    const data = await response.json() as { error?: string };
    setBusy(false);
    if (!response.ok) return setError(data.error || "Could not create the team space.");
    router.replace("/");
    router.refresh();
  }

  return <div className="flex min-h-screen items-center justify-center px-4"><Panel className="w-full max-w-lg p-7"><span className="flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-300/10 text-cyan-200"><ShieldCheck /></span><p className="mt-5 text-xs font-medium uppercase tracking-[.24em] text-cyan-200/80">First setup</p><h1 className="mt-2 text-2xl font-semibold text-white">Add your team</h1><p className="mt-2 text-sm leading-6 text-slate-400">This name identifies your private analysis space. Your matches, moments, maps and reports will only be visible to accounts connected to this team.</p>{error ? <div className="mt-5 rounded-lg border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-100">{error}</div> : null}<form onSubmit={submit} className="mt-6 grid gap-4"><label className="grid gap-2"><Label>Team name</Label><Input autoFocus maxLength={80} placeholder="e.g. SC Farense" value={teamName} onChange={(event) => setTeamName(event.target.value)} required /></label><Button variant="primary" disabled={busy || teamName.trim().length < 2}>{busy ? "Creating private space…" : "Continue"}</Button></form></Panel></div>;
}
