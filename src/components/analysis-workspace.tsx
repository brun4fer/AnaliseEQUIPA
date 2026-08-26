"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Archive, ArrowLeft, Check, ChevronLeft, ChevronRight, Clock3, Cloud, FileVideo, Loader2, Pause, Pencil, Play, Settings2, Tags, Trash2, Upload, X } from "lucide-react";

import { CloudVideoLibrary } from "@/components/cloud-video-library";
import { MatchEditDialog } from "@/components/match-edit-dialog";
import { MomentEditDialog } from "@/components/moment-edit-dialog";
import { Badge, Button, Label, Panel } from "@/components/ui";
import type { MatchDetail, MomentRecord, MomentTypeRecord, SettingsPayload } from "@/lib/domain";
import { isExportPickerCancellation, pickExportDirectory, writeBlobToDirectory } from "@/lib/export-directory";
import { apiFetch } from "@/lib/http";
import { getRememberedMatchVideo, rememberMatchVideo } from "@/lib/local-video-store";
import { getMatchPeriodAtTime } from "@/lib/match-periods";
import { attachCloudVideo, getCloudVideoLibrary, getRemoteVideoUrl, uploadMatchVideo, type CloudVideoAsset } from "@/lib/remote-video-store";
import { SmartVideoExportSession } from "@/lib/smart-video-export";
import { formatBytes, formatTime, roundTime } from "@/lib/time";
import { downloadBlob } from "@/lib/video-export";

type ActiveMoment = { id: string; momentTypeId: string; startTimeSeconds: number };
type PeriodMarkerKey = "firstHalfStartSeconds" | "firstHalfEndSeconds" | "secondHalfStartSeconds" | "secondHalfEndSeconds";

const periodMarkers: Array<[PeriodMarkerKey, string]> = [
  ["firstHalfStartSeconds", "Start 1st half"],
  ["firstHalfEndSeconds", "End 1st half"],
  ["secondHalfStartSeconds", "Start 2nd half"],
  ["secondHalfEndSeconds", "End 2nd half"]
];

const periodStyles = [
  { short: "1H Start", color: "#22d3ee" },
  { short: "1H End", color: "#60a5fa" },
  { short: "2H Start", color: "#34d399" },
  { short: "2H End", color: "#a78bfa" }
];

