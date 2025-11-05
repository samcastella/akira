// src/app/mizona/estadisticas/page.tsx
'use client';

import { useMemo, useState } from 'react';
import CalendarLite from '@/components/mizona/CalendarLite';
import Image from 'next/image';
import { useTodayActivity } from '@/lib/activity/useTodayActivity';

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
  const { historicalPoints, programsCompleted, weeklySeries } = useTodayActivity();

  const [weekOffset, setWeekOffset] = useState(0); // 0 = última, 1 = penúltima, etc.
  const current = useMemo(
    () =>
      weeklySeries[weekOffset] ??
      weeklySeries[0] ?? {
        labels: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
        goal: [0, 0, 0, 0, 0, 0, 0],
        actual: [0, 0, 0, 0, 0, 0, 0],
        range: ['—', '—'] as [string, string],
      },
    [weeklySeries, weekOffset]
  );

  return (
    <div className="py-6 space-y-8">
      {/* Puntuación histórica + programas completados */}
      <section className="text-center">
        <div className="text-[56px] leading-none font-extrabold tabular-nums">{historicalPoints}</div>
        <div className="text-sm text-neutral-600 mt-1">Puntuación histórica</div>
        <div className="mt-4 text-lg font-semibold">{programsCompleted} programas completados</div>
        {/* Aire extra para evitar solapes en algunos navegadores móviles */}
        <div className="mt-2" />
      </section>

      {/* Calendario general */}
      <section>
        <h3 className="text-lg font-semibold mb-2">Calendario general</h3>
        <CalendarLite />
      </section>

      {/* Estadísticas de check (selector de semanas) */}
      <section className="rounded-2xl border border-neutral-200 overflow-hidden">
        <div className="px-4 py-3 text-sm font-semibold bg-neutral-50">Estadísticas de check</div>
        <div className="p-4 space-y-3">
          <div className="flex gap-2 flex-wrap">
            {weeklySeries.map((w, i) => (
              <button
                key={i}
                onClick={() => setWeekOffset(i)}
                className={`px-3 py-1.5 rounded-xl text-sm border ${
                  i === weekOffset ? 'bg-black text-white border-black' : 'border-neutral-300 hover:bg-neutral-50'
                }`}
              >
                {i === 0 ? 'Última semana' : `Semana del ${w.range?.[0] ?? '—'} al ${w.range?.[1] ?? '—'}`}
              </button>
            ))}
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
