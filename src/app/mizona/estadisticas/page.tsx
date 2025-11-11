// src/app/mizona/estadisticas/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import CalendarLite from '@/components/mizona/CalendarLite';
import Image from 'next/image';
import { useTodayActivity } from '@/lib/activity/useTodayActivity';
import { loadActive, type LocalProgram } from '@/lib/programsLocal';

/* === Puntuación (RPC) === */
import {
  fetchProgramPoints,
  type ProgramPointsTotals,
} from '@/lib/programService';

// ==== Helpers (idénticos a Resumen) ====
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function dayIdxSince(startedAt: number, when: Date) {
  const a = startOfDay(new Date(startedAt)).getTime();
  const b = startOfDay(when).getTime();
  return Math.floor((b - a) / 86_400_000) + 1;
}
function tryGetProgramJson(slug: string): any | null {
  try {
    // @ts-ignore
    const m = require(`@/data/programs/${slug}.json`);
    return m?.default ?? m ?? null;
  } catch { return null; }
}

// === Mismo dayStatus que en Resumen ===
function getDayStatus(date: Date): 'none'|'some'|'all'|'missed' {
  const map = loadActive();
  let planned = 0, done = 0;
  for (const [slug, prog] of Object.entries(map)) {
    const lp = prog as LocalProgram & { progress?: Record<number, Record<string, boolean>>; startedAt?: number };
    if (!lp?.startedAt) continue;
    const json = tryGetProgramJson(slug);
    const totalDays: number = json?.days?.length ?? json?.durationDays ?? 0;
    if (!totalDays) continue;
    const dNum = dayIdxSince(lp.startedAt!, date);
    if (dNum < 1 || dNum > totalDays) continue;

    const dayDef = json?.days?.find((x: any) => x.day === dNum) ?? json?.days?.[dNum - 1];
    planned += Math.max(0, dayDef?.tasks?.length ?? 0);

    const doneMap = (lp.progress?.[dNum] as Record<string, boolean> | undefined) ?? {};
    done += Object.values(doneMap).filter(Boolean).length;
  }
  if (planned === 0) return 'none';
  if (done === 0) {
    const isPast = startOfDay(date).getTime() < startOfDay(new Date()).getTime();
    return isPast ? 'missed' : 'none';
  }
  if (done < planned) return 'some';
  return 'all';
}

/* Pequeño chart SVG (líneas) */
const Chart = ({ labels, goal, actual }: { labels: string[]; goal: number[]; actual: number[] }) => {
  const width = 640, height = 220, padL = 28, padR = 16, padT = 20, padB = 28;
  const n = labels.length;
  const xs = (i: number) => padL + (i * (width - padL - padR)) / Math.max(1, n - 1);
  const maxY = Math.max(5, ...goal, ...actual);
  const niceMax = Math.max(5, Math.ceil(maxY / 5) * 5);
  const ys = (v: number) => padT + (height - padT - padB) * (1 - v / (niceMax || 1));
  const pathFor = (arr: number[]) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xs(i)} ${ys(v)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      <rect x="0" y="0" width={width} height={height} fill="white" />
      {[0,1,2,3,4].map(i=>{
        const y = padT + ((height-padT-padB)*i)/4;
        return <line key={i} x1={padL} x2={width-padR} y1={y} y2={y} stroke="#e5e7eb" strokeWidth="1" />
      })}
      <path d={pathFor(goal)} fill="none" stroke="#d1d5db" strokeWidth="2" />
      <path d={pathFor(actual)} fill="none" stroke="#3b82f6" strokeWidth="2" />
      {goal.map((v,i)=><circle key={`g${i}`} cx={xs(i)} cy={ys(v)} r="4" fill="white" stroke="#d1d5db" strokeWidth="2" />)}
      {actual.map((v,i)=><circle key={`a${i}`} cx={xs(i)} cy={ys(v)} r="4" fill="white" stroke="#3b82f6" strokeWidth="2" />)}
      {labels.map((l,i)=><text key={`l${i}`} x={xs(i)} y={height-padB+16} textAnchor="middle" fontSize="11" fill="#6b7280">{l}</text>)}
      <text x={width-4} y={padT-6} textAnchor="end" fontSize="12" fill="#6b7280">Checks</text>
    </svg>
  );
};

