"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, CheckSquare, FileVideo, Loader2, Pause, Play, Square, Upload, X } from "lucide-react";
import { Badge, Button, Label, Panel, Select } from "@/components/ui";
import type { AccountPayload, MatchDetail, MatchSummary, MomentRecord, SettingsPayload } from "@/lib/domain";
import { isExportPickerCancellation, pickExportDirectory, writeBlobToDirectory } from "@/lib/export-directory";
import { apiFetch } from "@/lib/http";
import { getRememberedMatchVideo, rememberMatchVideo } from "@/lib/local-video-store";
import { getRemoteVideoUrl } from "@/lib/remote-video-store";
import { SmartVideoExportSession } from "@/lib/smart-video-export";
import { formatTime } from "@/lib/time";
import { downloadBlob, exportQualityOptions, type ExportQuality } from "@/lib/video-export";

type Clip = { match: MatchDetail; moment: MomentRecord };

export function ReportsClient() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const objectUrl = useRef<string | null>(null);
  const files = useRef(new Map<string, File>());
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [details, setDetails] = useState<MatchDetail[]>([]);
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [momentTypeId, setMomentTypeId] = useState("");
  const [submomentTypeId, setSubmomentTypeId] = useState("");
  const [quality, setQuality] = useState<ExportQuality>("high");
  const [playing, setPlaying] = useState<{ clip: Clip; url: string } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("Team");

  useEffect(() => { Promise.all([apiFetch<MatchSummary[]>("/api/matches"), apiFetch<SettingsPayload>("/api/settings"), apiFetch<AccountPayload>("/api/account")]).then(([rows, config, account]) => { setMatches(rows); setSettings(config); setTeamName(account.teamName || "Team"); }).catch((error: Error) => setNotice(error.message)).finally(() => setLoading(false)); }, []);
  useEffect(() => { let cancelled = false; if (!selectedIds.length) { setDetails([]); return; } setLoadingDetails(true); Promise.all(selectedIds.map((id) => apiFetch<MatchDetail>(`/api/matches/${id}`))).then((rows) => { if (!cancelled) setDetails(rows); }).catch((error: Error) => setNotice(error.message)).finally(() => { if (!cancelled) setLoadingDetails(false); }); return () => { cancelled = true; }; }, [selectedIds]);
  useEffect(() => () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);

  const clips = useMemo<Clip[]>(() => details.flatMap((match) => match.moments.filter((moment) => !momentTypeId || moment.momentTypeId === momentTypeId).filter((moment) => !submomentTypeId || moment.subMoments.some((sub) => sub.subMomentTypeId === submomentTypeId)).map((moment) => ({ match, moment }))), [details, momentTypeId, submomentTypeId]);
  const availableSubmomentTypes = useMemo(() => {
    if (!settings || !momentTypeId) return settings?.subMomentTypes || [];
    const allowedIds = new Set(settings.momentTypes.find((type) => type.id === momentTypeId)?.allowedSubmoments?.map((type) => type.id) || []);
    return settings.subMomentTypes.filter((type) => allowedIds.has(type.id));
  }, [momentTypeId, settings]);
  const totalDuration = clips.reduce((sum, clip) => sum + clip.moment.durationSeconds, 0);
  const totalSubmoments = clips.reduce((sum, clip) => sum + clip.moment.subMoments.length, 0);

  function toggleMatch(id: string) { setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  async function getVideo(match: MatchDetail) { const file = files.current.get(match.id) || await getRememberedMatchVideo(match.id).catch(() => null); if (file) files.current.set(match.id, file); return file; }

  async function addVideos(list: FileList | null) {
    if (!list) return;
    const unmatched: string[] = [];
    for (const file of Array.from(list)) {
      const match = matches.find((item) => item.video?.fileName.toLowerCase() === file.name.toLowerCase());
      if (!match) { unmatched.push(file.name); continue; }
      files.current.set(match.id, file); await rememberMatchVideo(match.id, file).catch(() => undefined);
    }
    setNotice(unmatched.length ? `Could not match: ${unmatched.join(", ")}.` : "Local videos are ready.");
  }

  async function playClip(clip: Clip) {
    if (clip.match.video?.storageStatus === "READY") {
      const remote = await getRemoteVideoUrl(clip.match.id).catch(() => null);
      if (remote) {
        if (objectUrl.current) {
          URL.revokeObjectURL(objectUrl.current);
          objectUrl.current = null;
        }
        setPlaying({ clip, url: remote.url });
        setNotice(null);
        return;
      }
    }
    const file = await getVideo(clip.match);
    if (!file) return setNotice(clip.match.video?.storageStatus === "READY" ? `The cloud video for “${clip.match.title}” could not be loaded.` : `Upload the video for “${clip.match.title}” from its analysis page.`);
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = URL.createObjectURL(file); setPlaying({ clip, url: objectUrl.current }); setNotice(null);
  }

  async function exportClips() {
    if (!clips.length) return;
    let directory = null;
    try { directory = await pickExportDirectory(); } catch (error) { if (isExportPickerCancellation(error)) return; return setNotice(error instanceof Error ? error.message : "Could not open the export folder."); }
    setExporting(true); setNotice(null);
    const root = `${safeName(teamName)}-report-${selectedIds.length}-matches-${clips.length}-clips`;
    const archive = directory ? null : new (await import("jszip")).default();
    const indexRows = [["match", "moment", "start", "end", "submoments", "files"]];
    let completed = 0;
    try {
      const groups = new Map<string, Clip[]>(); for (const clip of clips) groups.set(clip.match.id, [...(groups.get(clip.match.id) || []), clip]);
      for (const group of groups.values()) {
        const match = group[0].match; const file = await getVideo(match); if (!file) throw new Error(`Load the local video for “${match.title}” before exporting.`);
        const url = URL.createObjectURL(file); const session = new SmartVideoExportSession(file);
        try {
          for (const clip of group) {
            completed += 1; setStatus(`Exporting ${completed} of ${clips.length}: ${clip.match.title}`);
            const result = await session.exportMoment({ match: clip.match, moment: clip.moment, quality, sourceUrlFallback: url, onStatus: (message) => setStatus(`${completed} of ${clips.length}: ${message}`) });
            const folders = [...new Set(clip.moment.subMoments.map((item) => item.subMomentType.name))]; if (!folders.length) folders.push("No submoment");
            const fileName = `${String(completed).padStart(3, "0")}-${result.fileName}`; const paths = folders.map((folder) => `${safeName(clip.moment.momentType.name)}/${safeName(folder)}/${fileName}`);
            for (const path of paths) { if (directory) await writeBlobToDirectory(directory, `${root}/${path}`, result.blob); else archive?.file(`${root}/${path}`, result.blob); }
            indexRows.push([clip.match.title, clip.moment.momentType.name, String(clip.moment.startTimeSeconds), String(clip.moment.endTimeSeconds), folders.join(" | "), paths.join(" | ")]);
          }
        } finally { session.dispose(); URL.revokeObjectURL(url); }
      }
      const csv = new Blob([toCsv(indexRows)], { type: "text/csv;charset=utf-8" });
      if (directory) await writeBlobToDirectory(directory, `${root}/report-index.csv`, csv);
      else {
        archive?.file(`${root}/report-index.csv`, csv);
        setStatus("Creating the ZIP file…");
        const blob = await archive!.generateAsync({ type: "blob", compression: "STORE", streamFiles: true }, (metadata) => setStatus(`Creating the ZIP file: ${Math.round(metadata.percent)}%`));
        downloadBlob(blob, `${root}.zip`);
      }
      setNotice(`${completed} clips exported successfully${directory ? ` to ${root}` : " in a ZIP file"}.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not export the clips."); } finally { setExporting(false); setStatus(""); }
  }

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-slate-400"><Loader2 className="mr-2 animate-spin" />Loading reports…</div>;
  return <div className="space-y-5"><header><p className="text-xs font-bold uppercase tracking-[.22em] text-leaf-400">Aggregated analysis</p><h1 className="mt-2 text-3xl font-bold text-white">Reports and clip export</h1><p className="mt-2 text-sm text-slate-400">Select matches, filter moments, play clips and export them into moment/submoment folders.</p></header>
    {notice ? <div className="flex justify-between rounded-xl border border-leaf-400/25 bg-leaf-400/10 p-3 text-sm text-emerald-100"><span>{notice}</span><button onClick={() => setNotice(null)}><X size={16} /></button></div> : null}{exporting ? <div className="flex items-center gap-3 rounded-xl border border-leaf-400/25 bg-leaf-400/10 p-3 text-sm text-emerald-100"><Loader2 className="animate-spin" size={17} />{status}</div> : null}
    <div className="grid gap-4 md:grid-cols-3"><Metric label="Clips" value={clips.length} /><Metric label="Clip duration" value={formatTime(totalDuration)} /><Metric label="Submoments" value={totalSubmoments} /></div>
    <Panel className="grid gap-4 p-4 md:grid-cols-3"><label className="grid gap-2"><Label>Moment</Label><Select value={momentTypeId} onChange={(event) => { setMomentTypeId(event.target.value); setSubmomentTypeId(""); }}><option value="">All moments</option>{settings?.momentTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</Select></label><label className="grid gap-2"><Label>Submoment</Label><Select value={submomentTypeId} onChange={(event) => setSubmomentTypeId(event.target.value)}><option value="">All submoments</option>{availableSubmomentTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</Select></label><label className="grid gap-2"><Label>Export quality</Label><Select value={quality} onChange={(event) => setQuality(event.target.value as ExportQuality)}>{exportQualityOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select><span className="text-[10px] text-slate-500">{exportQualityOptions.find((item) => item.value === quality)?.detail}</span></label></Panel>
    <div className="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]"><Panel className="overflow-hidden"><div className="flex gap-2 border-b border-white/10 p-3"><Button size="sm" onClick={() => setSelectedIds(matches.map((item) => item.id))}><CheckSquare size={14} />Select all</Button><Button size="sm" onClick={() => setSelectedIds([])}>Clear</Button></div><div className="max-h-[42rem] overflow-y-auto">{matches.map((match) => <button key={match.id} onClick={() => toggleMatch(match.id)} className={`flex w-full items-start gap-3 border-b border-white/[.06] p-3 text-left hover:bg-white/[.06] ${selectedIds.includes(match.id) ? "bg-leaf-400/10" : ""}`}>{selectedIds.includes(match.id) ? <CheckSquare size={17} className="text-leaf-400" /> : <Square size={17} className="text-slate-600" />}<span className="min-w-0"><span className="block truncate text-sm font-semibold text-white">{match.title}</span><span className="text-xs text-slate-500">{match.momentCount} moments · {match.video?.fileName || "No video"}</span></span></button>)}</div></Panel>
      <div className="space-y-4"><Panel className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-semibold text-white">{loadingDetails ? "Loading clips…" : `${clips.length} clips found`}</p><p className="text-xs text-slate-500">Cloud videos are used for playback. Local files are only needed for clip export.</p></div><div className="flex flex-wrap gap-2"><label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/[.06] px-3 text-sm font-semibold text-slate-100 hover:bg-white/[.11]"><Upload size={15} />Load files for export<input type="file" accept="video/*" multiple className="hidden" onChange={(event) => void addVideos(event.target.files)} /></label><Button disabled={!clips.length || exporting} onClick={() => void exportClips()}><Archive size={16} />Export clips</Button></div></Panel>
      <div className={`grid gap-4 ${playing ? "lg:h-[min(62vh,42rem)] lg:min-h-[30rem] lg:grid-cols-[minmax(0,1fr)_22rem]" : ""}`}>
        {playing ? <Panel className="flex min-h-0 flex-col overflow-hidden">
          <div className="aspect-video bg-black xl:min-h-0 xl:flex-1 xl:aspect-auto"><video key={playing.url} ref={videoRef} src={playing.url} crossOrigin="anonymous" className="h-full w-full object-contain" playsInline onLoadedMetadata={(event) => { event.currentTarget.currentTime = playing.clip.moment.startTimeSeconds; void event.currentTarget.play(); }} onTimeUpdate={(event) => { if (event.currentTarget.currentTime >= playing.clip.moment.endTimeSeconds) event.currentTarget.pause(); }} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} /></div>
          <div className="flex items-center justify-between gap-3 p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{playing.clip.match.title}</p><p className="truncate text-xs text-slate-500">{playing.clip.moment.momentType.name} · {formatTime(playing.clip.moment.startTimeSeconds)} – {formatTime(playing.clip.moment.endTimeSeconds)}</p></div><Button size="icon" variant="primary" onClick={() => isPlaying ? videoRef.current?.pause() : void videoRef.current?.play()}>{isPlaying ? <Pause /> : <Play />}</Button></div>
        </Panel> : null}
        <Panel className={`overflow-hidden ${playing ? "lg:flex lg:min-h-0 lg:flex-col" : ""}`}>
          <div className="flex items-center justify-between border-b border-white/[.08] px-3 py-2"><Label>Clips</Label><Badge>{clips.length}</Badge></div>
          <div className={`${playing ? "lg:min-h-0 lg:flex-1 lg:overflow-y-auto" : ""} divide-y divide-white/[.06]`}>
            {clips.length ? clips.map((clip) => <button key={clip.moment.id} onClick={() => void playClip(clip)} className={`flex w-full items-center gap-3 p-3 text-left hover:bg-white/[.05] ${playing?.clip.moment.id === clip.moment.id ? "bg-leaf-400/10" : ""}`}><Play size={15} className="shrink-0 text-leaf-400" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-white">{clip.match.title}</span><span className="block truncate text-xs text-slate-500">{clip.moment.momentType.name} · {formatTime(clip.moment.startTimeSeconds)} – {formatTime(clip.moment.endTimeSeconds)}</span></span><Badge>{clip.moment.subMoments.length} sub.</Badge></button>) : <div className="p-10 text-center text-sm text-slate-500"><FileVideo className="mx-auto mb-3" />Select at least one match.</div>}
          </div>
        </Panel>
      </div></div></div>
  </div>;
}

function Metric({ label, value }: { label: string; value: string | number }) { return <Panel className="p-4"><p className="text-2xl font-bold text-white">{value}</p><p className="text-xs text-slate-500">{label}</p></Panel>; }
function safeName(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-").replace(/\s+/g, " ").trim() || "Unnamed"; }
function toCsv(rows: string[][]) { return `\uFEFF${rows.map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(",")).join("\r\n")}`; }
