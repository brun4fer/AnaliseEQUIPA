"use client";

import { cn } from "@/lib/cn";

export type SurfacePoint = { id: string; x: number; y: number; color: string; label?: string; active?: boolean };
export type Coordinate = { x: number; y: number };

function clickCoordinate(event: React.MouseEvent<HTMLElement>): Coordinate {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: Math.round(((event.clientX - rect.left) / rect.width) * 1000) / 10,
    y: Math.round(((event.clientY - rect.top) / rect.height) * 1000) / 10
  };
}

function Markers({ points }: { points: SurfacePoint[] }) {
  return points.map((point) => <span key={point.id} title={point.label} className={cn("pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_2px_10px_rgba(0,0,0,.7)]", point.active && "h-5 w-5 ring-4 ring-white/25")} style={{ left: `${point.x}%`, top: `${point.y}%`, backgroundColor: point.color }} />);
}

export function PitchSurface({ points = [], value, color = "#2dd66f", direction = "left_to_right", onChange, className }: { points?: SurfacePoint[]; value?: Coordinate | null; color?: string; direction?: string; onChange?: (point: Coordinate) => void; className?: string }) {
  const selected = value ? [{ id: "selected", ...value, color, active: true }] : [];
  return <button type="button" disabled={!onChange} onClick={(event) => onChange?.(clickCoordinate(event))} className={cn("relative block aspect-[1.55/1] w-full overflow-hidden rounded-xl border-2 border-white/25 bg-[#167641] text-left shadow-inner disabled:cursor-default", className)}>
    <svg viewBox="0 0 105 68" className={cn("absolute inset-0 h-full w-full transition", direction === "right_to_left" && "-scale-x-100")} aria-hidden="true">
      <rect x="1" y="1" width="103" height="66" fill="none" stroke="rgba(255,255,255,.82)" strokeWidth=".7" />
      <line x1="52.5" y1="1" x2="52.5" y2="67" stroke="rgba(255,255,255,.82)" strokeWidth=".7" />
      <circle cx="52.5" cy="34" r="9.15" fill="none" stroke="rgba(255,255,255,.82)" strokeWidth=".7" />
      <circle cx="52.5" cy="34" r=".8" fill="white" />
      <rect x="1" y="13.84" width="16.5" height="40.32" fill="none" stroke="rgba(255,255,255,.82)" strokeWidth=".7" />
      <rect x="87.5" y="13.84" width="16.5" height="40.32" fill="none" stroke="rgba(255,255,255,.82)" strokeWidth=".7" />
      <rect x="1" y="24.84" width="5.5" height="18.32" fill="none" stroke="rgba(255,255,255,.82)" strokeWidth=".7" />
      <rect x="98.5" y="24.84" width="5.5" height="18.32" fill="none" stroke="rgba(255,255,255,.82)" strokeWidth=".7" />
      <circle cx="11" cy="34" r=".7" fill="white" /><circle cx="94" cy="34" r=".7" fill="white" />
      <path d="M17.5 27a9.15 9.15 0 0 1 0 14" fill="none" stroke="rgba(255,255,255,.82)" strokeWidth=".7" />
      <path d="M87.5 27a9.15 9.15 0 0 0 0 14" fill="none" stroke="rgba(255,255,255,.82)" strokeWidth=".7" />
      {[26.25, 78.75].map((x) => <line key={x} x1={x} y1="1" x2={x} y2="67" stroke="rgba(255,255,255,.18)" strokeWidth=".35" strokeDasharray="1.5 1.5" />)}
      {[22.67, 45.33].map((y) => <line key={y} x1="1" y1={y} x2="104" y2={y} stroke="rgba(255,255,255,.18)" strokeWidth=".35" strokeDasharray="1.5 1.5" />)}
    </svg>
    <Markers points={[...points, ...selected]} />
    <span className="absolute right-3 top-2 rounded bg-black/35 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Attack →</span>
  </button>;
}

export function GoalSurface({ points = [], value, color = "#facc15", onChange, className }: { points?: SurfacePoint[]; value?: Coordinate | null; color?: string; onChange?: (point: Coordinate) => void; className?: string }) {
  const selected = value ? [{ id: "selected-goal", ...value, color, active: true }] : [];
  return <button type="button" disabled={!onChange} onClick={(event) => onChange?.(clickCoordinate(event))} className={cn("relative block aspect-[2/1] w-full overflow-hidden rounded-xl border border-white/20 bg-gradient-to-b from-slate-800 to-slate-950 disabled:cursor-default", className)}>
    <svg viewBox="0 0 100 50" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <path d="M10 44V8h80v36" fill="none" stroke="rgba(255,255,255,.9)" strokeWidth="2" />
      {Array.from({ length: 9 }, (_, index) => <line key={`v-${index}`} x1={10 + index * 10} y1="8" x2={10 + index * 10} y2="44" stroke="rgba(255,255,255,.18)" strokeWidth=".5" />)}
      {Array.from({ length: 5 }, (_, index) => <line key={`h-${index}`} x1="10" y1={8 + index * 9} x2="90" y2={8 + index * 9} stroke="rgba(255,255,255,.18)" strokeWidth=".5" />)}
      <line x1="50" y1="8" x2="50" y2="44" stroke="rgba(255,255,255,.4)" strokeDasharray="2 2" />
    </svg>
    <Markers points={[...points, ...selected]} />
  </button>;
}