export default function MiActividadStats() {
  const { historicalPoints, weeklySeries } = useTodayActivity();

  // ===== Puntuación por RPC (con fallback) =====
  const [totals, setTotals] = useState<ProgramPointsTotals | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const to = startOfDay(new Date());
        const from = addDays(to, -365);
        const t = await fetchProgramPoints(toISO(from), toISO(to));
        if (mounted) setTotals(t ?? null);
      } catch {
        if (mounted) setTotals(null);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const score = totals?.total_points ?? historicalPoints ?? 0;

  // ===== Semanas (select) =====
  const series4 = (weeklySeries ?? []).slice(0, 4);
  const [weekIdx, setWeekIdx] = useState(0);
  const current = useMemo(
    () =>
      series4[weekIdx] ??
      series4[0] ?? {
        labels: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
        goal: [0, 0, 0, 0, 0, 0, 0],
        actual: [0, 0, 0, 0, 0, 0, 0],
        range: ['—', '—'] as [string, string],
      },
    [series4, weekIdx]
  );

  // ===== % último mes (28 días) =====
  const pctLastMonth = useMemo(() => {
    const map = loadActive();
    const today = startOfDay(new Date()).getTime();
    let planned = 0, done = 0;

    for (let i = 0; i < 28; i++) {
      const d = new Date(today - i * 86_400_000);
      for (const [slug, prog] of Object.entries(map)) {
        const lp = prog as LocalProgram & { progress?: Record<number, Record<string, boolean>>; startedAt?: number };
        if (!lp?.startedAt) continue;
        const json = tryGetProgramJson(slug);
        const totalDays: number = json?.days?.length ?? json?.durationDays ?? 0;
        if (!totalDays) continue;

        const dNum = dayIdxSince(lp.startedAt!, d);
        if (dNum < 1 || dNum > totalDays) continue;

        const dayDef = json?.days?.find((x: any) => x.day === dNum) ?? json?.days?.[dNum - 1];
        planned += Math.max(0, dayDef?.tasks?.length ?? 0);

        const doneMap = (lp.progress?.[dNum] as Record<string, boolean> | undefined) ?? {};
        done += Object.values(doneMap).filter(Boolean).length;
      }
    }
    if (planned <= 0) return 0;
    return Math.round((done / planned) * 100);
  }, []);

  return (
    <div className="py-6 space-y-8">
      {/* Puntuación histórica (RPC) */}
      <section className="text-center">
        <div className="text-[56px] leading-none font-extrabold tabular-nums">{score}</div>
        <div className="text-sm text-neutral-600 mt-1">Puntuación histórica</div>
        <div className="mt-2 text-sm text-neutral-600">
          Has completado el <b>{pctLastMonth}%</b> de retos en el último mes
        </div>
      </section>

      {/* Calendario general con colores (mismo que Resumen) + leyenda */}
      <section>
        <h3 className="text-lg font-semibold mb-2">Calendario general</h3>
        <div className="[&_.ak-calendar-day]:flex [&_.ak-calendar-day]:items-center [&_.ak-calendar-day]:justify-center [&_.ak-calendar-day]:aspect-square [&_.ak-calendar-day]:rounded-full">
          <CalendarLite dayStatus={getDayStatus} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-neutral-600">
          <LegendDot cls="bg-neutral-300" label="Sin tareas / sin actividad" />
          <LegendDot cls="bg-orange-300" label="Algunas hechas" />
          <LegendDot cls="bg-green-300" label="Todo hecho" />
          <LegendDot cls="bg-red-300" label="Día sin hacer ningún reto" />
        </div>
      </section>

      {/* Estadísticas (select de semanas) */}
      <section className="rounded-2xl border border-neutral-200 overflow-hidden">
        <div className="px-4 py-3 text-sm font-semibold bg-neutral-50">Estadísticas</div>
        <div className="p-4 space-y-3">
          <div>
            <label htmlFor="weekSel" className="mr-2 text-sm text-neutral-700">Semana:</label>
            <select
              id="weekSel"
              className="border border-neutral-300 rounded-lg px-2 py-1 text-sm"
              value={weekIdx}
              onChange={(e) => setWeekIdx(Number(e.target.value))}
            >
              {series4.map((w, i) => (
                <option key={i} value={i}>
                  {i === 0 ? 'Última semana' : `Semana ${w.range?.[0] ?? '—'} → ${w.range?.[1] ?? '—'}`}
                </option>
              ))}
            </select>
          </div>

          <Chart labels={current.labels} goal={current.goal} actual={current.actual} />

          <div className="mt-3 flex items-center gap-4 text-xs text-neutral-600">
            <div className="flex items-center gap-2"><span className="inline-block w-4 h-[2px] bg-neutral-300" /> Objetivo</div>
            <div className="flex items-center gap-2"><span className="inline-block w-4 h-[2px] bg-blue-500" /> Hecho</div>
          </div>
        </div>
      </section>

      {/* Logros / Insignias */}
      <section>
        <h3 className="text-lg font-semibold mb-3">Logros</h3>
        <div className="grid grid-cols-3 gap-12">
          {['superlector','detox-tecnologico'].map((k)=>(
            <div key={k} className="flex flex-col items-center gap-2">
              <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-neutral-200 bg-neutral-50">
                <Image src={`/images/badges/${k}.png`} alt={k} fill className="object-contain" sizes="80px" />
              </div>
              <div className="text-xs font-medium text-neutral-800 capitalize">{k.replaceAll('-', ' ')}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ===== Leyenda calendario ===== */
function LegendDot({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`inline-block w-3 h-3 rounded-full ${cls}`} />
      {label}
    </span>
  );
}
