"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

import { Button, Input, Label, Panel, Select, TextArea } from "@/components/ui";
import type { MatchDetail } from "@/lib/domain";
import { apiFetch } from "@/lib/http";

export function MatchForm() {
  const router = useRouter();
  const [form, setForm] = useState({ opponentName: "", competition: "", season: "", roundName: "", matchDate: "", venue: "", notes: "", firstHalfAttackDirection: "left_to_right", secondHalfAttackDirection: "right_to_left" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError(null);
    try {
      const match = await apiFetch<MatchDetail>("/api/matches", { method: "POST", body: JSON.stringify(form) });
      router.push(`/analysis/${match.id}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível criar o jogo."); setSaving(false); }
  }

  const update = (name: keyof typeof form, value: string) => setForm((current) => ({ ...current, [name]: value }));
  return <div className="mx-auto max-w-4xl space-y-5">
    <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={15} />Voltar aos jogos</Link>
    <div><p className="text-xs font-bold uppercase tracking-[.22em] text-leaf-400">Preparação</p><h1 className="mt-2 text-3xl font-bold text-white">Novo jogo do Feirense</h1><p className="mt-2 text-sm text-slate-400">O título será criado automaticamente a partir do adversário.</p></div>
    <Panel className="p-5"><form onSubmit={submit} className="grid gap-5 md:grid-cols-2">
      {error ? <div className="rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-100 md:col-span-2">{error}</div> : null}
      <Field label="Adversário" required><Input value={form.opponentName} onChange={(event) => update("opponentName", event.target.value)} placeholder="Ex.: Académico de Viseu" required /></Field>
      <Field label="Competição"><Input value={form.competition} onChange={(event) => update("competition", event.target.value)} /></Field>
      <Field label="Época"><Input value={form.season} onChange={(event) => update("season", event.target.value)} placeholder="2026/27" /></Field>
      <Field label="Jornada"><Input value={form.roundName} onChange={(event) => update("roundName", event.target.value)} /></Field>
      <Field label="Data"><Input type="date" value={form.matchDate} onChange={(event) => update("matchDate", event.target.value)} /></Field>
      <Field label="Local"><Input value={form.venue} onChange={(event) => update("venue", event.target.value)} /></Field>
      <Field label="Sentido de ataque — 1.ª parte"><Select value={form.firstHalfAttackDirection} onChange={(event) => update("firstHalfAttackDirection", event.target.value)}><option value="left_to_right">Esquerda → direita</option><option value="right_to_left">Direita → esquerda</option></Select></Field>
      <Field label="Sentido de ataque — 2.ª parte"><Select value={form.secondHalfAttackDirection} onChange={(event) => update("secondHalfAttackDirection", event.target.value)}><option value="right_to_left">Direita → esquerda</option><option value="left_to_right">Esquerda → direita</option></Select></Field>
      <Field label="Notas" className="md:col-span-2"><TextArea value={form.notes} onChange={(event) => update("notes", event.target.value)} /></Field>
      <div className="flex justify-end gap-2 md:col-span-2"><Link href="/"><Button type="button">Cancelar</Button></Link><Button variant="primary" disabled={saving}><Save size={16} />{saving ? "A guardar…" : "Criar jogo"}</Button></div>
    </form></Panel>
  </div>;
}

function Field({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return <label className={`grid gap-2 ${className || ""}`}><Label>{label}{required ? " *" : ""}</Label>{children}</label>;
}
