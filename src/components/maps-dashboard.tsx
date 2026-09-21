"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRightLeft, BarChart3, ChevronsRight, FileVideo, Filter, Loader2, MapPinned, Play, RotateCcw, Target, Upload } from "lucide-react";

import { GoalSurface, PitchSurface } from "@/components/analysis-surfaces";
import { Badge, Button, Label, Panel, Select } from "@/components/ui";
import { useVideoKeyboardSeek, VideoFullscreenButton } from "@/components/video-controls";
import type { MapPoint, MatchSummary, MomentTypeRecord, SettingsPayload, SubMomentTypeRecord } from "@/lib/domain";
import { apiFetch } from "@/lib/http";
import { getRememberedMatchVideo, rememberMatchVideo } from "@/lib/local-video-store";
import { attackDirectionLabel, matchPeriodLabel, normalizeFieldX } from "@/lib/match-periods";
import { getRemoteVideoUrl } from "@/lib/remote-video-store";
import { formatTime } from "@/lib/time";

type MapPeriod = "both" | "first_half" | "second_half";
type CoordinateMode = "normalized" | "original";
type ViewMode = "map" | "compare";

export function MapsDashboard() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const videoRequestRef = useRef(0);
  const autoPlayRef = useRef(false);
  const playlistActiveRef = useRef(false);
  const advancingRef = useRef(false);
  const remoteUrlsRef = useRef(new Map<string, string>());
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [coordinateMode, setCoordinateMode] = useState<CoordinateMode>("normalized");
  const [matchId, setMatchId] = useState("unselected");
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const [momentTypeId, setMomentTypeId] = useState("");
  const [submomentTypeId, setSubmomentTypeId] = useState("");
  const [period, setPeriod] = useState<MapPeriod>("both");
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoNotice, setVideoNotice] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);

  useEffect(() => {
    Promise.all([apiFetch<MapPoint[]>("/api/maps"), apiFetch<MatchSummary[]>("/api/matches"), apiFetch<SettingsPayload>("/api/settings")])
      .then(([mapPoints, matchRows, settingsData]) => {
        setPoints(mapPoints); setMatches(matchRows); setSettings(settingsData);
        if (matchRows.length) {
          setCompareA(matchRows[0].id);
          setCompareB(matchRows[1]?.id || "");
        }
      })
      .catch((caught: Error) => setError(caught.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => () => { videoRequestRef.current += 1; if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); }, []);

  const availableSubmomentTypes = useMemo(() => {
    if (!settings) return [];
    if (!momentTypeId) return settings.subMomentTypes;
    const allowedIds = new Set(settings.momentTypes.find((type) => type.id === momentTypeId)?.allowedSubmoments?.map((type) => type.id) || []);
    return settings.subMomentTypes.filter((type) => allowedIds.has(type.id));
  }, [momentTypeId, settings]);

  function filterPoints(targetMatchId: string, includeAll = false) {
    if (!targetMatchId || targetMatchId === "unselected") return [];
    return points.filter((point) =>
      (includeAll && targetMatchId === "all" ? true : point.matchId === targetMatchId)
      && (!momentTypeId || point.momentTypeId === momentTypeId)
      && (!submomentTypeId || point.subMomentTypeId === submomentTypeId)
      && (period === "both" ? point.period !== null : point.period === period)
    );
  }

  const filtered = useMemo(() => filterPoints(matchId, true), [matchId, momentTypeId, points, period, submomentTypeId]); // eslint-disable-line react-hooks/exhaustive-deps
  const comparisonA = useMemo(() => filterPoints(compareA), [compareA, momentTypeId, points, period, submomentTypeId]); // eslint-disable-line react-hooks/exhaustive-deps
  const comparisonB = useMemo(() => filterPoints(compareB), [compareB, momentTypeId, points, period, submomentTypeId]); // eslint-disable-line react-hooks/exhaustive-deps
  const selectedPoint = filtered.find((point) => point.id === selectedPointId) || null;
  const selectedClipStart = selectedPoint?.momentStartTimeSeconds ?? 0;
  const selectedClipEnd = selectedPoint?.momentEndTimeSeconds ?? 0;
  const baseForUnassigned = matchId === "unselected" ? [] : points.filter((point) => (matchId === "all" || point.matchId === matchId) && (!momentTypeId || point.momentTypeId === momentTypeId) && (!submomentTypeId || point.subMomentTypeId === submomentTypeId));
  const unassignedCount = baseForUnassigned.filter((point) => point.period === null).length;

  const fieldPoints = toSurfacePoints(filtered, coordinateMode, selectedPointId, "field");
  const goalPoints = toSurfacePoints(filtered, coordinateMode, selectedPointId, "goal");

  useEffect(() => {
    if (!selectedPointId || filtered.some((point) => point.id === selectedPointId)) return;
    resetVideoSelection();
  }, [filtered, selectedPointId]);

  function resetVideoSelection() {
    playlistActiveRef.current = false; advancingRef.current = false; setSelectedPointId(null); videoRequestRef.current += 1; setSourceUrl(null); setVideoNotice(null);
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
  }

  function replaceVideoSource(file: File) {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = URL.createObjectURL(file); setSourceUrl(objectUrlRef.current);
  }

  async function selectPoint(id: string, fromPlaylist = false) {
    const point = points.find((item) => item.id === id);
    if (!point) return;
    autoPlayRef.current = true; playlistActiveRef.current = fromPlaylist; if (!fromPlaylist) advancingRef.current = false;
    setSelectedPointId(id); setVideoNotice(null); setVideoLoading(true); setSourceUrl(null);
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    const request = ++videoRequestRef.current;
    try {
      const match = matches.find((item) => item.id === point.matchId);
      if (match?.video?.storageStatus === "READY") {
        const cachedUrl = remoteUrlsRef.current.get(point.matchId);
        const remote = cachedUrl ? { url: cachedUrl } : await getRemoteVideoUrl(point.matchId, "maps").catch(() => null);
        if (request !== videoRequestRef.current) return;
        if (remote) { remoteUrlsRef.current.set(point.matchId, remote.url); setSourceUrl(remote.url); return; }
      }
      const file = await getRememberedMatchVideo(point.matchId);
      if (request !== videoRequestRef.current) return;
      if (file) replaceVideoSource(file);
      else { playlistActiveRef.current = false; setVideoNotice(match?.video?.storageStatus === "READY" ? "The cloud video could not be loaded. Try again." : `Upload the video for “${point.matchTitle}” from its analysis page.`); }
    } catch {
      if (request === videoRequestRef.current) { playlistActiveRef.current = false; setVideoNotice("The video could not be loaded. Try again."); }
    } finally { if (request === videoRequestRef.current) setVideoLoading(false); }
  }

  async function loadSelectedVideo(file?: File) {
    if (!file || !selectedPoint) return;
    autoPlayRef.current = true; advancingRef.current = false; replaceVideoSource(file); setVideoNotice(null);
    await rememberMatchVideo(selectedPoint.matchId, file).catch(() => setVideoNotice("The video opened, but it may need to be selected again after closing the browser."));
  }

  function changeMomentType(nextId: string) {
    stopPlaylist(); setMomentTypeId(nextId);
    if (!nextId) return;
    const allowedIds = new Set(settings?.momentTypes.find((type) => type.id === nextId)?.allowedSubmoments?.map((type) => type.id) || []);
    if (submomentTypeId && !allowedIds.has(submomentTypeId)) setSubmomentTypeId("");
  }

  function stopPlaylist() { autoPlayRef.current = false; playlistActiveRef.current = false; videoRef.current?.pause(); }
  function pointsForSubmoment(typeId: string) { return filtered.filter((point) => point.subMomentTypeId === typeId); }
  function playAll(nextPoints = filtered) { if (!nextPoints.length) return; playlistActiveRef.current = true; autoPlayRef.current = true; advancingRef.current = false; void selectPoint(nextPoints[0].id, true); }
  function selectActionAndPlay(typeId: string) { const next = filtered.filter((point) => point.subMomentTypeId === typeId); setSubmomentTypeId(typeId); if (next.length) playAll(next); else stopPlaylist(); }

  function finishSelectedClip(video: HTMLVideoElement) {
    if (!selectedPoint || advancingRef.current) return;
    const end = Math.min(video.duration, selectedClipEnd);
    if (video.currentTime < end - .04) return;
    advancingRef.current = true; video.pause(); video.currentTime = end;
    const selectedIndex = filtered.findIndex((point) => point.id === selectedPoint.id);
    if (playlistActiveRef.current && selectedIndex >= 0 && selectedIndex < filtered.length - 1) void selectPoint(filtered[selectedIndex + 1].id, true).finally(() => { advancingRef.current = false; });
    else { playlistActiveRef.current = false; advancingRef.current = false; }
  }

  function seekTo(seconds: number) {
    const video = videoRef.current;
    if (!video || !selectedPoint) return;
    const end = Math.min(video.duration || selectedClipEnd, selectedClipEnd);
    const next = Math.max(selectedClipStart, Math.min(end, seconds)); video.currentTime = next; setCurrentTime(next);
  }

  useVideoKeyboardSeek(videoRef, seekTo, Boolean(selectedPoint && sourceUrl));

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-slate-400"><Loader2 className="mr-2 animate-spin" />Building maps…</div>;
  const hasMatchSelection = matchId !== "unselected";
  const matchA = matches.find((match) => match.id === compareA);
  const matchB = matches.find((match) => match.id === compareB);

  return <div className="space-y-5">
    <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={(event) => { void loadSelectedVideo(event.target.files?.[0]); event.currentTarget.value = ""; }} />
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-leaf-400">Spatial analysis</p><h1 className="mt-2 text-3xl font-bold text-white">Occurrence maps</h1><p className="mt-2 text-sm text-slate-400">Compare matches with every attack normalized to the right, without changing the original coordinates.</p></div><div className="flex overflow-hidden rounded-lg border border-white/10"><button className={`px-4 py-2 text-xs font-semibold ${viewMode === "map" ? "bg-cyan-300 text-ink-950" : "bg-white/[.04] text-slate-300"}`} onClick={() => setViewMode("map")}><MapPinned className="mr-2 inline" size={14}/>Map</button><button className={`px-4 py-2 text-xs font-semibold ${viewMode === "compare" ? "bg-cyan-300 text-ink-950" : "bg-white/[.04] text-slate-300"}`} onClick={() => { setViewMode("compare"); setCoordinateMode("normalized"); stopPlaylist(); }}><ArrowRightLeft className="mr-2 inline" size={14}/>Compare games</button></div></div>
    {error ? <Panel className="border-red-400/20 p-4 text-red-100">{error}</Panel> : null}

    <Panel className={`grid gap-4 p-4 ${viewMode === "compare" ? "md:grid-cols-2 xl:grid-cols-6" : "grid-cols-2 xl:grid-cols-6"} xl:items-end`}>
      {viewMode === "map" ? <label className="grid gap-2"><Label>Match</Label><Select value={matchId} onChange={(event) => { stopPlaylist(); setMatchId(event.target.value); }}><option value="unselected" disabled>Select a match</option><option value="all">All matches</option>{matches.map((match) => <option key={match.id} value={match.id}>{match.title}</option>)}</Select></label> : <>
        <label className="grid gap-2"><Label>Game A</Label><Select value={compareA} onChange={(event) => setCompareA(event.target.value)}><option value="">Select…</option>{matches.map((match) => <option key={match.id} value={match.id}>{match.title}</option>)}</Select></label>
        <label className="grid gap-2"><Label>Game B</Label><Select value={compareB} onChange={(event) => setCompareB(event.target.value)}><option value="">Select…</option>{matches.filter((match) => match.id !== compareA).map((match) => <option key={match.id} value={match.id}>{match.title}</option>)}</Select></label>
      </>}
      <label className="grid gap-2"><Label>Moment</Label><Select value={momentTypeId} onChange={(event) => changeMomentType(event.target.value)}><option value="">All moments</option>{settings?.momentTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</Select></label>
      <label className="grid gap-2"><Label>Submoment</Label><Select value={submomentTypeId} onChange={(event) => { stopPlaylist(); setSubmomentTypeId(event.target.value); }}><option value="">All submoments</option>{availableSubmomentTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</Select></label>
      <label className="grid gap-2"><Label>Match period</Label><Select value={period} onChange={(event) => { stopPlaylist(); setPeriod(event.target.value as MapPeriod); }}><option value="both">Both halves</option><option value="first_half">1st half</option><option value="second_half">2nd half</option></Select></label>
      <label className="grid gap-2"><Label>Coordinates</Label><Select value={coordinateMode} onChange={(event) => setCoordinateMode(event.target.value as CoordinateMode)}><option value="normalized">Normalized · Attack →</option><option value="original">Original video position</option></Select></label>
      {viewMode === "map" ? <div className="flex gap-2"><Badge className="h-10 flex-1 justify-center px-3"><Filter size={14} className="mr-2" />{hasMatchSelection ? filtered.length : 0}</Badge><Button className="h-10" variant="primary" disabled={!filtered.length || videoLoading} onClick={() => playAll()}><Play size={15} />Play all</Button></div> : null}
    </Panel>

    {viewMode === "compare" ? <ComparisonView matchA={matchA} matchB={matchB} pointsA={comparisonA} pointsB={comparisonB} coordinateMode={coordinateMode} period={period} momentTypes={settings?.momentTypes || []} submomentTypes={availableSubmomentTypes} /> : <>
      {unassignedCount > 0 ? <p className="text-xs text-amber-200">{unassignedCount} occurrences are hidden until the match-period markers are configured.</p> : null}
      <div ref={workspaceRef} data-video-workspace className="maps-surfaces grid grid-cols-[minmax(0,1.35fr)_minmax(0,.65fr)] items-start gap-2 sm:gap-5">
        <Panel className="min-w-0 p-2 sm:p-4"><div className="flex items-center justify-between gap-2"><div className="min-w-0"><Label>Pitch</Label><p className="mt-1 truncate text-[10px] text-slate-500 sm:text-xs">{hasMatchSelection ? coordinateMode === "normalized" ? "All attacks are shown towards the right." : "Points match their original video position." : "Select a match above."}</p></div><MapPinned className="shrink-0 text-leaf-400" /></div><PitchSurface className="mt-3 sm:mt-4" points={fieldPoints} onPointSelect={(id) => void selectPoint(id)} /></Panel>
        <div className="min-w-0 space-y-2 sm:space-y-5">
          <Panel className="p-2 sm:p-4"><div className="flex items-center justify-between gap-2"><div className="min-w-0"><Label>Goal</Label><p className="mt-1 truncate text-[10px] text-slate-500 sm:text-xs">Goal coordinates keep their original goal perspective.</p></div><Target className="shrink-0 text-fire-400" /></div><GoalSurface className="mt-3 sm:mt-4" points={goalPoints} onPointSelect={(id) => void selectPoint(id)} /></Panel>
          <VideoPanel selectedPoint={selectedPoint} sourceUrl={sourceUrl} videoLoading={videoLoading} videoNotice={videoNotice} selectedClipStart={selectedClipStart} selectedClipEnd={selectedClipEnd} currentTime={currentTime} videoDuration={videoDuration} videoRef={videoRef} workspaceRef={workspaceRef} matches={matches} onUseLocal={() => fileInputRef.current?.click()} onLoaded={(video) => { const end = Math.min(video.duration, selectedClipEnd); setVideoDuration(video.duration); setCurrentTime(Math.min(selectedClipStart, end)); video.currentTime = Math.min(selectedClipStart, end); if (autoPlayRef.current) void video.play(); }} onTimeUpdate={(video) => { setCurrentTime(video.currentTime); finishSelectedClip(video); }} onSeek={seekTo} />
        </div>
      </div>
      <Panel className="p-4"><div className="flex items-center justify-between gap-3"><div><Label>Actions</Label><p className="mt-1 text-[10px] text-slate-500">Select an action to play all of its occurrences.</p></div>{submomentTypeId ? <Button size="sm" onClick={() => { stopPlaylist(); setSubmomentTypeId(""); }}>Show all</Button> : null}</div><div className="mt-3 flex flex-wrap gap-2">{availableSubmomentTypes.map((type) => { const count = pointsForSubmoment(type.id).length; const active = submomentTypeId === type.id; return <button type="button" key={type.id} disabled={!count} onClick={() => selectActionAndPlay(type.id)} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition disabled:cursor-not-allowed disabled:opacity-40 ${active ? "bg-white/[.12] text-white ring-1 ring-white/20" : "border-white/10 bg-white/[.04] text-slate-300 hover:bg-white/[.09]"}`} style={active ? { borderColor: type.color } : undefined}><span className="h-3 w-3 rounded-full" style={{ backgroundColor: type.color }} />{type.name}<strong className="text-white">{count}</strong><Play size={11} className="text-slate-500" /></button>; })}</div></Panel>
    </>}
  </div>;
}

function toSurfacePoints(points: MapPoint[], coordinateMode: CoordinateMode, selectedPointId: string | null, surface: "field" | "goal") {
  return points.flatMap((point) => {
    const x = surface === "field" ? point.fieldX : point.goalX;
    const y = surface === "field" ? point.fieldY : point.goalY;
    if (x === null || y === null) return [];
    const displayX = surface === "field" && coordinateMode === "normalized" ? normalizeFieldX(x, point.attackDirection) : x;
    return [{ id: point.id, x: displayX, y, color: point.color, active: point.id === selectedPointId, label: point.subMomentTypeName, details: [`Moment: ${point.momentTypeName}`, point.timeSeconds === null ? "Time not recorded" : `Time: ${formatTime(point.timeSeconds)}`, `Half: ${matchPeriodLabel(point.period)}`, attackDirectionLabel(point.attackDirection), `Match: ${point.matchTitle}`] }];
  });
}

function ComparisonView({ matchA, matchB, pointsA, pointsB, coordinateMode, period, momentTypes, submomentTypes }: { matchA?: MatchSummary; matchB?: MatchSummary; pointsA: MapPoint[]; pointsB: MapPoint[]; coordinateMode: CoordinateMode; period: MapPeriod; momentTypes: MomentTypeRecord[]; submomentTypes: SubMomentTypeRecord[] }) {
  if (!matchA || !matchB) return <Panel className="p-10 text-center text-sm text-slate-500"><ArrowRightLeft className="mx-auto mb-3" />Select two different games to compare them.</Panel>;
  return <div className="space-y-5">
    <div className="grid gap-5 xl:grid-cols-2"><ComparisonMap match={matchA} points={pointsA} coordinateMode={coordinateMode} /><ComparisonMap match={matchB} points={pointsB} coordinateMode={coordinateMode} /></div>
    <ComparisonChart matchA={matchA} matchB={matchB} pointsA={pointsA} pointsB={pointsB} period={period} momentTypes={momentTypes} submomentTypes={submomentTypes} />
  </div>;
}

function ComparisonMap({ match, points, coordinateMode }: { match: MatchSummary; points: MapPoint[]; coordinateMode: CoordinateMode }) {
  return <Panel className="p-4"><div className="flex items-start justify-between gap-3"><div><Label>{match.title}</Label><p className="mt-1 text-xs text-slate-500">{points.length} occurrences · {coordinateMode === "normalized" ? "Attack →" : "Original coordinates"}</p></div><Badge>{points.length}</Badge></div><PitchSurface className="mt-4" points={toSurfacePoints(points, coordinateMode, null, "field")} /><div className="mt-4 grid grid-cols-[minmax(0,1fr)_12rem] gap-3"><div className="flex flex-wrap content-start gap-2">{summarize(points).map((item) => <Badge key={item.label} className={item.tone}>{item.label}: {item.value}</Badge>)}</div><GoalSurface points={toSurfacePoints(points, coordinateMode, null, "goal")} /></div></Panel>;
}

function ComparisonChart({ matchA, matchB, pointsA, pointsB, period, momentTypes, submomentTypes }: { matchA: MatchSummary; matchB: MatchSummary; pointsA: MapPoint[]; pointsB: MapPoint[]; period: MapPeriod; momentTypes: MomentTypeRecord[]; submomentTypes: SubMomentTypeRecord[] }) {
  const momentRows = momentTypes.map((type) => ({ id: type.id, name: type.name, color: type.color, a: new Set(pointsA.filter((point) => point.momentTypeId === type.id).map((point) => point.momentId)).size, b: new Set(pointsB.filter((point) => point.momentTypeId === type.id).map((point) => point.momentId)).size })).filter((row) => row.a || row.b);
  const submomentRows = submomentTypes.map((type) => ({ id: type.id, name: type.name, color: type.color, a: pointsA.filter((point) => point.subMomentTypeId === type.id).length, b: pointsB.filter((point) => point.subMomentTypeId === type.id).length })).filter((row) => row.a || row.b);
  const minutesA = analyzedMinutes(matchA, period);
  const minutesB = analyzedMinutes(matchB, period);
  return <Panel className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4"><div><div className="flex items-center gap-2"><BarChart3 size={17} className="text-leaf-400"/><Label>Game comparison</Label></div><p className="mt-1 text-xs text-slate-500">Counts, outcomes and rate per 90 analysed minutes.</p></div><div className="flex gap-3 text-[10px]"><span className="text-cyan-300">● {matchA.title}</span><span className="text-amber-300">● {matchB.title}</span></div></div>
    <div className="grid gap-3 border-b border-white/10 p-4 sm:grid-cols-2 lg:grid-cols-4"><Stat label="Game A occurrences" value={pointsA.length} detail={rateLabel(pointsA.length, minutesA)} /><Stat label="Game B occurrences" value={pointsB.length} detail={rateLabel(pointsB.length, minutesB)} /><Stat label="Game A success" value={successRate(pointsA)} detail={outcomeDetail(pointsA)} /><Stat label="Game B success" value={successRate(pointsB)} detail={outcomeDetail(pointsB)} /></div>
    <div className="grid gap-px bg-white/[.06] lg:grid-cols-2"><ComparisonBars title="Mapped moments" rows={momentRows} /><ComparisonBars title="Submoments" rows={submomentRows} /></div>
  </Panel>;
}

function ComparisonBars({ title, rows }: { title: string; rows: { id: string; name: string; color: string; a: number; b: number }[] }) {
  const maximum = Math.max(1, ...rows.flatMap((row) => [row.a, row.b]));
  return <div className="bg-pitch-900"><div className="border-b border-white/[.06] px-3 py-2"><Label>{title}</Label></div><div className="divide-y divide-white/[.06]">{rows.length ? rows.map(({ id, name, color, a, b }) => <div key={id} className="grid items-center gap-3 p-3 sm:grid-cols-[10rem_minmax(0,1fr)_3rem_3rem]"><div className="flex items-center gap-2 text-xs text-slate-200"><span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }}/><span className="truncate">{name}</span></div><div className="grid gap-1"><div className="h-2 rounded-full bg-white/[.05]"><div className="h-full rounded-full bg-cyan-300" style={{ width: `${a / maximum * 100}%` }}/></div><div className="h-2 rounded-full bg-white/[.05]"><div className="h-full rounded-full bg-amber-300" style={{ width: `${b / maximum * 100}%` }}/></div></div><strong className="text-right text-xs text-cyan-200">{a}</strong><strong className="text-right text-xs text-amber-200">{b}</strong></div>) : <p className="p-8 text-center text-sm text-slate-500">No occurrences match these filters.</p>}</div></div>;
}

function summarize(points: MapPoint[]) { const positive = points.filter((point) => point.outcome === "positive").length; const negative = points.filter((point) => point.outcome === "negative").length; return [{ label: "Positive", value: positive, tone: "text-emerald-200" }, { label: "Negative", value: negative, tone: "text-red-200" }, { label: "Unrated", value: points.length - positive - negative, tone: "text-slate-300" }]; }
function successRate(points: MapPoint[]) { const rated = points.filter((point) => point.outcome === "positive" || point.outcome === "negative"); if (!rated.length) return "—"; return `${Math.round(rated.filter((point) => point.outcome === "positive").length / rated.length * 100)}%`; }
function outcomeDetail(points: MapPoint[]) { const summary = summarize(points); return `${summary[0].value} positive · ${summary[1].value} negative`; }
function analyzedMinutes(match: MatchSummary, period: MapPeriod) { const first = Math.max(0, (match.firstHalfEndSeconds || 0) - (match.firstHalfStartSeconds || 0)); const second = Math.max(0, (match.secondHalfEndSeconds || 0) - (match.secondHalfStartSeconds || 0)); return (period === "first_half" ? first : period === "second_half" ? second : first + second) / 60; }
function rateLabel(count: number, minutes: number) { return minutes > 0 ? `${(count / minutes * 90).toFixed(1)} per 90 min` : "Set period markers for /90"; }
function Stat({ label, value, detail }: { label: string; value: string | number; detail: string }) { return <div className="rounded-lg border border-white/10 bg-white/[.025] p-3"><p className="text-xl font-bold text-white">{value}</p><p className="text-xs text-slate-300">{label}</p><p className="mt-1 text-[10px] text-slate-500">{detail}</p></div>; }

function VideoPanel({ selectedPoint, sourceUrl, videoLoading, videoNotice, selectedClipStart, selectedClipEnd, currentTime, videoDuration, videoRef, workspaceRef, matches, onUseLocal, onLoaded, onTimeUpdate, onSeek }: { selectedPoint: MapPoint | null; sourceUrl: string | null; videoLoading: boolean; videoNotice: string | null; selectedClipStart: number; selectedClipEnd: number; currentTime: number; videoDuration: number; videoRef: React.RefObject<HTMLVideoElement | null>; workspaceRef: React.RefObject<HTMLDivElement | null>; matches: MatchSummary[]; onUseLocal: () => void; onLoaded: (video: HTMLVideoElement) => void; onTimeUpdate: (video: HTMLVideoElement) => void; onSeek: (seconds: number) => void }) {
  return <Panel className="overflow-hidden"><div className="border-b border-white/10 p-2 sm:p-3"><Label>Selected moment video</Label>{selectedPoint ? <p className="mt-1 truncate text-[10px] text-slate-500 sm:text-xs">{selectedPoint.matchTitle} · {selectedPoint.momentTypeName} / {selectedPoint.subMomentTypeName} · {formatTime(selectedClipStart)}–{formatTime(selectedClipEnd)}</p> : null}</div><div className="relative aspect-video bg-black">{sourceUrl && selectedPoint ? <video key={`${sourceUrl}-${selectedPoint.id}`} ref={videoRef} src={sourceUrl} crossOrigin="anonymous" controls playsInline className="h-full w-full object-contain" onLoadedMetadata={(event) => onLoaded(event.currentTarget)} onTimeUpdate={(event) => onTimeUpdate(event.currentTarget)} /> : <div className="flex h-full flex-col items-center justify-center p-2 text-center sm:p-5"><FileVideo className="text-leaf-400" size={28} />{videoLoading ? <p className="mt-2 text-xs text-slate-400">Loading video…</p> : selectedPoint ? <><p className="mt-2 text-[10px] text-slate-400 sm:text-xs">{videoNotice || "Upload this match video from the analysis page."}</p>{matches.find((item) => item.id === selectedPoint.matchId)?.video?.storageStatus !== "READY" ? <Button className="mt-2" size="sm" onClick={onUseLocal}><Upload size={13} />Use local file</Button> : null}</> : <p className="mt-2 text-[10px] text-slate-500 sm:text-xs">Select a point on the pitch or goal.</p>}</div>}</div>{selectedPoint && sourceUrl ? <div className="border-t border-white/10 p-2"><input aria-label="Moment position" type="range" min={selectedClipStart} max={Math.min(videoDuration || selectedClipEnd, selectedClipEnd)} step={.1} value={Math.max(selectedClipStart, Math.min(currentTime, selectedClipEnd))} onChange={(event) => onSeek(Number(event.target.value))} className="h-1.5 w-full cursor-pointer accent-cyan-300"/><div className="mt-1 flex items-center justify-end gap-1"><span className="mr-auto font-mono text-[10px] text-slate-400">{formatTime(currentTime)} / {formatTime(selectedClipEnd)}</span><Button size="icon" className="h-7 w-7" title="Back 5 seconds (left arrow)" onClick={() => onSeek(currentTime - 5)}><RotateCcw size={13}/></Button><Button size="icon" className="h-7 w-7" title="Forward 5 seconds (right arrow)" onClick={() => onSeek(currentTime + 5)}><ChevronsRight size={13}/></Button><VideoFullscreenButton targetRef={workspaceRef}/></div></div> : null}</Panel>;
}