export function AnalysisWorkspace({ matchId }: { matchId: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sourceFileRef = useRef<File | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
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
  const [activeMoments, setActiveMoments] = useState<ActiveMoment[]>([]);
  const [selectedMomentId, setSelectedMomentId] = useState<string | null>(null);
  const [editingMoment, setEditingMoment] = useState<MomentRecord | null>(null);
  const [editingMatch, setEditingMatch] = useState(false);
  const [previewEnd, setPreviewEnd] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showCloudLibrary, setShowCloudLibrary] = useState(false);
  const [cloudAssets, setCloudAssets] = useState<CloudVideoAsset[]>([]);
  const [loadingCloudLibrary, setLoadingCloudLibrary] = useState(false);
  const [cloudLibraryError, setCloudLibraryError] = useState<string | null>(null);
  const [attachingAssetId, setAttachingAssetId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([apiFetch<MatchDetail>(`/api/matches/${matchId}`), apiFetch<SettingsPayload>("/api/settings")])
      .then(async ([matchData, settingsData]) => {
        if (!active) return;
        setMatch(matchData);
        setSettings(settingsData);
        setSelectedMomentId(matchData.moments[0]?.id || null);
        if (matchData.video?.storageStatus === "READY") {
          const remote = await getRemoteVideoUrl(matchId).catch(() => null);
          if (active && remote) {
            setSourceUrl(remote.url);
            setDuration(matchData.video!.durationSeconds);
            return;
          }
        }
        const file = await getRememberedMatchVideo(matchId).catch(() => null);
        if (active && file) {
          sourceFileRef.current = file;
          setSourceUrl(URL.createObjectURL(file));
        }
      })
      .catch((error: Error) => setNotice(error.message))
      .finally(() => {
        if (active) {
          setLoading(false);
          setRestoringVideo(false);
        }
      });
    return () => { active = false; };
  }, [matchId]);

  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);

  async function loadVideo(file?: File) {
    if (!file) return;
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    sourceFileRef.current = file;
    const url = URL.createObjectURL(file);
    setSourceUrl(url);
    await rememberMatchVideo(matchId, file).catch(() => undefined);
    setUploading(true);
    setUploadProgress(0);
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    try {
      const result = await uploadMatchVideo(matchId, file, ({ progress, detail }) => {
        setUploadProgress(progress);
        setNotice(`${detail} ${Math.round(progress * 100)}%`);
      }, controller.signal);
      setDuration(result.durationSeconds);
      const [remote, savedMatch] = await Promise.all([
        getRemoteVideoUrl(matchId),
        apiFetch<MatchDetail>(`/api/matches/${matchId}`),
      ]);
      setSourceUrl(remote.url);
      setMatch(savedMatch);
      setNotice(result.resumed ? "Video upload resumed and completed successfully." : "Video stored securely in Cloudflare R2.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The video could not be uploaded.");
    } finally {
      if (uploadAbortRef.current === controller) uploadAbortRef.current = null;
      setUploading(false);
    }
  }

  function cancelUpload() {
    uploadAbortRef.current?.abort();
  }

  async function openCloudLibrary() {
    setShowCloudLibrary(true);
    setLoadingCloudLibrary(true);
    setCloudLibraryError(null);
    try {
      const result = await getCloudVideoLibrary();
      setCloudAssets(result.assets);
    } catch (error) {
      setCloudLibraryError(error instanceof Error ? error.message : "Could not load the cloud library.");
    } finally {
      setLoadingCloudLibrary(false);
    }
  }

  async function attachSelectedCloudVideo(asset: CloudVideoAsset) {
    setAttachingAssetId(asset.id);
    setCloudLibraryError(null);
    try {
      await attachCloudVideo(matchId, asset.id);
      const [remote, savedMatch] = await Promise.all([
        getRemoteVideoUrl(matchId),
        apiFetch<MatchDetail>(`/api/matches/${matchId}`),
      ]);
      sourceFileRef.current = null;
      setSourceUrl(remote.url);
      setDuration(asset.durationSeconds);
      setMatch(savedMatch);
      setShowCloudLibrary(false);
      setNotice(`Using ${asset.fileName} from the shared cloud library.`);
    } catch (error) {
      setCloudLibraryError(error instanceof Error ? error.message : "Could not attach the selected cloud video.");
    } finally {
      setAttachingAssetId(null);
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

  async function removeLastMoment(moment: MomentRecord | null) {
    if (!moment) return;
    try {
      await apiFetch(`/api/moments/${moment.id}`, { method: "DELETE" });
      setMatch((current) => {
        if (!current) return current;
        const moments = current.moments.filter((item) => item.id !== moment.id);
        setSelectedMomentId((selected) => selected === moment.id ? moments[0]?.id || null : selected);
        return { ...current, moments, momentCount: Math.max(0, current.momentCount - 1) };
      });
      setNotice(`Last recorded moment removed: ${moment.momentType.name} at ${formatTime(moment.startTimeSeconds)}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not remove the last recorded moment.");
    }
  }

  async function setPeriodMarker(key: PeriodMarkerKey) {
    try {
      const saved = await apiFetch<MatchDetail>(`/api/matches/${matchId}`, { method: "PATCH", body: JSON.stringify({ [key]: roundTime(currentTime) }) });
      setMatch(saved);
      setNotice(`Match period saved at ${formatTime(currentTime)}.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not save the match period."); }
  }

  async function saveMatch(input: Record<string, unknown>) {
    const saved = await apiFetch<MatchDetail>(`/api/matches/${matchId}`, { method: "PATCH", body: JSON.stringify(input) });
    setMatch(saved);
    setEditingMatch(false);
    setNotice("Match updated.");
  }

  async function removeCurrentMatch() {
    await apiFetch(`/api/matches/${matchId}`, { method: "DELETE" });
    router.replace("/");
    router.refresh();
  }

  async function exportAllMoments() {
    if (!match || match.moments.length === 0 || exporting) return;

    const localFile = sourceFileRef.current || await getRememberedMatchVideo(match.id).catch(() => null);
    const remote = !localFile && match.video?.storageStatus === "READY"
      ? await getRemoteVideoUrl(match.id).catch(() => null)
      : null;
    const exportSource: File | string | null = localFile || remote?.url || null;
    if (!exportSource) {
      setNotice("The cloud video is not available. Select the local match video to continue.");
      fileInputRef.current?.click();
      return;
    }

    let directory = null;
    try {
      directory = await pickExportDirectory();
    } catch (error) {
      if (isExportPickerCancellation(error)) return;
      setNotice(error instanceof Error ? error.message : "Could not open the export folder.");
      return;
    }

    setExporting(true);
    setNotice(null);
    setExportStatus("Preparing export…");

    const moments = [...match.moments].sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
    const root = `${safeExportName(match.title)}-${moments.length}-clips`;
    const archive = directory ? null : new (await import("jszip")).default();
    const indexRows = [["moment", "start", "end", "submoments", "files"]];
    const exportUrl = typeof exportSource === "string" ? exportSource : sourceUrl || URL.createObjectURL(exportSource);
    const ownsExportUrl = typeof exportSource !== "string" && !sourceUrl;
    const session = new SmartVideoExportSession(exportSource);

    try {
      for (const [index, moment] of moments.entries()) {
        const current = index + 1;
        setExportStatus(`Exporting ${current} of ${moments.length}: ${moment.momentType.name}`);
        const result = await session.exportMoment({
          match,
          moment,
          quality: "high",
          sourceUrlFallback: exportUrl,
          onStatus: (message) => setExportStatus(`${current} of ${moments.length}: ${message}`)
        });
        const folders = [...new Set(moment.subMoments.map((item) => item.subMomentType.name))];
        if (folders.length === 0) folders.push("No submoment");
        const fileName = `${String(current).padStart(3, "0")}-${result.fileName}`;
        const paths = folders.map((folder) => `${safeExportName(moment.momentType.name)}/${safeExportName(folder)}/${fileName}`);

        for (const path of paths) {
          if (directory) await writeBlobToDirectory(directory, `${root}/${path}`, result.blob);
          else archive?.file(`${root}/${path}`, result.blob);
        }

        indexRows.push([
          moment.momentType.name,
          formatTime(moment.startTimeSeconds),
          formatTime(moment.endTimeSeconds),
          folders.join(" | "),
          paths.join(" | ")
        ]);
      }

      const csv = new Blob([toCsv(indexRows)], { type: "text/csv;charset=utf-8" });
      if (directory) {
        await writeBlobToDirectory(directory, `${root}/index.csv`, csv);
      } else {
        archive?.file(`${root}/index.csv`, csv);
        setExportStatus("Creating the ZIP file…");
        const blob = await archive!.generateAsync(
          { type: "blob", compression: "STORE", streamFiles: true },
          (metadata) => setExportStatus(`Creating the ZIP file: ${Math.round(metadata.percent)}%`)
        );
        downloadBlob(blob, `${root}.zip`);
      }

      setNotice(`${moments.length} moments exported successfully${directory ? ` to ${root}` : " in a ZIP file"}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not export all moments.");
    } finally {
      session.dispose();
      if (ownsExportUrl) URL.revokeObjectURL(exportUrl);
      setExporting(false);
      setExportStatus("");
    }
  }

  if (loading) return <div className="flex min-h-[65vh] items-center justify-center text-slate-400"><Loader2 className="mr-2 animate-spin" />Preparing analysis…</div>;
  if (!match || !settings) return <Panel className="border-red-400/20 p-5 text-red-100">{notice || "Could not open this match."}</Panel>;

  const timelineDuration = duration || match.video?.durationSeconds || Math.max(1, ...match.moments.map((moment) => moment.endTimeSeconds));
  const currentPeriod = getMatchPeriodAtTime(match, currentTime);
  const lastMoment = match.moments.reduce<MomentRecord | null>((latest, moment) => !latest || Date.parse(moment.createdAt) > Date.parse(latest.createdAt) ? moment : latest, null);

  return <div className="mx-auto flex w-full max-w-[1600px] min-h-0 flex-col gap-2">
    <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={(event) => { void loadVideo(event.target.files?.[0]); event.currentTarget.value = ""; }} />

    <Panel className="flex shrink-0 items-stretch overflow-hidden">
      <div className="flex w-44 shrink-0 flex-col justify-center border-r border-white/10 px-2 py-1.5">
        <div className="flex items-center justify-between gap-1"><Link href="/" className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[10px] font-semibold text-slate-400 hover:bg-white/[.06] hover:text-white"><ArrowLeft size={11} />Matches</Link><button type="button" title="Edit match" aria-label="Edit match" onClick={() => setEditingMatch(true)} className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-white/[.06] hover:text-white"><Settings2 size={12} /></button></div>
        <p className="truncate px-1.5 text-[10px] font-semibold text-white">{match.title}</p>
        <p className="truncate px-1.5 text-[8px] text-slate-600">{match.competition || "No competition"}</p>
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-2 py-1.5" aria-label="Main moments in configured order">
        {settings.momentTypes.filter((type) => type.active).map((type) => { const active = activeMoments.some((item) => item.momentTypeId === type.id); return <button key={type.id} type="button" onClick={() => toggleMoment(type)} title={`${type.name}${type.defaultShortcut ? ` · ${type.defaultShortcut.toUpperCase()}` : ""}`} className={`flex h-12 min-w-[6.5rem] shrink-0 items-center justify-between gap-2 rounded-md border px-2 text-left transition ${active ? "text-white shadow-[0_0_16px_rgba(34,211,238,.18)]" : "border-white/10 bg-white/[.035] hover:bg-white/[.08]"}`} style={active ? { backgroundColor: `${type.color}30`, borderColor: type.color } : undefined}><span className="min-w-0"><span className="block truncate text-[10px] font-bold" style={{ color: type.color }}>{type.name}</span><span className={`mt-0.5 block text-[8px] ${active ? "text-white" : "text-slate-600"}`}>{active ? "In progress" : "Click to start"}</span></span><kbd className="rounded border border-white/10 bg-black/25 px-1.5 py-0.5 text-[9px] text-slate-300">{type.defaultShortcut || "—"}</kbd></button>; })}
      </div>
      <div className="flex shrink-0 items-center gap-1.5 border-l border-white/10 px-2">{uploading ? <Button size="sm" variant="danger" className="h-8 whitespace-nowrap" onClick={cancelUpload}><X size={13} />Cancel {Math.round(uploadProgress * 100)}%</Button> : <><Button size="sm" className="h-8 whitespace-nowrap" onClick={() => fileInputRef.current?.click()}><Upload size={13} />Upload new</Button><Button size="sm" className="h-8 whitespace-nowrap" disabled={uploading} onClick={() => void openCloudLibrary()}><Cloud size={13} />Cloud library</Button></>}</div>
    </Panel>
    {notice ? <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-3 rounded-xl border border-leaf-400/25 bg-pitch-950/95 px-4 py-3 text-sm text-emerald-100 shadow-2xl backdrop-blur-xl"><span className="min-w-0 flex-1">{notice}</span><button type="button" aria-label="Dismiss message" onClick={() => setNotice(null)} className="shrink-0 text-emerald-200/70 transition hover:text-white"><X size={15} /></button></div> : null}
    {exporting ? <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-50 flex max-w-sm items-center gap-3 rounded-xl border border-leaf-400/25 bg-pitch-950/95 px-4 py-3 text-sm text-emerald-100 shadow-2xl backdrop-blur-xl"><Loader2 size={16} className="shrink-0 animate-spin" /><span className="min-w-0 flex-1">{exportStatus}</span></div> : null}

    <div className="analysis-layout grid min-h-0 flex-1 items-stretch gap-2 min-[900px]:grid-cols-[minmax(0,1fr)_18rem]">
      <Panel className="flex min-h-0 min-w-0 flex-col overflow-hidden">
        <div className="relative aspect-video min-h-72 shrink-0 bg-black">{sourceUrl ? <video ref={videoRef} src={sourceUrl} crossOrigin="anonymous" className="h-full w-full object-contain" playsInline onLoadedMetadata={(event) => { setDuration(event.currentTarget.duration); event.currentTarget.playbackRate = playbackRate; }} onTimeUpdate={(event) => { const video = event.currentTarget; setCurrentTime(video.currentTime); if (previewEnd !== null && video.currentTime >= previewEnd - .04) { video.pause(); video.currentTime = previewEnd; setPreviewEnd(null); } }} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} /> : <button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-full min-h-72 w-full flex-col items-center justify-center p-6 text-center"><FileVideo size={38} className="text-leaf-400" /><h2 className="mt-3 text-sm font-bold text-white">{restoringVideo ? "Loading the match video…" : match.video?.storageStatus === "LOCAL" ? "Upload the existing match video" : "Upload the match video"}</h2><p className="mt-1 max-w-md text-xs text-slate-500">The video will be stored privately in Cloudflare R2 and available on every authorized device.</p>{match.video ? <p className="mt-3 max-w-md truncate rounded-md border border-white/10 bg-white/[.04] px-3 py-2 text-[10px] text-slate-400">Expected: {match.video.fileName} · {formatBytes(match.video.fileSize)} · {formatTime(match.video.durationSeconds)}</p> : null}</button>}{uploading ? <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10"><div className="h-full bg-cyan-300 transition-[width]" style={{ width: `${Math.round(uploadProgress * 100)}%` }} /></div> : null}</div>
        <div className="shrink-0 border-t border-white/10 p-2">
          <input aria-label="Video position" type="range" min={0} max={duration || 0} step={.1} value={Math.min(currentTime, duration || 0)} disabled={!sourceUrl} onChange={(event) => seekTo(Number(event.target.value))} className="w-full accent-cyan-300" />
          <div className="mt-1.5 flex items-center justify-between gap-2 overflow-x-auto">
            <div className="flex min-w-max items-center gap-1">
              <Button size="icon" className="h-8 w-8" disabled={!sourceUrl} title="Back 5 seconds" onClick={() => seekBy(-5)}><ChevronLeft size={15} /></Button>
              <Button size="icon" className="h-8 w-8" variant="primary" disabled={!sourceUrl || saving} onClick={togglePlayback}>{playing ? <Pause size={15} /> : <Play size={15} />}</Button>
              <Button size="icon" className="h-8 w-8" disabled={!sourceUrl} title="Forward 5 seconds" onClick={() => seekBy(5)}><ChevronRight size={15} /></Button>
              <div className="flex overflow-hidden rounded-md border border-white/10">{[.5, 1, 2, 4].map((rate) => <button key={rate} type="button" onClick={() => setRate(rate)} className={`h-8 px-2 text-[10px] font-semibold transition ${playbackRate === rate ? "bg-leaf-400 text-ink-950" : "bg-white/[.04] text-slate-300 hover:bg-white/[.1]"}`}>{rate}×</button>)}</div>
              <Button size="icon" variant="danger" className="h-8 w-8" disabled={!lastMoment} title={lastMoment ? `Delete last recorded moment: ${lastMoment.momentType.name} at ${formatTime(lastMoment.startTimeSeconds)}` : "No recorded moment to delete"} aria-label="Delete last recorded moment" onClick={() => void removeLastMoment(lastMoment)}><Trash2 size={14} /></Button>
              <div className="ml-1 flex items-center gap-1 border-l border-white/10 pl-2" aria-label="Match period markers">
                {periodMarkers.map(([key, label], index) => { const seconds = match[key]; const style = periodStyles[index]; const period = index < 2 ? "first_half" : "second_half"; return <div key={key} className="flex overflow-hidden rounded-md border" style={{ borderColor: `${style.color}${currentPeriod === period ? "cc" : "55"}` }}><button type="button" disabled={!sourceUrl} title={seconds === null ? `${label}: save the current video time` : `${label}: go to ${formatTime(seconds)}`} onClick={() => seconds === null ? void setPeriodMarker(key) : seekTo(seconds)} className="flex h-8 min-w-[3.6rem] flex-col items-center justify-center px-1.5 leading-none disabled:opacity-40" style={{ backgroundColor: `${style.color}${currentPeriod === period ? "20" : "0c"}` }}><span className="text-[7px] font-bold uppercase tracking-wide" style={{ color: style.color }}>{style.short}</span><span className="mt-0.5 font-mono text-[8px] text-slate-300">{seconds === null ? "Set" : formatTime(seconds)}</span></button>{seconds !== null ? <button type="button" disabled={!sourceUrl} aria-label={`Replace ${label} with the current video time`} title={`Replace ${label} with the current video time`} onClick={() => void setPeriodMarker(key)} className="flex h-8 w-5 items-center justify-center border-l text-slate-500 hover:text-white" style={{ borderColor: `${style.color}45` }}><Clock3 size={9} /></button> : null}</div>; })}
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 font-mono text-xs text-white"><Clock3 size={13} className="text-leaf-400" />{formatTime(currentTime)} / {formatTime(duration)}</span>
          </div>
        </div>
      </Panel>

      <Panel className="flex min-h-0 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-white/10 p-2"><div className="flex items-center justify-between gap-2"><div className="min-w-0"><Label>Tagged moments</Label><p className="text-[10px] text-slate-500">{match.moments.length} in the video</p></div><Button size="sm" className="h-7 shrink-0 text-[10px]" disabled={match.moments.length === 0 || exporting} title={exporting ? exportStatus : "Export all tagged moments"} onClick={() => void exportAllMoments()}>{exporting ? <Loader2 size={12} className="animate-spin" /> : <Archive size={12} />}Export all</Button></div></div>
        <div className="min-h-0 flex-1 overflow-y-auto">{match.moments.length === 0 ? <p className="p-4 text-center text-xs text-slate-500">No moments recorded yet.</p> : match.moments.map((moment, index) => <div key={moment.id} className={`border-b border-white/[.06] p-2 ${selectedMomentId === moment.id ? "bg-leaf-400/10" : ""}`}><button className="flex w-full items-center gap-2 text-left" onClick={() => reviewMoment(moment)}><span className="w-4 shrink-0 text-right font-mono text-[8px] text-slate-600">{index + 1}</span><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: moment.momentType.color }} /><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-semibold text-white">{moment.momentType.name}</span><span className="block font-mono text-[9px] text-slate-500">{formatTime(moment.startTimeSeconds)}–{formatTime(moment.endTimeSeconds)}</span></span><Badge className="px-1.5 py-0.5 text-[8px]">{moment.subMoments.length} sub.</Badge></button><div className="mt-1.5 flex items-center gap-1 pl-6"><button aria-label="Mark as positive" onClick={() => void toggleOutcome(moment, "positive")} className={`flex h-6 w-6 items-center justify-center rounded border transition ${moment.outcome === "positive" ? "border-emerald-300 bg-emerald-400 text-emerald-950" : "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"}`}><Check size={11} /></button><button aria-label="Mark as negative" onClick={() => void toggleOutcome(moment, "negative")} className={`flex h-6 w-6 items-center justify-center rounded border transition ${moment.outcome === "negative" ? "border-red-300 bg-red-400 text-red-950" : "border-red-400/25 bg-red-400/10 text-red-300"}`}><X size={11} /></button><button aria-label="Edit moment" title="Edit moment" onClick={() => setEditingMoment(moment)} className="ml-auto p-1 text-slate-600 hover:text-white"><Pencil size={11} /></button><button aria-label="Delete moment" title="Delete moment" onClick={() => void removeMoment(moment)} className="p-1 text-slate-600 hover:text-red-300"><Trash2 size={11} /></button></div></div>)}</div>
      </Panel>

    </div>

    <Panel className="flex shrink-0 items-center justify-between gap-3 px-3 py-2"><div className="min-w-0"><span className="inline-flex items-center gap-2"><Label>Identification</Label><strong className="text-xs text-white">Submoments</strong></span><p className="truncate text-[10px] text-slate-500">Classify every tagged moment and mark its pitch or goal location.</p></div><Button size="sm" variant="primary" className="h-8 shrink-0" disabled={match.moments.length === 0 || activeMoments.length > 0} onClick={() => router.push(`/analysis/${matchId}/submoments`)}><Tags size={14} />Identify submoments</Button></Panel>

    <Timeline momentTypes={settings.momentTypes} moments={match.moments} duration={timelineDuration} selectedMomentId={selectedMomentId} onSelect={reviewMoment} />

    {editingMoment ? <MomentEditDialog moment={editingMoment} momentTypes={settings.momentTypes} currentTime={currentTime} duration={duration || match.video?.durationSeconds || 0} onSave={(input) => updateMoment(editingMoment, input)} onClose={() => setEditingMoment(null)} /> : null}
    {editingMatch ? <MatchEditDialog match={match} onSave={saveMatch} onDelete={removeCurrentMatch} onClose={() => setEditingMatch(false)} /> : null}
    {showCloudLibrary ? <CloudVideoLibrary assets={cloudAssets} loading={loadingCloudLibrary} error={cloudLibraryError} attachingAssetId={attachingAssetId} onRetry={() => void openCloudLibrary()} onClose={() => !attachingAssetId && setShowCloudLibrary(false)} onSelect={(asset) => void attachSelectedCloudVideo(asset)} /> : null}
  </div>;
}

function Timeline({ momentTypes, moments, duration, selectedMomentId, onSelect }: { momentTypes: MomentTypeRecord[]; moments: MomentRecord[]; duration: number; selectedMomentId: string | null; onSelect: (moment: MomentRecord) => void }) {
  const visibleTypes = useMemo(() => momentTypes.filter((type) => type.active || moments.some((moment) => moment.momentTypeId === type.id)), [momentTypes, moments]);
  return <Panel className="flex shrink-0 flex-col overflow-hidden min-[1100px]:h-24"><div className="flex shrink-0 items-center justify-between border-b border-white/10 px-2 py-1.5"><Label>Timeline</Label><span className="text-[9px] text-slate-500">Moments in the video</span></div><div className="min-h-0 flex-1 overflow-auto"><div className="min-w-[720px] overflow-hidden">{visibleTypes.map((type) => <div key={type.id} className="grid grid-cols-[8rem_minmax(0,1fr)] border-b border-white/[.07] last:border-b-0"><div className="flex items-center gap-2 border-r border-white/[.07] px-2 py-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: type.color }} /><span className="truncate text-[9px] text-slate-300">{type.name}</span></div><div className="relative min-h-6 bg-black/10">{moments.filter((moment) => moment.momentTypeId === type.id).map((moment) => { const left = Math.max(0, Math.min(100, (moment.startTimeSeconds / duration) * 100)); const width = Math.max(.6, Math.min(100 - left, ((moment.endTimeSeconds - moment.startTimeSeconds) / duration) * 100)); return <button key={moment.id} type="button" title={`${type.name}: ${formatTime(moment.startTimeSeconds)} – ${formatTime(moment.endTimeSeconds)}`} onClick={() => onSelect(moment)} className={`absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full border border-white/20 transition hover:h-4 ${selectedMomentId === moment.id ? "h-4 ring-1 ring-white/50" : ""}`} style={{ left: `${left}%`, width: `${width}%`, backgroundColor: type.color }} />; })}</div></div>)}</div></div></Panel>;
}

function safeExportName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-").replace(/\s+/g, " ").trim() || "Unnamed";
}

function toCsv(rows: string[][]) {
  return `\uFEFF${rows.map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(",")).join("\r\n")}`;
}
