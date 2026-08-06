"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CircleStop, Crosshair, FileVideo, Flag, Goal, Loader2, MapPin, Pause, Play, Plus, Save, Trash2, Upload } from "lucide-react";

import { Coordinate, GoalSurface, PitchSurface } from "@/components/analysis-surfaces";
import { Badge, Button, Label, Panel, Select, TextArea } from "@/components/ui";
import type { MatchDetail, MomentRecord, MomentTypeRecord, SettingsPayload, SubMomentRecord, VideoRecord } from "@/lib/domain";
import { apiFetch } from "@/lib/http";
import { formatBytes, formatTime, roundTime } from "@/lib/time";

export function AnalysisWorkspace({ matchId }: { matchId: string }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selectedMomentId, setSelectedMomentId] = useState<string | null>(null);
  const [selectedMomentTypeId, setSelectedMomentTypeId] = useState("");
  const [activeMoment, setActiveMoment] = useState<{ type: MomentTypeRecord; start: number } | null>(null);
  const [selectedSubMomentTypeId, setSelectedSubMomentTypeId] = useState("");
  const [fieldPoint, setFieldPoint] = useState<Coordinate | null>(null);
  const [goalPoint, setGoalPoint] = useState<Coordinate | null>(null);
  const [foot, setFoot] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([apiFetch<MatchDetail>(`/api/matches/${matchId}`), apiFetch<SettingsPayload>("/api/settings")])
      .then(([matchData, settingsData]) => {
        setMatch(matchData); setSettings(settingsData);
        setSelectedMomentId(matchData.moments[0]?.id || null);
        setSelectedMomentTypeId(settingsData.momentTypes[0]?.id || "");
        setSelectedSubMomentTypeId(settingsData.subMomentTypes[0]?.id || "");
      })
      .catch((error: Error) => setNotice(error.message)).finally(() => setLoading(false));
  }, [matchId]);

  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);

  const selectedMoment = match?.moments.find((moment) => moment.id === selectedMomentId) || null;
  const selectedSubMomentType = settings?.subMomentTypes.find((type) => type.id === selectedSubMomentTypeId) || null;
  const currentPeriod = getPeriod(match, selectedMoment, currentTime, duration);
  const attackDirection = getAttackDirection(match, selectedMoment, currentTime, duration);
  const fieldMarkers = useMemo(() => (selectedMoment?.subMoments || []).filter((sub) => sub.fieldX !== null && sub.fieldY !== null).map((sub) => ({ id: sub.id, x: sub.fieldX!, y: sub.fieldY!, color: sub.subMomentType.color, label: sub.subMomentType.name })), [selectedMoment]);
  const goalMarkers = useMemo(() => (selectedMoment?.subMoments || []).filter((sub) => sub.goalX !== null && sub.goalY !== null).map((sub) => ({ id: sub.id, x: sub.goalX!, y: sub.goalY!, color: sub.subMomentType.color, label: sub.subMomentType.name })), [selectedMoment]);

  async function loadVideo(file?: File) {
    if (!file || !match) return;
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    const url = URL.createObjectURL(file); setSourceUrl(url); setNotice(null);
    const probe = document.createElement("video"); probe.preload = "metadata"; probe.src = url;
    await new Promise<void>((resolve, reject) => { probe.onloadedmetadata = () => resolve(); probe.onerror = () => reject(new Error("Não foi possível ler os metadados do vídeo.")); });
    setDuration(probe.duration);
    try {
      const video = await apiFetch<VideoRecord>(`/api/matches/${match.id}/video`, { method: "PUT", body: JSON.stringify({ fileName: file.name, fileSize: file.size, durationSeconds: probe.duration, mimeType: file.type || "video/mp4", lastModified: new Date(file.lastModified).toISOString() }) });
      setMatch({ ...match, video });
    } catch (error) { setNotice(error instanceof Error ? error.message : "O vídeo abriu, mas os metadados não foram guardados."); }
  }

  function togglePlayback() {
    const video = videoRef.current; if (!video) return;
    if (video.paused) void video.play(); else video.pause();
  }

  function reviewMoment(moment: MomentRecord) {
    setSelectedMomentId(moment.id); setFieldPoint(null); setGoalPoint(null);
    const video = videoRef.current; if (!video) return;
    video.currentTime = moment.startTimeSeconds; void video.play();
  }

  async function toggleMomentMarking() {
    if (!match || !settings) return;
    if (!sourceUrl) { setNotice("Seleciona primeiro o vídeo local."); fileInputRef.current?.click(); return; }
    if (!activeMoment) {
      const type = settings.momentTypes.find((item) => item.id === selectedMomentTypeId);
      if (!type) return;
      setActiveMoment({ type, start: roundTime(currentTime) }); setNotice(`${type.name} iniciado em ${formatTime(currentTime)}.`); return;
    }
    if (currentTime <= activeMoment.start) { setNotice("O fim do momento tem de ser posterior ao início."); return; }
    setSaving(true);
    try {
      const saved = await apiFetch<MomentRecord>(`/api/matches/${match.id}/moments`, { method: "POST", body: JSON.stringify({ momentTypeId: activeMoment.type.id, startTimeSeconds: activeMoment.start, endTimeSeconds: roundTime(currentTime), period: currentPeriod }) });
      setMatch({ ...match, moments: [...match.moments, saved].sort((a, b) => a.startTimeSeconds - b.startTimeSeconds), momentCount: match.momentCount + 1 });
      setSelectedMomentId(saved.id); setActiveMoment(null); setNotice("Momento guardado.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível guardar o momento."); }
    finally { setSaving(false); }
  }

  async function saveSubmoment() {
    if (!match || !selectedMoment || !selectedSubMomentType) return;
    if (selectedSubMomentType.requiresFieldLocation && !fieldPoint) { setNotice("Assinala o local da ocorrência no campo."); return; }
    if (selectedSubMomentType.requiresGoalLocation && !goalPoint) { setNotice("Assinala também o destino na baliza."); return; }
    setSaving(true); setNotice(null);
    try {
      const saved = await apiFetch<SubMomentRecord>(`/api/moments/${selectedMoment.id}/submoments`, { method: "POST", body: JSON.stringify({ subMomentTypeId: selectedSubMomentType.id, timeSeconds: roundTime(currentTime), fieldX: fieldPoint?.x ?? null, fieldY: fieldPoint?.y ?? null, goalX: goalPoint?.x ?? null, goalY: goalPoint?.y ?? null, foot: foot || null, notes: notes || null }) });
      setMatch({ ...match, moments: match.moments.map((moment) => moment.id === selectedMoment.id ? { ...moment, subMoments: [...moment.subMoments, saved] } : moment) });
      setFieldPoint(null); setGoalPoint(null); setFoot(""); setNotes(""); setNotice(`${selectedSubMomentType.name} guardado.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível guardar o submomento."); }
    finally { setSaving(false); }
  }

  async function removeMoment(moment: MomentRecord) {
    if (!match || !confirm(`Apagar ${moment.momentType.name} e os respetivos submomentos?`)) return;
    await apiFetch(`/api/moments/${moment.id}`, { method: "DELETE" });
    const moments = match.moments.filter((item) => item.id !== moment.id);
    setMatch({ ...match, moments, momentCount: Math.max(0, match.momentCount - 1) }); setSelectedMomentId(moments[0]?.id || null);
  }

  async function removeSubmoment(submoment: SubMomentRecord) {
    if (!match || !selectedMoment || !confirm(`Apagar ${submoment.subMomentType.name}?`)) return;
    await apiFetch(`/api/submoments/${submoment.id}`, { method: "DELETE" });
    setMatch({ ...match, moments: match.moments.map((moment) => moment.id === selectedMoment.id ? { ...moment, subMoments: moment.subMoments.filter((item) => item.id !== submoment.id) } : moment) });
  }

  if (loading) return <div className="flex min-h-[65vh] items-center justify-center text-slate-400"><Loader2 className="mr-2 animate-spin" />A preparar análise…</div>;
  if (!match || !settings) return <Panel className="border-red-400/20 p-5 text-red-100">{notice || "Não foi possível abrir este jogo."}</Panel>;

  return <div className="space-y-4">
    <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={(event) => void loadVideo(event.target.files?.[0])} />
    <header className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[.045] p-4 lg:flex-row lg:items-center lg:justify-between"><div><Link href="/" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-white"><ArrowLeft size={13} />Jogos</Link><h1 className="mt-2 text-2xl font-bold text-white">{match.title}</h1><p className="mt-1 text-sm text-slate-500">{match.competition || "Sem competição"} · ataque {attackDirection === "left_to_right" ? "→" : "←"}</p></div><Button variant="primary" onClick={() => fileInputRef.current?.click()}><Upload size={16} />{sourceUrl ? "Trocar vídeo" : "Selecionar vídeo"}</Button></header>
    {notice ? <div className="rounded-xl border border-leaf-400/25 bg-leaf-400/10 px-4 py-3 text-sm text-emerald-100">{notice}</div> : null}

    <div className="grid items-start gap-4 xl:grid-cols-[20rem_minmax(0,1fr)_27rem]">
      <Panel className="overflow-hidden xl:sticky xl:top-24">
        <div className="border-b border-white/10 p-4"><Label>Registar momento</Label><Select className="mt-2" value={selectedMomentTypeId} onChange={(event) => setSelectedMomentTypeId(event.target.value)} disabled={Boolean(activeMoment)}>{settings.momentTypes.filter((type) => type.active).map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</Select><Button className="mt-2 w-full" variant={activeMoment ? "danger" : "primary"} disabled={saving} onClick={() => void toggleMomentMarking()}>{activeMoment ? <CircleStop size={16} /> : <Plus size={16} />}{activeMoment ? `Terminar em ${formatTime(currentTime)}` : "Iniciar momento"}</Button>{activeMoment ? <p className="mt-2 text-xs text-amber-200">Início: {formatTime(activeMoment.start)}</p> : null}</div>
        <div className="max-h-[58vh] overflow-y-auto"><div className="sticky top-0 z-10 border-b border-white/10 bg-ink-900 px-4 py-2 text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">Momentos ({match.moments.length})</div>{match.moments.length === 0 ? <p className="p-4 text-sm text-slate-500">Ainda não existem momentos.</p> : match.moments.map((moment) => <div key={moment.id} className={`border-b border-white/[.06] p-3 ${selectedMoment?.id === moment.id ? "bg-leaf-400/10" : ""}`}><button className="w-full text-left" onClick={() => reviewMoment(moment)}><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: moment.momentType.color }} /><span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{moment.momentType.name}</span></span><span className="mt-1 block font-mono text-xs text-slate-500">{formatTime(moment.startTimeSeconds)} – {formatTime(moment.endTimeSeconds)}</span></button><div className="mt-2 flex items-center justify-between"><Badge>{moment.subMoments.length} sub.</Badge><Button size="sm" variant="danger" onClick={() => void removeMoment(moment)}><Trash2 size={12} />Apagar</Button></div></div>)}</div>
      </Panel>

      <div className="space-y-4">
        <Panel className="overflow-hidden"><div className="relative aspect-video bg-black">{sourceUrl ? <video ref={videoRef} src={sourceUrl} className="h-full w-full" playsInline onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onTimeUpdate={(event) => { const video = event.currentTarget; setCurrentTime(video.currentTime); if (selectedMoment && video.currentTime >= selectedMoment.endTimeSeconds && video.currentTime <= selectedMoment.endTimeSeconds + .3) video.pause(); }} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} /> : <div className="flex h-full flex-col items-center justify-center p-8 text-center"><FileVideo size={50} className="text-leaf-400" /><h2 className="mt-4 font-bold text-white">Seleciona o vídeo local deste jogo</h2><p className="mt-2 max-w-md text-sm text-slate-500">O vídeo não é enviado para a base de dados. Apenas ficam guardados o nome, duração, momentos e coordenadas.</p>{match.video ? <div className="mt-4 rounded-lg border border-white/10 bg-white/[.05] px-3 py-2 text-xs text-slate-400">Esperado: {match.video.fileName} · {formatBytes(match.video.fileSize)}</div> : null}</div>}</div><div className="flex items-center justify-between border-t border-white/10 p-3"><Button size="icon" variant="primary" disabled={!sourceUrl} onClick={togglePlayback}>{playing ? <Pause /> : <Play />}</Button><span className="font-mono text-sm text-white">{formatTime(currentTime)} <span className="text-slate-600">/ {formatTime(duration)}</span></span></div></Panel>
        <Panel className="p-4"><div className="flex items-center justify-between"><div><Label>Mapa do momento selecionado</Label><p className="mt-1 text-xs text-slate-500">Os pontos usam a cor de cada submomento.</p></div><Badge>{fieldMarkers.length} ocorrências</Badge></div><PitchSurface className="mt-3" points={fieldMarkers} direction={attackDirection} /></Panel>
      </div>

      <Panel className="p-4 xl:sticky xl:top-24">
        <div className="flex items-center justify-between"><div><Label>Submomento</Label><p className="mt-1 text-xs text-slate-500">{selectedMoment ? `${selectedMoment.momentType.name} · ${formatTime(currentTime)}` : "Seleciona primeiro um momento"}</p></div><Crosshair className="text-leaf-400" size={19} /></div>
        <div className="mt-3 grid grid-cols-2 gap-2">{settings.subMomentTypes.filter((type) => type.active).map((type) => <button key={type.id} type="button" onClick={() => { setSelectedSubMomentTypeId(type.id); setFieldPoint(null); setGoalPoint(null); }} className={`min-h-10 rounded-lg border px-2 py-2 text-xs font-semibold transition ${selectedSubMomentTypeId === type.id ? "border-white/50 text-white shadow-lg" : "border-white/10 bg-white/[.04] text-slate-400 hover:bg-white/[.08]"}`} style={selectedSubMomentTypeId === type.id ? { backgroundColor: `${type.color}35`, borderColor: type.color } : undefined}><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: type.color }} />{type.name}</button>)}</div>
        {selectedMoment && selectedSubMomentType ? <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
          {selectedSubMomentType.requiresFieldLocation ? <div><div className="mb-2 flex items-center justify-between"><Label>Local da ocorrência</Label><MapPin size={14} className="text-slate-500" /></div><PitchSurface value={fieldPoint} color={selectedSubMomentType.color} direction={attackDirection} onChange={setFieldPoint} /></div> : null}
          {selectedSubMomentType.requiresGoalLocation ? <div><div className="mb-2 flex items-center justify-between"><Label>Ponto na baliza</Label><Goal size={14} className="text-slate-500" /></div><GoalSurface points={goalMarkers} value={goalPoint} color={selectedSubMomentType.color} onChange={setGoalPoint} /></div> : null}
          <label className="grid gap-2"><Label>Pé</Label><Select value={foot} onChange={(event) => setFoot(event.target.value)}><option value="">Não indicado</option><option value="right">Direito</option><option value="left">Esquerdo</option><option value="head">Cabeça</option><option value="other">Outro</option></Select></label>
          <label className="grid gap-2"><Label>Notas</Label><TextArea className="min-h-16" value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          <Button className="w-full" variant="primary" disabled={saving} onClick={() => void saveSubmoment()}><Save size={15} />Guardar {selectedSubMomentType.name}</Button>
          <div><div className="mb-2 flex items-center justify-between"><Label>Guardados</Label><Badge>{selectedMoment.subMoments.length}</Badge></div>{selectedMoment.subMoments.map((submoment) => <div key={submoment.id} className="flex items-center gap-2 border-t border-white/[.06] py-2"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: submoment.subMomentType.color }} /><span className="min-w-0 flex-1 truncate text-xs text-slate-300">{submoment.subMomentType.name} · {formatTime(submoment.timeSeconds || 0)}</span><Button size="icon" variant="danger" className="h-7 w-7" onClick={() => void removeSubmoment(submoment)}><Trash2 size={12} /></Button></div>)}</div>
        </div> : <div className="mt-4 rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-slate-500"><Flag className="mx-auto mb-2" />Seleciona um momento para identificar ocorrências.</div>}
      </Panel>
    </div>
  </div>;
}

function getAttackDirection(match: MatchDetail | null, moment: MomentRecord | null, currentTime: number, duration: number) {
  if (!match) return "left_to_right";
  return getPeriod(match, moment, currentTime, duration) === "second_half" ? match.secondHalfAttackDirection : match.firstHalfAttackDirection;
}

function getPeriod(match: MatchDetail | null, moment: MomentRecord | null, currentTime: number, duration: number) {
  if (moment?.period === "second_half") return "second_half";
  if (moment?.period === "first_half") return "first_half";
  if (!match) return "first_half";
  const secondHalfStart = match.secondHalfStartSeconds ?? (duration ? duration / 2 : Infinity);
  return currentTime >= secondHalfStart ? "second_half" : "first_half";
}
