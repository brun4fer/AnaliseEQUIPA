"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronsLeft, ChevronsRight, CircleStop, Clock3, FileVideo, Keyboard, Loader2, Pause, Pencil, Play, Tags, Trash2, Upload, X } from "lucide-react";

import { MomentEditDialog } from "@/components/moment-edit-dialog";
import { Badge, Button, Input, Label, Panel } from "@/components/ui";
import type { MatchDetail, MomentRecord, MomentTypeRecord, SettingsPayload, VideoRecord } from "@/lib/domain";
import { apiFetch } from "@/lib/http";
import { getRememberedMatchVideo, rememberMatchVideo } from "@/lib/local-video-store";
import { getAttackDirectionAtTime, getMatchPeriodAtTime } from "@/lib/match-periods";
import { formatBytes, formatTime, roundTime } from "@/lib/time";

type ActiveMoment = { id: string; momentTypeId: string; startTimeSeconds: number };
type PeriodMarkerKey = "firstHalfStartSeconds" | "firstHalfEndSeconds" | "secondHalfStartSeconds" | "secondHalfEndSeconds";

const periodMarkers: Array<[PeriodMarkerKey, string]> = [
  ["firstHalfStartSeconds", "Start 1st half"],
  ["firstHalfEndSeconds", "End 1st half"],
  ["secondHalfStartSeconds", "Start 2nd half"],
  ["secondHalfEndSeconds", "End 2nd half"]
];

