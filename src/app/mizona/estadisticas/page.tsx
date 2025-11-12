'use client';

import { useEffect, useMemo, useState } from 'react';
import CalendarLite from '@/components/mizona/CalendarLite';
import Image from 'next/image';
import { useTodayActivity } from '@/lib/activity/useTodayActivity';
import { loadActive, type LocalProgram } from '@/lib/programsLocal';
import { loadProgramJson, type ProgramJson } from '@/lib/programJson';

/* === Puntuación (RPC) === */
import {
  fetchProgramPoints,
  type ProgramPointsTotals,
} from '@/lib/programService';

/* ==== Helpers de fecha ==== */
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
  return Math.floor((b - a) / 86_400_000) + 1; // 1..N
}

/* ==== Carga dinámica de ProgramJson (fresco + memo síncrono) ==== */
const V = process.env.NEXT_PUBLIC_BUILD_VERSION || 'dev';
async function fetchProgramJsonFresh(slug: string, signal?: AbortSignal): Promise<ProgramJson> {
  const url = `/data/programs/${encodeURIComponent(slug)}.json?v=${encodeURIComponent(V)}`;
  const res = await fetch(url, { cache: 'no-store', signal });
  if (!res.ok) throw new Error(`HTTP ${res.status} al cargar ${url}`);
  return res.json();
}
const PROGRAM_JSON_MEMO = new Map<string, ProgramJson>();
function getProgramJsonCachedSync(slug: string): ProgramJson | null {
  return PROGRAM_JSON_MEMO.get(slug) ?? null;
}

/* ==== Página ==== */
export default function MiActividadStats() {
  const { historicalPoints, weeklySeries } = useTodayActivity();

  /* Estado local de programas activos + JSONs */
  const [activeMap, setActiveMap] = useState<Record<string, LocalProgram>>({});
  const [jsonBySlug, setJsonBySlug] = useState<Record<string, ProgramJson>>({});

  /* Hidrata programas activos del localStore al montar/visibilidad */
  useEffect(() => {
    const read = () => setActiveMap(loadActive() as Record<string, LocalProgram>);
    read();
    const onVis = () => { if (document.visibilityState === 'visible') read(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  /* Carga JSON fresco para los slugs activos (y rellena memo síncrono) */
  useEffect(() => {
    const slugs = Object.keys(activeMap).filter((s) => !!activeMap[s]?.startedAt);
    if (!slugs.length) return;

    const controller = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const pairs = await Promise.all(slugs.map(async (slug) => {
          try {
            const fresh = await fetchProgramJsonFresh(slug, controller.signal);
            return [slug, fresh] as const;
          } catch {
            try {
              const fb = await loadProgramJson(slug);
              return [slug, fb] as const;
            } catch {
              return null;
            }
          }
        }));
        if (cancelled) return;
        const next: Record<string, ProgramJson> = { ...jsonBySlug };
        for (const p of pairs) {
          if (!p) continue;
          const [slug, json] = p;
          next[slug] = json;
          PROGRAM_JSON_MEMO.set(slug, json);
        }
        setJsonBySlug(next);
      } catch {/* noop */}
    })();

    return () => { cancelled = true; controller.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Object.keys(activeMap).sort().join('|'), V]);

  /* ===== Puntuación por RPC (con fallback) ===== */
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

  /* ===== Select de semanas (useTodayActivity) ===== */
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

  /* ===== dayStatus (clausura sobre jsonBySlug + activeMap) ===== */
  const getDayStatus = useMemo(() => {
    return (date: Date): 'none'|'some'|'all'|'missed' => {
      const map = activeMap;
      let planned = 0, done = 0;

      for (const [slug, lpRaw] of Object.entries(map)) {
        const lp = lpRaw as LocalProgram & { progress?: Record<number, Record<string, boolean>>; startedAt?: number };
        if (!lp?.startedAt) continue;

        const json = jsonBySlug[slug] || getProgramJsonCachedSync(slug);
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
    };
  }, [activeMap, jsonBySlug]);

  /* ===== % último mes (28 días) ===== */
  const pctLastMonth = useMemo(() => {
    const map = activeMap;
    const today = startOfDay(new Date()).getTime();
    let planned = 0, done = 0;

    for (let i = 0; i < 28; i++) {
      const d = new Date(today - i * 86_400_000);
      for (const [slug, lpRaw] of Object.entries(map)) {
        const lp = lpRaw as LocalProgram & { progress?: Record<number, Record<string, boolean>>; startedAt?: number };
        if (!lp?.startedAt) continue;

        const json = jsonBySlug[slug] || getProgramJsonCachedSync(slug);
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
  }, [activeMap, jsonBySlug]);

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
