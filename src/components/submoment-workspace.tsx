"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Crosshair, FileVideo, Goal, Loader2, MapPin, Pause, Pencil, Play, Save, Settings2, Trash2, Upload, X } from "lucide-react";

import { Coordinate, GoalSurface, PitchSurface } from "@/components/analysis-surfaces";
import { Badge, Button, Label, Panel, Select, TextArea } from "@/components/ui";
import type { MatchDetail, MomentRecord, SettingsPayload, SubMomentRecord } from "@/lib/domain";
import { apiFetch } from "@/lib/http";
import { getRememberedMatchVideo, rememberMatchVideo, videoPersistsAfterRestart } from "@/lib/local-video-store";
import { getMatchPeriodAtTime, matchPeriodLabel } from "@/lib/match-periods";
import { formatBytes, formatTime, roundTime } from "@/lib/time";

export function SubmomentWorkspace({ matchId }: { matchId: string }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [restoringVideo, setRestoringVideo] = useState(true);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [filterTypeId, setFilterTypeId] = useState("");
  const [selectedMomentId, setSelectedMomentId] = useState<string | null>(null);
  const [selectedSubMomentTypeId, setSelectedSubMomentTypeId] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [fieldPoint, setFieldPoint] = useState<Coordinate | null>(null);
  const [goalPoint, setGoalPoint] = useState<Coordinate | null>(null);
  const [foot, setFoot] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingSubmomentId, setEditingSubmomentId] = useState<string | null>(null);

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
      .then((file) => {
        if (file) setSourceUrl(URL.createObjectURL(file));
      })
      .catch(() => undefined)
      .finally(() => setRestoringVideo(false));
  }, [matchId]);

  useEffect(() => () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  }, [sourceUrl]);

  const moments = useMemo(() => (match?.moments || []).filter((moment) => !filterTypeId || moment.momentTypeId === filterTypeId), [filterTypeId, match?.moments]);
  const selectedIndex = moments.findIndex((moment) => moment.id === selectedMomentId);
  const selectedMoment = selectedIndex >= 0 ? moments[selectedIndex] : moments[0] || null;
  const selectedMomentType = settings?.momentTypes.find((type) => type.id === selectedMoment?.momentTypeId) || null;
  const allowedSubmomentIds = useMemo(() => new Set(selectedMomentType?.allowedSubmoments?.map((type) => type.id) || []), [selectedMomentType]);
  const availableSubmomentTypes = useMemo(() => (settings?.subMomentTypes || []).filter((type) => type.active && allowedSubmomentIds.has(type.id)), [allowedSubmomentIds, settings?.subMomentTypes]);
  const selectedSubMomentType = availableSubmomentTypes.find((type) => type.id === selectedSubMomentTypeId) || null;
  const directionTime = selectedMoment ? Math.min(selectedMoment.endTimeSeconds, Math.max(selectedMoment.startTimeSeconds, currentTime)) : currentTime;
  const selectedPeriod = match ? getMatchPeriodAtTime(match, directionTime) : null;
  const fieldMarkers = useMemo(() => (selectedMoment?.subMoments || []).filter((sub) => sub.fieldX !== null && sub.fieldY !== null).map((sub) => ({ id: sub.id, x: sub.fieldX!, y: sub.fieldY!, color: sub.subMomentType.color, label: sub.subMomentType.name, details: [sub.timeSeconds === null ? "Time not recorded" : `Time: ${formatTime(sub.timeSeconds)}`, `Match: ${match?.title || "Unknown"}`] })), [match?.title, selectedMoment]);
  const goalMarkers = useMemo(() => (selectedMoment?.subMoments || []).filter((sub) => sub.goalX !== null && sub.goalY !== null).map((sub) => ({ id: sub.id, x: sub.goalX!, y: sub.goalY!, color: sub.subMomentType.color, label: sub.subMomentType.name, details: [sub.timeSeconds === null ? "Time not recorded" : `Time: ${formatTime(sub.timeSeconds)}`, `Match: ${match?.title || "Unknown"}`] })), [match?.title, selectedMoment]);

  useEffect(() => {
    if (availableSubmomentTypes.some((type) => type.id === selectedSubMomentTypeId)) return;
    setSelectedSubMomentTypeId(availableSubmomentTypes[0]?.id || "");
    setFieldPoint(null);
    setGoalPoint(null);
    setEditingSubmomentId(null);
  }, [availableSubmomentTypes, selectedSubMomentTypeId]);

  function loadVideo(file?: File) {
    if (!file) return;
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    setSourceUrl(URL.createObjectURL(file));
    void rememberMatchVideo(matchId, file).catch(() => setNotice("The video opened, but it will not remain available after this tab is closed."));
    if (!videoPersistsAfterRestart(file)) setNotice("This large video is available during this browser session. Select it again after closing or fully refreshing the app.");
    if (match?.video && file.name !== match.video.fileName) setNotice(`You selected “${file.name}”, but this match expects “${match.video.fileName}”. Confirm that this is the correct file.`);
    else setNotice(null);
  }

  function selectMoment(moment: MomentRecord, play = false) {
    setSelectedMomentId(moment.id);
    setFieldPoint(null);
    setGoalPoint(null);
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = moment.startTimeSeconds;
    setCurrentTime(moment.startTimeSeconds);
    if (play) void video.play(); else video.pause();
  }

  function changeFilter(typeId: string) {
    setFilterTypeId(typeId);
    const first = match?.moments.find((moment) => !typeId || moment.momentTypeId === typeId) || null;
    setSelectedMomentId(first?.id || null);
    if (first && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = first.startTimeSeconds;
      setCurrentTime(first.startTimeSeconds);
    }
  }

  function togglePlayback() {
    const video = videoRef.current;
    if (!video || !selectedMoment) return;
    if (!video.paused) {
      video.pause();
      return;
    }
    if (video.currentTime < selectedMoment.startTimeSeconds || video.currentTime >= selectedMoment.endTimeSeconds) video.currentTime = selectedMoment.startTimeSeconds;
    void video.play();
  }

  function setRate(rate: number) {
    setPlaybackRate(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
  }

  function handleTimeUpdate() {
    const video = videoRef.current;
    if (!video || !selectedMoment) return;
    setCurrentTime(video.currentTime);
    if (video.currentTime < selectedMoment.endTimeSeconds - .04) return;
    video.pause();
    video.currentTime = selectedMoment.endTimeSeconds;
    setCurrentTime(selectedMoment.endTimeSeconds);
  }

  function chooseSubMomentType(typeId: string) {
    setSelectedSubMomentTypeId(typeId);
    setFieldPoint(null);
    setGoalPoint(null);
    videoRef.current?.pause();
    setEditingSubmomentId(null);
  }

  function editSubmoment(submoment: SubMomentRecord) {
    setEditingSubmomentId(submoment.id);
    setSelectedSubMomentTypeId(submoment.subMomentTypeId);
    setFieldPoint(submoment.fieldX !== null && submoment.fieldY !== null ? { x: submoment.fieldX, y: submoment.fieldY } : null);
    setGoalPoint(submoment.goalX !== null && submoment.goalY !== null ? { x: submoment.goalX, y: submoment.goalY } : null);
    setFoot(submoment.foot || "");
    setNotes(submoment.notes || "");
    if (submoment.timeSeconds !== null) {
      setCurrentTime(submoment.timeSeconds);
      if (videoRef.current) videoRef.current.currentTime = submoment.timeSeconds;
    }
    videoRef.current?.pause();
  }

  function cancelSubmomentEdit() {
    setEditingSubmomentId(null);
    setFieldPoint(null); setGoalPoint(null); setFoot(""); setNotes("");
  }

  async function saveSubmoment() {
    if (!match || !selectedMoment || !selectedSubMomentType) return;
    if (selectedSubMomentType.requiresFieldLocation && !fieldPoint) {
      setNotice("Mark the occurrence location on the pitch.");
      return;
    }
    if (selectedSubMomentType.requiresGoalLocation && !goalPoint) {
      setNotice("Also mark the location on the goal.");
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      const eventTime = Math.min(selectedMoment.endTimeSeconds, Math.max(selectedMoment.startTimeSeconds, currentTime));
      const saved = await apiFetch<SubMomentRecord>(editingSubmomentId ? `/api/submoments/${editingSubmomentId}` : `/api/moments/${selectedMoment.id}/submoments`, {
        method: editingSubmomentId ? "PATCH" : "POST",
        body: JSON.stringify({
          subMomentTypeId: selectedSubMomentType.id,
          timeSeconds: roundTime(eventTime),
          fieldX: fieldPoint?.x ?? null,
          fieldY: fieldPoint?.y ?? null,
          goalX: goalPoint?.x ?? null,
          goalY: goalPoint?.y ?? null,
          foot: foot || null,
          notes: notes || null
        })
      });
      setMatch({ ...match, moments: match.moments.map((moment) => moment.id === selectedMoment.id ? { ...moment, subMoments: editingSubmomentId ? moment.subMoments.map((item) => item.id === saved.id ? saved : item) : [...moment.subMoments, saved] } : moment) });
      setEditingSubmomentId(null);
      setFieldPoint(null);
      setGoalPoint(null);
      setFoot("");
      setNotes("");
      setNotice(`${selectedSubMomentType.name} ${editingSubmomentId ? "updated" : "saved"} at ${formatTime(eventTime)}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save the submoment.");
    } finally {
      setSaving(false);
    }
  }

  async function removeSubmoment(submoment: SubMomentRecord) {
    if (!match || !selectedMoment || !confirm(`Delete ${submoment.subMomentType.name}?`)) return;
    try {
      await apiFetch(`/api/submoments/${submoment.id}`, { method: "DELETE" });
      setMatch({ ...match, moments: match.moments.map((moment) => moment.id === selectedMoment.id ? { ...moment, subMoments: moment.subMoments.filter((item) => item.id !== submoment.id) } : moment) });
      setNotice("Submoment deleted.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not delete the submoment.");
    }
  }

  if (loading) return <div className="flex min-h-[65vh] items-center justify-center text-slate-400"><Loader2 className="mr-2 animate-spin" />Preparing submoments…</div>;
  if (!match || !settings) return <Panel className="border-red-400/20 p-5 text-red-100">{notice || "Could not open this match."}</Panel>;

  return <div className="space-y-4">
    <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={(event) => loadVideo(event.target.files?.[0])} />

    <header className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[.045] p-4 lg:flex-row lg:items-center lg:justify-between"><div><Link href={`/analysis/${matchId}`} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-white"><ArrowLeft size={13} />Back to moment tagging</Link><h1 className="mt-2 text-2xl font-bold text-white">Identify submoments</h1><p className="mt-1 text-sm text-slate-500">{match.title} · {match.moments.length} moments</p></div><Button onClick={() => fileInputRef.current?.click()}><Upload size={16} />{sourceUrl ? "Change video" : "Select video"}</Button></header>
    {notice ? <div className="rounded-xl border border-leaf-400/25 bg-leaf-400/10 px-4 py-3 text-sm text-emerald-100">{notice}</div> : null}

    <Panel className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end"><label className="grid gap-2"><Label>Filter moments</Label><Select value={filterTypeId} onChange={(event) => changeFilter(event.target.value)}><option value="">All moments ({match.moments.length})</option>{settings.momentTypes.map((type) => <option key={type.id} value={type.id}>{type.name} ({match.moments.filter((moment) => moment.momentTypeId === type.id).length})</option>)}</Select></label><Badge>{selectedIndex >= 0 ? `${selectedIndex + 1} / ${moments.length}` : `0 / ${moments.length}`}</Badge></Panel>

    <Panel className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Label>Identification</Label>
          <h2 className="mt-1 text-base font-bold text-white">Submoment actions</h2>
          <p className="mt-1 text-xs text-slate-500">Choose the action first, then mark its pitch or goal location.</p>
        </div>
        <Link href="/settings"><Button size="sm"><Settings2 size={14} />Manage actions</Button></Link>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {availableSubmomentTypes.map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => chooseSubMomentType(type.id)}
            className={`flex min-h-12 items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm font-semibold transition ${selectedSubMomentTypeId === type.id ? "text-white shadow-lg" : "border-white/10 bg-white/[.04] text-slate-300 hover:border-white/20 hover:bg-white/[.08]"}`}
            style={selectedSubMomentTypeId === type.id ? { backgroundColor: `${type.color}35`, borderColor: type.color } : undefined}
          >
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: type.color }} />
            <span className="min-w-0 flex-1 truncate">{type.name}</span>
            {type.defaultShortcut ? <kbd className="rounded border border-white/10 bg-black/20 px-2 py-1 font-mono text-[10px] text-slate-300">{type.defaultShortcut.toUpperCase()}</kbd> : null}
          </button>
        ))}
        {selectedMoment && availableSubmomentTypes.length === 0 ? <p className="text-sm text-amber-200/70">This moment has no associated submoments. Configure them in Settings.</p> : null}
      </div>
    </Panel>

    <div className="submoment-layout grid grid-cols-[minmax(0,.72fr)_minmax(0,1.65fr)_minmax(0,1fr)] items-start gap-2 sm:gap-4 min-[1248px]:grid-cols-[18rem_minmax(30rem,1fr)_25rem]">
      <Panel className="max-h-[72vh] overflow-y-auto xl:sticky xl:top-24"><div className="sticky top-0 z-10 border-b border-white/10 bg-ink-900 px-4 py-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">Moments ({moments.length})</div>{moments.length === 0 ? <p className="p-4 text-sm text-slate-500">There are no moments in this filter.</p> : moments.map((moment, index) => <button key={moment.id} onClick={() => selectMoment(moment)} className={`flex w-full items-center gap-3 border-b border-white/[.06] p-3 text-left transition hover:bg-white/[.06] ${selectedMoment?.id === moment.id ? "bg-leaf-400/10" : ""}`}><span className="font-mono text-xs text-slate-600">{index + 1}</span><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: moment.momentType.color }} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-white">{moment.momentType.name}</span><span className="font-mono text-xs text-slate-500">{formatTime(moment.startTimeSeconds)} – {formatTime(moment.endTimeSeconds)}</span></span><Badge>{moment.subMoments.length}</Badge></button>)}</Panel>

      <div className="space-y-4">
        <Panel className="overflow-hidden"><div className="relative aspect-video bg-black">{sourceUrl ? <video ref={videoRef} src={sourceUrl} className="h-full w-full" playsInline onLoadedMetadata={(event) => { event.currentTarget.playbackRate = playbackRate; }} onTimeUpdate={handleTimeUpdate} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} /> : <div className="flex h-full flex-col items-center justify-center p-8 text-center"><FileVideo size={50} className="text-leaf-400" /><h2 className="mt-4 font-bold text-white">{restoringVideo ? "Restoring the local video…" : "Select the video again"}</h2><p className="mt-2 max-w-md text-sm text-slate-500">Large videos remain available between pages while this browser tab stays open.</p>{match.video ? <div className="mt-4 rounded-lg border border-white/10 bg-white/[.05] px-3 py-2 text-xs text-slate-400">Expected: {match.video.fileName} · {formatBytes(match.video.fileSize)}</div> : null}{!restoringVideo ? <Button className="mt-5" variant="primary" onClick={() => fileInputRef.current?.click()}><Upload size={16} />Choose video</Button> : null}</div>}</div><div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 p-3"><div className="flex gap-2"><Button size="icon" disabled={selectedIndex <= 0} onClick={() => selectMoment(moments[selectedIndex - 1])}><ChevronLeft /></Button><Button size="icon" variant="primary" disabled={!sourceUrl || !selectedMoment} onClick={togglePlayback}>{playing ? <Pause /> : <Play />}</Button><Button size="icon" disabled={selectedIndex < 0 || selectedIndex >= moments.length - 1} onClick={() => selectMoment(moments[selectedIndex + 1])}><ChevronRight /></Button><div className="flex overflow-hidden rounded-lg border border-white/10">{[1, 2, 4].map((rate) => <button key={rate} type="button" onClick={() => setRate(rate)} className={`h-9 px-2.5 text-xs font-semibold transition ${playbackRate === rate ? "bg-leaf-400 text-ink-950" : "bg-white/[.04] text-slate-300 hover:bg-white/[.1]"}`}>{rate}×</button>)}</div></div><span className="font-mono text-sm text-white">{formatTime(currentTime)} {selectedMoment ? <span className="text-slate-600">/ {formatTime(selectedMoment.endTimeSeconds)}</span> : null}</span></div></Panel>
        <Panel className="p-4"><div className="flex items-center justify-between"><div><Label>Moment map</Label><p className="mt-1 text-xs text-slate-500">Points already saved in this moment · {matchPeriodLabel(selectedPeriod)}.</p></div><Badge>{fieldMarkers.length}</Badge></div>{!selectedPeriod ? <div className="mt-3 rounded-lg border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">Set the start and end of this half in moment tagging before its occurrences are assigned or compared.</div> : null}<PitchSurface className="mt-3" points={fieldMarkers} /></Panel>
      </div>

      <Panel className="p-4 xl:sticky xl:top-24"><div className="flex items-center justify-between"><div><Label>Tag submoment</Label><p className="mt-1 text-xs text-slate-500">{selectedMoment ? `${selectedMoment.momentType.name} · ${formatTime(currentTime)}` : "Select a moment"}</p></div><Crosshair className="text-leaf-400" size={19} /></div><div className="mt-3 grid grid-cols-2 gap-2">{availableSubmomentTypes.map((type) => <button key={type.id} type="button" onClick={() => chooseSubMomentType(type.id)} className={`min-h-10 rounded-lg border px-2 py-2 text-xs font-semibold transition ${selectedSubMomentTypeId === type.id ? "text-white shadow-lg" : "border-white/10 bg-white/[.04] text-slate-400 hover:bg-white/[.08]"}`} style={selectedSubMomentTypeId === type.id ? { backgroundColor: `${type.color}35`, borderColor: type.color } : undefined}><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: type.color }} />{type.name}</button>)}</div>

        {selectedMoment && selectedSubMomentType ? <div className="mt-4 space-y-4 border-t border-white/10 pt-4">{editingSubmomentId ? <div className="flex items-center justify-between rounded-lg border border-leaf-400/25 bg-leaf-400/10 px-3 py-2 text-xs text-emerald-100"><span>Editing saved submoment</span><Button size="sm" onClick={cancelSubmomentEdit}><X size={13} />Cancel</Button></div> : null}{selectedSubMomentType.requiresFieldLocation ? <div><div className="mb-2 flex items-center justify-between"><Label>Occurrence location</Label><MapPin size={14} className="text-slate-500" /></div><PitchSurface value={fieldPoint} color={selectedSubMomentType.color} onChange={setFieldPoint} /></div> : null}{selectedSubMomentType.requiresGoalLocation ? <div><div className="mb-2 flex items-center justify-between"><Label>Goal location</Label><Goal size={14} className="text-slate-500" /></div><GoalSurface points={goalMarkers} value={goalPoint} color={selectedSubMomentType.color} onChange={setGoalPoint} /></div> : null}<label className="grid gap-2"><Label>Body part</Label><Select value={foot} onChange={(event) => setFoot(event.target.value)}><option value="">Not specified</option><option value="right">Right foot</option><option value="left">Left foot</option><option value="head">Head</option><option value="other">Other</option></Select></label><label className="grid gap-2"><Label>Notes</Label><TextArea className="min-h-16" value={notes} onChange={(event) => setNotes(event.target.value)} /></label><Button className="w-full" variant="primary" disabled={saving} onClick={() => void saveSubmoment()}><Save size={15} />{editingSubmomentId ? "Update" : "Save"} {selectedSubMomentType.name}</Button><div><div className="mb-2 flex items-center justify-between"><Label>Saved</Label><Badge>{selectedMoment.subMoments.length}</Badge></div>{selectedMoment.subMoments.length === 0 ? <p className="text-xs text-slate-500">There are no submoments yet.</p> : selectedMoment.subMoments.map((submoment) => <div key={submoment.id} className="flex items-center gap-2 border-t border-white/[.06] py-2"><button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => { const video = videoRef.current; if (!video || submoment.timeSeconds === null) return; video.pause(); video.currentTime = submoment.timeSeconds; setCurrentTime(submoment.timeSeconds); }}><span className="h-3 w-3 rounded-full" style={{ backgroundColor: submoment.subMomentType.color }} /><span className="min-w-0 flex-1 truncate text-xs text-slate-300">{submoment.subMomentType.name} · {formatTime(submoment.timeSeconds || 0)}</span></button><Button size="icon" className="h-7 w-7" onClick={() => editSubmoment(submoment)}><Pencil size={12} /></Button><Button size="icon" variant="danger" className="h-7 w-7" onClick={() => void removeSubmoment(submoment)}><Trash2 size={12} /></Button></div>)}</div></div> : <div className="mt-4 rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-slate-500">Select a moment to begin.</div>}
      </Panel>
    </div>
  </div>;
}
