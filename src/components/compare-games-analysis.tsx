"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";

import { Button, Label, Panel } from "@/components/ui";
import { compareGames, type GameComparison } from "@/lib/compare-games";
import type { MatchDetail, SettingsPayload } from "@/lib/domain";
import { apiFetch } from "@/lib/http";
import { formatTime } from "@/lib/time";
import { downloadBlob } from "@/lib/video-export";

type MapPeriod = "both" | "first_half" | "second_half";

export function CompareGamesAnalysis({
  matchIds,
  settings,
  momentTypeId,
  submomentTypeId,
  period,
}: {
  matchIds: string[];
  settings: SettingsPayload | null;
  momentTypeId: string;
  submomentTypeId: string;
  period: MapPeriod;
}) {
  const [details, setDetails] = useState<MatchDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const idsKey = matchIds.join("|");

  useEffect(() => {
    let active = true;
    const ids = idsKey ? idsKey.split("|") : [];
    setDetails([]);
    setError("");
    if (!ids.length) {
      setLoading(false);
      return () => { active = false; };
    }

    setLoading(true);
    async function load() {
      const rows: MatchDetail[] = [];
      for (let index = 0; index < ids.length; index += 4) {
        const batch = await Promise.all(ids.slice(index, index + 4).map((id) => apiFetch<MatchDetail>(`/api/matches/${id}`)));
        if (!active) return;
        rows.push(...batch);
      }
      if (active) setDetails(rows);
    }

    void load()
      .catch((caught: Error) => { if (active) setError(caught.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [idsKey, retry]);

  const filters = useMemo(() => ({ momentTypeId, submomentTypeId, period }), [momentTypeId, period, submomentTypeId]);
  const rows = useMemo(() => compareGames(details, filters), [details, filters]);
  const momentGraphs = (settings?.momentTypes || [])
    .filter((type) => !momentTypeId || type.id === momentTypeId)
    .map((type) => ({ type, rows: compareGames(details, { momentTypeId: type.id, submomentTypeId, period }) }));
  const allowedSubmomentIds = momentTypeId
    ? new Set(settings?.momentTypes.find((type) => type.id === momentTypeId)?.allowedSubmoments?.map((type) => type.id) || [])
    : null;
  const submomentGraphs = (settings?.subMomentTypes || [])
    .filter((type) => (!allowedSubmomentIds || allowedSubmomentIds.has(type.id)) && (!submomentTypeId || type.id === submomentTypeId))
    .map((type) => ({ type, rows: compareGames(details, { momentTypeId, submomentTypeId: type.id, period }) }));

  function exportCsv() {
    const records = [
      ["Match", "Date", "Moments", "Submoments", "Tagged seconds", "Positive", "Negative", "Unclassified", "Positive %"],
      ...rows.map((row) => [row.title, row.date?.slice(0, 10) || "", row.moments, row.submoments, row.duration, row.positive, row.negative, row.unclassified, row.positiveRate?.toFixed(1) ?? ""]),
    ];
    const csv = records
      .map((row) => row.map((value) => `"${String(value).replace(/^[=+@-]/, "'$&").replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    downloadBlob(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }), "compare-games.csv");
  }

  if (!matchIds.length) return <Panel className="p-6 text-slate-400">Select two different games, or choose all games, to see the evolution analysis.</Panel>;
  if (error) return <Panel className="p-4 text-red-200" role="alert">{error}<Button className="ml-3" onClick={() => setRetry((value) => value + 1)}>Retry</Button></Panel>;
  if (loading) return <p className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={18}/>Loading evolution analysis…</p>;
  if (!rows.length) return <Panel className="p-6 text-slate-400">No games match the selected filters.</Panel>;

  return <div className="space-y-5">
    <section className="space-y-3">
      <div><h2 className="font-semibold text-white">Moment evolution</h2><p className="mt-1 text-xs text-slate-500">One graph for each moment type, ordered from the oldest game to the newest.</p></div>
      <div className="grid gap-4 xl:grid-cols-2">
        {momentGraphs.map(({ type, rows: graphRows }) => <CategoryEvolutionChart key={type.id} title={type.name} color={type.color} rows={graphRows} valueKey="moments" />)}
      </div>
    </section>

    <section className="space-y-3">
      <div><h2 className="font-semibold text-white">Submoment evolution</h2><p className="mt-1 text-xs text-slate-500">One graph for each submoment type, counting every identified occurrence.</p></div>
      <div className="grid gap-4 xl:grid-cols-2">
        {submomentGraphs.map(({ type, rows: graphRows }) => <CategoryEvolutionChart key={type.id} title={type.name} color={type.color} rows={graphRows} valueKey="submoments" />)}
      </div>
    </section>

    <Panel className="overflow-hidden">
      <div className="flex items-center justify-between p-3"><div><Label>Game comparison</Label><p className="mt-1 text-xs text-slate-500">Detailed values for the filters selected above.</p></div><Button size="sm" onClick={exportCsv}><Download size={14}/>Export CSV</Button></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <thead className="bg-white/5 text-xs text-slate-400"><tr>{["Game", "Date", "Moments", "Submoments", "Duration", "Positive", "Negative", "Unclassified", "Positive %"].map((label) => <th key={label} className="whitespace-nowrap p-3">{label}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={row.id} className="border-t border-white/10"><th className="p-3 font-medium">{index + 1}. {row.title}</th><td className="whitespace-nowrap p-3">{row.date?.slice(0, 10) || "Undated"}</td>{[row.moments, row.submoments, formatTime(row.duration), row.positive, row.negative, row.unclassified, row.positiveRate === null ? "—" : `${row.positiveRate.toFixed(1)}%`].map((value, itemIndex) => <td key={itemIndex} className="p-3 tabular-nums">{value}</td>)}</tr>)}</tbody>
      </table></div>
    </Panel>

    <p className="text-xs text-slate-500">Positive % uses classified moments only; — means no classified moments. Duration sums tagged clips and may include overlaps. A submoment filter counts matching occurrences and each matching clip once.</p>
  </div>;
}

function CategoryEvolutionChart({ title, color, rows, valueKey }: { title: string; color: string; rows: GameComparison[]; valueKey: "moments" | "submoments" }) {
  const values = rows.map((row) => row[valueKey]);
  const width = Math.max(420, rows.length * 70);
  const height = 200;
  const max = Math.max(1, ...values);
  const point = (index: number, value: number) => ({ x: 48 + index * (width - 75) / Math.max(1, rows.length - 1), y: height - 32 - value / max * (height - 60) });
  const total = values.reduce((sum, value) => sum + value, 0);
  return <Panel className="overflow-hidden p-4">
    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }}/><Label>{title}</Label></div><span className="text-xs text-slate-400">{total} total</span></div>
    <div className="mt-3 overflow-x-auto"><svg role="img" aria-label={`${title} evolution`} viewBox={`0 0 ${width} ${height}`} className="h-48 w-full" style={{ minWidth: width }}>
      {[0, .25, .5, .75, 1].map((fraction) => { const y = point(0, max * fraction).y; return <g key={fraction}><line x1="43" y1={y} x2={width - 15} y2={y} stroke="#ffffff15"/><text x="38" y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="10">{(max * fraction).toFixed(max < 4 ? 1 : 0)}</text></g>; })}
      {values.map((value, index) => { const current = point(index, value); const previous = index ? point(index - 1, values[index - 1]) : null; const label = `${rows[index].title}: ${value} · ${rows[index].date?.slice(0, 10) || "Undated"}`; return <g key={rows[index].id}>{previous ? <line x1={previous.x} y1={previous.y} x2={current.x} y2={current.y} stroke={color} strokeWidth="2"/> : null}<circle tabIndex={0} aria-label={label} cx={current.x} cy={current.y} r="5" fill={color}><title>{label}</title></circle><text x={current.x} y={current.y - 9} textAnchor="middle" fill="#e2e8f0" fontSize="10">{value}</text></g>; })}
      {rows.map((row, index) => <text key={row.id} x={point(index, 0).x} y={height - 10} textAnchor="middle" fill="#94a3b8" fontSize="10">{index + 1}</text>)}
    </svg></div>
    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-white/10 pt-2">{rows.map((row, index) => <span key={row.id} className="text-[10px] text-slate-500" title={row.title}>{index + 1}. {row.title}</span>)}</div>
  </Panel>;
}