export function AnalysisWorkspace({ matchId }: { matchId: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerWrapperRef = useRef<HTMLDivElement | null>(null);
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [restoringVideo, setRestoringVideo] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [exactSecond, setExactSecond] = useState("");
  const [activeMoments, setActiveMoments] = useState<ActiveMoment[]>([]);
  const [selectedMomentId, setSelectedMomentId] = useState<string | null>(null);
  const [editingMoment, setEditingMoment] = useState<MomentRecord | null>(null);
  const [previewEnd, setPreviewEnd] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [sideHeight, setSideHeight] = useState<number | undefined>();

  useEffect(() => {
    Promise.all([apiFetch<MatchDetail>(`/api/matches/${matchId}`), apiFetch<SettingsPayload>("/api/settings")])
      .then(([matchData, settingsData]) => {
        setMatch(matchData);
        setSettings(settingsData);
        setSelectedMomentId(matchData.moments[0]?.id || null);
      })
      .catch((error: Error) => setNotice(error.message))
      .finally(() => setLoading(false));
  }, [matchId]);

  useEffect(() => {
    getRememberedMatchVideo(matchId)
      .then((file) => { if (file) setSourceUrl(URL.createObjectURL(file)); })
      .catch(() => undefined)
      .finally(() => setRestoringVideo(false));
  }, [matchId]);

  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);

  useEffect(() => {
    const node = playerWrapperRef.current;
    if (!node) return;
    const media = window.matchMedia("(min-width: 1280px)");
    const measure = () => setSideHeight(media.matches ? Math.ceil(node.getBoundingClientRect().height) : undefined);
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    media.addEventListener("change", measure);
    measure();
    return () => { observer.disconnect(); media.removeEventListener("change", measure); };
  }, [loading, sourceUrl]);

  async function loadVideo(file?: File) {
    if (!file) return;
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    const url = URL.createObjectURL(file);
    setSourceUrl(url);
    setNotice(null);
    await rememberMatchVideo(matchId, file).catch(() => undefined);

    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.src = url;
    try {
      await new Promise<void>((resolve, reject) => {
        probe.onloadedmetadata = () => resolve();
        probe.onerror = () => reject(new Error("Could not read the video metadata."));
      });
      setDuration(probe.duration);
      const video = await apiFetch<VideoRecord>(`/api/matches/${matchId}/video`, {
        method: "PUT",
        body: JSON.stringify({ fileName: file.name, fileSize: file.size, durationSeconds: probe.duration, mimeType: file.type || "video/mp4", lastModified: new Date(file.lastModified).toISOString() })
      });
      setMatch((current) => current ? { ...current, video } : current);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The video opened, but its metadata was not saved.");
    }
  }

  const createMoment = useCallback(async (type: MomentTypeRecord, startTimeSeconds: number, endTimeSeconds: number) => {
    if (!match || endTimeSeconds <= startTimeSeconds) {
      setNotice("The end of a moment must be after its start.");
      return;
    }
    setSaving(true);
    try {
      const saved = await apiFetch<MomentRecord>(`/api/matches/${match.id}/moments`, {
        method: "POST",
        body: JSON.stringify({ momentTypeId: type.id, startTimeSeconds, endTimeSeconds, period: getMatchPeriodAtTime(match, startTimeSeconds) })
      });
      setMatch((current) => current ? { ...current, momentCount: current.momentCount + 1, moments: [...current.moments, saved].sort((a, b) => a.startTimeSeconds - b.startTimeSeconds) } : current);
      setSelectedMomentId(saved.id);
      setNotice(`${type.name} saved: ${formatTime(startTimeSeconds)} – ${formatTime(endTimeSeconds)}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save the moment.");
      setActiveMoments((current) => [...current, { id: `${type.id}-${startTimeSeconds}`, momentTypeId: type.id, startTimeSeconds }]);
    } finally { setSaving(false); }
  }, [match]);

  const toggleMoment = useCallback((type: MomentTypeRecord) => {
    if (!sourceUrl) {
      setNotice("Select the local match video first.");
      fileInputRef.current?.click();
      return;
    }
    const videoTime = roundTime(videoRef.current?.currentTime ?? currentTime);
    const active = activeMoments.find((item) => item.momentTypeId === type.id);
    if (!active) {
      setActiveMoments((current) => [...current, { id: `${type.id}-${Date.now()}`, momentTypeId: type.id, startTimeSeconds: videoTime }]);
      setNotice(`${type.name} started at ${formatTime(videoTime)}. Press ${type.defaultShortcut || "the same key"} again to finish it.`);
      return;
    }
    if (videoTime <= active.startTimeSeconds) {
      setNotice("Move the video forward before finishing this moment.");
      return;
    }
    setActiveMoments((current) => current.filter((item) => item.id !== active.id));
    void createMoment(type, active.startTimeSeconds, videoTime);
  }, [activeMoments, createMoment, currentTime, sourceUrl]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || target?.matches("input, textarea, select")) return;
      if (event.code === "Space") {
        event.preventDefault();
        const video = videoRef.current;
        if (!video) return;
        setPreviewEnd(null);
        if (video.paused) void video.play(); else video.pause();
        return;
      }
      const type = settings?.momentTypes.find((item) => item.active && item.defaultShortcut?.toLowerCase() === event.key.toLowerCase());
      if (!type) return;
      event.preventDefault();
      toggleMoment(type);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [settings?.momentTypes, toggleMoment]);

  function seekTo(seconds: number) {
    const video = videoRef.current;
    if (!video) return;
    const next = Math.max(0, Math.min(duration || video.duration || 0, seconds));
    setPreviewEnd(null);
    video.currentTime = next;
    setCurrentTime(next);
  }

  function seekBy(seconds: number) { seekTo((videoRef.current?.currentTime ?? currentTime) + seconds); }

  function goToExactSecond() {
    const seconds = Number(exactSecond.replace(",", "."));
    if (!Number.isFinite(seconds) || seconds < 0 || (duration > 0 && seconds > duration)) {
      setNotice(`Enter a value between 0 and ${roundTime(duration)} seconds.`);
      return;
    }
    seekTo(seconds);
    setNotice(`Video moved to ${formatTime(seconds)}.`);
  }

  function setRate(rate: number) {
    setPlaybackRate(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
  }

  function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;
    setPreviewEnd(null);
    if (video.paused) void video.play(); else video.pause();
  }

  function reviewMoment(moment: MomentRecord) {
    setSelectedMomentId(moment.id);
    const video = videoRef.current;
    if (!video) return;
    setPreviewEnd(moment.endTimeSeconds);
    video.currentTime = moment.startTimeSeconds;
    void video.play();
  }

  async function updateMoment(moment: MomentRecord, input: Record<string, unknown>) {
    const saved = await apiFetch<MomentRecord>(`/api/moments/${moment.id}`, { method: "PATCH", body: JSON.stringify(input) });
    setMatch((current) => current ? { ...current, moments: current.moments.map((item) => item.id === saved.id ? saved : item).sort((a, b) => a.startTimeSeconds - b.startTimeSeconds) } : current);
    setEditingMoment(null);
    setSelectedMomentId(saved.id);
    setNotice("Moment updated.");
  }

  async function toggleOutcome(moment: MomentRecord, outcome: "positive" | "negative") {
    try { await updateMoment(moment, { outcome: moment.outcome === outcome ? null : outcome }); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not classify the moment."); }
  }

  async function removeMoment(moment: MomentRecord) {
    if (!confirm(`Delete ${moment.momentType.name} and all of its submoments?`)) return;
    try {
      await apiFetch(`/api/moments/${moment.id}`, { method: "DELETE" });
      setMatch((current) => {
        if (!current) return current;
        const moments = current.moments.filter((item) => item.id !== moment.id);
        setSelectedMomentId(moments[0]?.id || null);
        return { ...current, moments, momentCount: Math.max(0, current.momentCount - 1) };
      });
      setNotice("Moment deleted.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not delete the moment."); }
  }

  async function setPeriodMarker(key: PeriodMarkerKey) {
    try {
      const saved = await apiFetch<MatchDetail>(`/api/matches/${matchId}`, { method: "PATCH", body: JSON.stringify({ [key]: roundTime(currentTime) }) });
      setMatch(saved);
      setNotice(`Match period saved at ${formatTime(currentTime)}.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not save the match period."); }
  }

  if (loading) return <div className="flex min-h-[65vh] items-center justify-center text-slate-400"><Loader2 className="mr-2 animate-spin" />Preparing analysis…</div>;
  if (!match || !settings) return <Panel className="border-red-400/20 p-5 text-red-100">{notice || "Could not open this match."}</Panel>;

  const attackDirection = getAttackDirectionAtTime(match, currentTime);
  const activeTypes = settings.momentTypes.filter((type) => activeMoments.some((active) => active.momentTypeId === type.id));
  const timelineDuration = duration || match.video?.durationSeconds || Math.max(1, ...match.moments.map((moment) => moment.endTimeSeconds));

  return <div className="space-y-4">
    <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={(event) => void loadVideo(event.target.files?.[0])} />

    <header className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[.045] p-4 lg:flex-row lg:items-center lg:justify-between"><div><Link href="/" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-white"><ArrowLeft size={13} />Matches</Link><h1 className="mt-2 text-2xl font-bold text-white">{match.title}</h1><p className="mt-1 text-sm text-slate-500">{match.competition || "No competition"} · {attackDirection ? `attack ${attackDirection === "left_to_right" ? "→" : "←"}` : "period not identified"}</p></div><Button onClick={() => fileInputRef.current?.click()}><Upload size={16} />{sourceUrl ? "Change video" : "Select video"}</Button></header>
    {notice ? <div className="rounded-xl border border-leaf-400/25 bg-leaf-400/10 px-4 py-3 text-sm text-emerald-100">{notice}</div> : null}
    {activeTypes.length > 0 ? <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-300/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"><CircleStop size={16} /><span className="font-semibold">In progress:</span>{activeTypes.map((type) => <Badge key={type.id} style={{ borderColor: type.color, color: type.color }}>{type.name} · key {type.defaultShortcut}</Badge>)}</div> : null}

    <div className="grid items-start gap-4 xl:grid-cols-[20rem_minmax(0,1fr)_22rem]">
      <Panel className="flex min-h-0 flex-col overflow-hidden" style={{ height: sideHeight }}><div className="shrink-0 border-b border-white/10 p-3"><div className="flex items-center justify-between"><div><Label>Tagged moments</Label><p className="mt-1 text-xs text-slate-500">{match.moments.length} in the video</p></div><Badge>{match.moments.length}</Badge></div></div><div className="min-h-0 flex-1 overflow-y-auto">{match.moments.length === 0 ? <p className="p-4 text-sm text-slate-500">There are no moments yet.</p> : match.moments.map((moment) => <div key={moment.id} className={`border-b border-white/[.06] p-2.5 ${selectedMomentId === moment.id ? "bg-leaf-400/10" : ""}`}><button className="flex w-full items-center gap-2 text-left" onClick={() => reviewMoment(moment)}><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: moment.momentType.color }} /><span className="min-w-0 flex-1 truncate text-xs font-semibold text-white">{moment.momentType.name}</span><span className="shrink-0 font-mono text-[10px] text-slate-500">{formatTime(moment.startTimeSeconds)}</span></button><div className="mt-2 flex items-center gap-1"><button aria-label="Mark as positive" onClick={() => void toggleOutcome(moment, "positive")} className={`flex h-7 w-7 items-center justify-center rounded-md border transition ${moment.outcome === "positive" ? "border-emerald-300 bg-emerald-400 text-emerald-950 shadow-[0_0_14px_rgba(52,211,153,.5)]" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/25"}`}><Check size={13} /></button><button aria-label="Mark as negative" onClick={() => void toggleOutcome(moment, "negative")} className={`flex h-7 w-7 items-center justify-center rounded-md border transition ${moment.outcome === "negative" ? "border-red-300 bg-red-400 text-red-950 shadow-[0_0_14px_rgba(248,113,113,.5)]" : "border-red-400/30 bg-red-400/10 text-red-300 hover:bg-red-400/25"}`}><X size={13} /></button><Button size="sm" className="ml-auto h-7" onClick={() => setEditingMoment(moment)}><Pencil size={12} />Edit</Button><Button size="sm" variant="danger" className="h-7" onClick={() => void removeMoment(moment)}><Trash2 size={12} />Delete</Button></div></div>)}</div></Panel>

      <div ref={playerWrapperRef}><Panel className="overflow-hidden"><div className="relative aspect-video bg-black">{sourceUrl ? <video ref={videoRef} src={sourceUrl} className="h-full w-full" playsInline onLoadedMetadata={(event) => { setDuration(event.currentTarget.duration); event.currentTarget.playbackRate = playbackRate; }} onTimeUpdate={(event) => { const video = event.currentTarget; setCurrentTime(video.currentTime); if (previewEnd !== null && video.currentTime >= previewEnd - .04) { video.pause(); video.currentTime = previewEnd; setPreviewEnd(null); } }} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} /> : <div className="flex h-full flex-col items-center justify-center p-8 text-center"><FileVideo size={50} className="text-leaf-400" /><h2 className="mt-4 font-bold text-white">{restoringVideo ? "Restoring the local video…" : "Select the local match video"}</h2><p className="mt-2 max-w-md text-sm text-slate-500">The file remains on your computer. The app only stores metadata and timestamps.</p>{match.video ? <div className="mt-4 w-full max-w-lg rounded-lg border border-leaf-400/25 bg-leaf-400/[.06] p-3 text-left"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-leaf-400/70">Expected video</p><p className="mt-1 truncate text-sm font-semibold text-white">{match.video.fileName}</p><p className="mt-1 text-xs text-slate-400">{formatBytes(match.video.fileSize)} · {formatTime(match.video.durationSeconds)}</p></div> : null}{!restoringVideo ? <Button className="mt-5" variant="primary" onClick={() => fileInputRef.current?.click()}><Upload size={16} />Choose video</Button> : null}</div>}</div>
        <div className="border-t border-white/10 p-3"><input aria-label="Video position" type="range" min={0} max={duration || 0} step={.1} value={Math.min(currentTime, duration || 0)} disabled={!sourceUrl} onChange={(event) => seekTo(Number(event.target.value))} className="w-full accent-emerald-400" /><div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_17rem]"><p className="self-end text-[11px] text-slate-500">Drag the bar to move anywhere in the video.</p><div><Label>Exact second</Label><div className="mt-1 flex gap-2"><Input inputMode="decimal" placeholder="e.g. 125.5" value={exactSecond} onChange={(event) => setExactSecond(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") goToExactSecond(); }} /><Button disabled={!sourceUrl} onClick={goToExactSecond}>Go</Button></div></div></div><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-2"><Button size="icon" onClick={() => seekBy(-15)} disabled={!sourceUrl} title="Back 15 seconds"><ChevronsLeft size={17} /></Button><Button size="sm" onClick={() => seekBy(-5)} disabled={!sourceUrl}>−5</Button><Button size="icon" variant="primary" disabled={!sourceUrl || saving} onClick={togglePlayback}>{playing ? <Pause size={17} /> : <Play size={17} />}</Button><Button size="sm" onClick={() => seekBy(5)} disabled={!sourceUrl}>+5</Button><Button size="icon" onClick={() => seekBy(15)} disabled={!sourceUrl} title="Forward 15 seconds"><ChevronsRight size={17} /></Button><div className="ml-1 flex overflow-hidden rounded-lg border border-white/10">{[1, 2, 4].map((rate) => <button key={rate} type="button" onClick={() => setRate(rate)} className={`h-9 px-2.5 text-xs font-semibold transition ${playbackRate === rate ? "bg-leaf-400 text-ink-950" : "bg-white/[.04] text-slate-300 hover:bg-white/[.1]"}`}>{rate}×</button>)}</div></div><span className="inline-flex items-center gap-2 font-mono text-sm text-white"><Clock3 size={15} className="text-leaf-400" />{formatTime(currentTime)} / {formatTime(duration)}</span></div></div></Panel></div>

      <Panel className="flex min-h-0 flex-col overflow-y-auto" style={{ height: sideHeight }}><div className="border-b border-white/10 p-3"><div className="flex items-center justify-between"><Label>Main moments</Label><Keyboard size={16} className="text-leaf-400" /></div><div className="mt-3 grid grid-cols-2 gap-2">{settings.momentTypes.filter((type) => type.active).map((type) => { const active = activeMoments.some((item) => item.momentTypeId === type.id); return <button key={type.id} type="button" onClick={() => toggleMoment(type)} className={`flex min-h-14 items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition ${active ? "text-white shadow-[0_0_20px_rgba(45,214,111,.2)]" : "border-white/10 bg-white/[.04] hover:bg-white/[.09]"}`} style={active ? { backgroundColor: `${type.color}30`, borderColor: type.color } : undefined}><span className="min-w-0"><span className="block truncate text-[11px] font-bold" style={{ color: type.color }}>{type.name}</span>{active ? <span className="mt-1 block text-[9px] text-white">In progress</span> : null}</span><kbd className="rounded border border-white/10 bg-black/20 px-1.5 py-0.5 text-[10px] text-slate-300">{type.defaultShortcut || "—"}</kbd></button>; })}</div></div><div className="p-3"><Label>Match periods</Label><p className="mt-1 text-[10px] leading-4 text-slate-500">Mark the current time, then click a saved time to return to it.</p><div className="mt-3 space-y-2">{periodMarkers.map(([key, label]) => { const seconds = match[key]; return <div key={key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"><Button size="sm" className="justify-between" variant={seconds === null ? "secondary" : "primary"} disabled={!sourceUrl && seconds === null} onClick={() => seconds === null ? void setPeriodMarker(key) : seekTo(seconds)}><span className="truncate">{label}</span><span className="ml-2 font-mono text-[10px]">{seconds === null ? "Mark" : formatTime(seconds)}</span></Button><Button size="sm" disabled={!sourceUrl} onClick={() => void setPeriodMarker(key)}>Set</Button></div>; })}</div></div></Panel>
    </div>

    <Timeline momentTypes={settings.momentTypes} moments={match.moments} duration={timelineDuration} selectedMomentId={selectedMomentId} onSelect={reviewMoment} />

    <Panel className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"><div><Label>Identification</Label><h2 className="mt-1 font-bold text-white">Submoments</h2><p className="mt-1 text-sm text-slate-500">After tagging the main moments, classify each clip and mark pitch/goal locations in a dedicated area.</p></div><Button variant="primary" disabled={match.moments.length === 0 || activeMoments.length > 0} onClick={() => router.push(`/analysis/${matchId}/submoments`)}><Tags size={16} />Identify submoments</Button></Panel>

    {editingMoment ? <MomentEditDialog moment={editingMoment} momentTypes={settings.momentTypes} currentTime={currentTime} duration={duration || match.video?.durationSeconds || 0} onSave={(input) => updateMoment(editingMoment, input)} onClose={() => setEditingMoment(null)} /> : null}
  </div>;
}

function Timeline({ momentTypes, moments, duration, selectedMomentId, onSelect }: { momentTypes: MomentTypeRecord[]; moments: MomentRecord[]; duration: number; selectedMomentId: string | null; onSelect: (moment: MomentRecord) => void }) {
  const visibleTypes = useMemo(() => momentTypes.filter((type) => type.active || moments.some((moment) => moment.momentTypeId === type.id)), [momentTypes, moments]);
  return <Panel className="overflow-hidden p-4"><div><Label>Timeline</Label><h2 className="mt-1 font-bold text-white">Moments in the video</h2></div><div className="mt-4 overflow-x-auto"><div className="min-w-[850px] overflow-hidden rounded-xl border border-white/10">{visibleTypes.map((type) => <div key={type.id} className="grid grid-cols-[10rem_minmax(0,1fr)] border-b border-white/[.07] last:border-b-0"><div className="flex items-center gap-2 border-r border-white/[.07] px-3 py-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: type.color }} /><span className="truncate text-xs text-slate-300">{type.name}</span></div><div className="relative min-h-10 bg-black/10">{moments.filter((moment) => moment.momentTypeId === type.id).map((moment) => { const left = Math.max(0, Math.min(100, (moment.startTimeSeconds / duration) * 100)); const width = Math.max(.6, Math.min(100 - left, ((moment.endTimeSeconds - moment.startTimeSeconds) / duration) * 100)); return <button key={moment.id} type="button" title={`${type.name}: ${formatTime(moment.startTimeSeconds)} – ${formatTime(moment.endTimeSeconds)}`} onClick={() => onSelect(moment)} className={`absolute top-1/2 h-4 -translate-y-1/2 rounded-full border border-white/20 transition hover:h-6 ${selectedMomentId === moment.id ? "h-6 ring-2 ring-white/40" : ""}`} style={{ left: `${left}%`, width: `${width}%`, backgroundColor: type.color }} />; })}</div></div>)}</div></div></Panel>;
}
