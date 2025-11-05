// src/app/mizona/resumen/page.tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import TodayWheel from '@/components/mizona/TodayWheel';
import CalendarLite from '@/components/mizona/CalendarLite';
import StreakCard from '@/components/mizona/StreakCard';
import SubHeaderTabs from '@/components/SubHeaderTabs';
import { useTodayActivity } from '@/lib/activity/useTodayActivity';
import { useUserProfile } from '@/lib/user';
import { useMemo } from 'react';
import { loadActive, type LocalStore, type LocalProgram } from '@/lib/programsLocal';
import { ChevronRight } from 'lucide-react';

/* ===== helpers JSON / fechas ===== */
function tryGetProgramJson(slug: string): any | null {
  try {
    // @ts-ignore
    const m = require(`@/data/programs/${slug}.json`);
    return m?.default ?? m ?? null;
  } catch {
    return null;
  }
}
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function dayIdxSince(startedAt: number, when: Date) {
  const a = startOfDay(new Date(startedAt)).getTime();
  const b = startOfDay(when).getTime();
  return Math.floor((b - a) / 86_400_000) + 1; // 1..N
}
function clampDay(startedAt: number, when: Date, totalDays: number) {
  const idx = dayIdxSince(startedAt, when);
  return Math.min(totalDays, Math.max(1, idx));
}
function routeSlug(slug: string) {
  // sólo para la ruta (no cambia el slug de almacenamiento)
  return slug.replace(/-30$/, '');
}

/* ===== Tabs ===== */
const TABS = [
  { href: '/mizona/resumen', label: 'Resumen', exact: true },
  { href: '/mizona/checks', label: 'Checks del día' },
  { href: '/mizona/estadisticas', label: 'Estadísticas' },
] as const;

export default function MiActividadResumen() {
  const { totalGoal, totalDone, historicalPoints } = useTodayActivity(); // hoy (global) + puntos históricos
  const pct = totalGoal ? Math.round((totalDone / totalGoal) * 100) : 0;

  const user = useUserProfile();
  const name =
    (user?.nombre && user.nombre.trim()) ||
    (user?.username && user.username.trim()) ||
    'Tú';

  // Puntos globales visibles en tarjeta perfil (de momento usamos historicalPoints)
  const totalPoints = typeof historicalPoints === 'number' ? historicalPoints : 0;
  // Ranking mensual — placeholder hasta tener endpoint/campo real
  const rankMonthly = (user as any)?.rank_month ?? '-';

  return (
    <div className="pb-6">
      {/* Submenú */}
      <SubHeaderTabs tabs={TABS as any} size="compact" ariaLabel="Navegación Mi actividad" />

      <div className="py-6 space-y-8">
        {/* ===== Rueda ===== */}
        <section>
          <div className="w-full flex items-center justify-center">
            <TodayWheel
              value={pct}
              title="ACTIVIDADES PARA HOY"
              totalDone={totalDone}
              totalGoal={totalGoal}
              size={260}
            />
          </div>
        </section>

        {/* ===== Racha ===== */}
        <StreakCard />

        {/* ===== Perfil: avatar + puntos + ranking ===== */}
        <section className="rounded-2xl border border-neutral-200 p-4 flex items-center gap-4">
          <div className="relative w-16 h-16 rounded-full overflow-hidden bg-neutral-100">
            <Image
              src={user?.foto || '/images/avatars/default.png'}
              alt="Tu perfil"
              fill
              className="object-cover"
              sizes="64px"
              priority
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold text-neutral-900 truncate">{name}</div>
            <div className="mt-1 text-sm text-neutral-600">
              Ranking mensual: <b>#{rankMonthly}</b>
            </div>
          </div>
          <div className="text-2xl font-extrabold tabular-nums">{totalPoints}</div>
        </section>

        {/* ===== Programas activos ===== */}
        <section>
          <div className="mb-1 flex items-baseline justify-between">
            <h3 className="text-lg font-semibold">Programas activos</h3>
            <Link href="/programas" className="text-sm font-medium text-neutral-700 hover:underline">Ver todos</Link>
          </div>
          <p className="text-sm text-neutral-600 mb-3">Sigue con tus programas activos.</p>
          <ActiveProgramsList />
        </section>

        {/* ===== Estadísticas (minigráfico real) ===== */}
        <section id="stats">
          <h3 className="text-lg font-semibold mb-2">Estadísticas</h3>
          <p className="text-sm text-neutral-600 mb-3">Descubre tus estadísticas de esta semana</p>
          <MiniWeeklyChartReal />
        </section>

        {/* ===== Calendario con “Ver todo” ===== */}
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-lg font-semibold">Calendario</h3>
            <Link href="#stats" className="text-sm font-medium text-neutral-700 hover:underline">Ver todo</Link>
          </div>
          <div className="[&_.ak-calendar-day]:flex [&_.ak-calendar-day]:items-center [&_.ak-calendar-day]:justify-center">
            {/* Cuando CalendarLite acepte dayStatus, se lo pasamos */}
            <CalendarLite />
          </div>
        </section>

        {/* ===== Logros ===== */}
        <section>
          <h3 className="text-lg font-semibold mb-3">Logros</h3>
          <AchievementsStrip />
        </section>
      </div>
    </div>
  );
}

/* ===== Programas activos — cards ===== */
function ActiveProgramsList() {
  const activeMap = useMemo<LocalStore>(() => loadActive(), []);
  const entries = Object.entries(activeMap).filter(([slug, p]) => {
    const lp = p as LocalProgram;
    if (!lp?.startedAt) return false;
    const json = tryGetProgramJson(slug);
    const totalDays: number = json?.days?.length ?? json?.durationDays ?? 0;
    if (!totalDays) return false;
    // ocultar si ya acabó
    const today = clampDay(lp.startedAt, new Date(), totalDays);
    return today <= totalDays;
  });

  if (!entries.length) return <div className="text-sm text-neutral-600">No tienes programas activos.</div>;

  return (
    <div className="space-y-3">
      {entries.map(([slug, p]) => {
        const lp = p as LocalProgram;
        const json = tryGetProgramJson(slug);
        const title: string = json?.title || slug.replaceAll('-', ' ');
        const totalDays: number = json?.days?.length ?? json?.durationDays ?? 0;
        const today = totalDays ? clampDay(lp.startedAt!, new Date(), totalDays) : 0;
        const pct = totalDays ? Math.round((today / totalDays) * 100) : 0;

        const thumb = `/images/programs/${routeSlug(slug)}-hero.jpg`;

        return (
          <Link key={slug} href={`/programas/${routeSlug(slug)}`} className="block rounded-3xl bg-neutral-100 px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="relative w-14 h-14 rounded-full overflow-hidden ring-1 ring-white/70 bg-white">
                <Image src={thumb} alt={title} fill className="object-cover" sizes="56px" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-neutral-500">Programa</div>
                <div className="text-[15px] font-semibold text-neutral-900 truncate">{title}</div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-2 w-full rounded-full bg-white/60 overflow-hidden">
                    <div className="h-2 bg-yellow-400" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-xs text-neutral-600 whitespace-nowrap">
                    {totalDays ? `${today}/${totalDays}` : '—'}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-neutral-400 shrink-0" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

/* ===== Estadísticas reales (últimos 7 días, global) ===== */
function MiniWeeklyChartReal() {
  const activeMap = useMemo<LocalStore>(() => loadActive(), []);
  const series = useMemo(() => buildWeeklySeries(activeMap), [activeMap]);
  return <MiniChart labels={series.labels} goal={series.goal} actual={series.actual} />;
}

function buildWeeklySeries(activeMap: LocalStore) {
  const labels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const goal = Array(7).fill(0);
  const actual = Array(7).fill(0);

  // ventana: hoy hacia atrás 6 días
  const today = startOfDay(new Date());
  const days: Date[] = [];
  for (let i = 6; i >= 0; i--) days.push(new Date(today.getTime() - i * 86_400_000));

  // por cada programa activo, sumamos tareas planificadas y hechas
  for (const [slug, prog] of Object.entries(activeMap)) {
    const lp = prog as LocalProgram;
    if (!lp?.startedAt) continue;
    const json = tryGetProgramJson(slug);
    const totalDays: number = json?.days?.length ?? json?.durationDays ?? 0;
    if (!totalDays) continue;

    days.forEach((d, idx) => {
      const dayNum = dayIdxSince(lp.startedAt, d); // puede ser <1 o >totalDays
      if (dayNum < 1 || dayNum > totalDays) return;

      const dayDef = json?.days?.find((x: any) => x.day === dayNum) ?? json?.days?.[dayNum - 1];
      const planned = Math.max(0, dayDef?.tasks?.length ?? 0);
      goal[idx] += planned;

      const doneMap = (lp.progress?.[dayNum] as Record<string, boolean> | undefined) ?? {};
      const done = Object.values(doneMap).filter(Boolean).length;
      actual[idx] += done;
    });
  }

  return { labels, goal, actual };
}

/* ===== MiniChart SVG ===== */
function MiniChart({ labels, goal, actual }: { labels: string[]; goal: number[]; actual: number[] }) {
  const width = 640, height = 220, padL = 28, padR = 16, padT = 20, padB = 28;
  const n = 7;
  const xs = (i: number) => padL + (i * (width - padL - padR)) / Math.max(1, n - 1);
  const maxY = Math.max(5, ...goal, ...actual);
  const niceMax = Math.max(5, Math.ceil(maxY / 5) * 5);
  const ys = (v: number) => padT + (height - padT - padB) * (1 - v / (niceMax || 1));
  const pathFor = (arr: number[]) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xs(i)} ${ys(v)}`).join(' ');

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--line)' }}>
      <div className="px-4 py-3 text-sm font-semibold bg-neutral-50">Estadísticas</div>
      <div className="p-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          <rect x="0" y="0" width={width} height={height} fill="white" />
          {[0,1,2,3,4].map((i) => {
            const y = padT + ((height - padT - padB) * i) / 4;
            return <line key={`g${i}`} x1={padL} x2={width - padR} y1={y} y2={y} stroke="#e5e7eb" strokeWidth="1" />;
          })}
          {[0,0.25,0.5,0.75,1].map((p, i) => {
            const val = Math.round(niceMax * p);
            const y = padT + (height - padT - padB) * (1 - p);
            return <text key={`t${i}`} x={width - padR + 6} y={y + 4} fontSize="10" fill="#6b7280">{val}</text>;
          })}
          <path d={pathFor(goal)} fill="none" stroke="#d1d5db" strokeWidth="2" />
          <path d={pathFor(actual)} fill="none" stroke="#3b82f6" strokeWidth="2" />
          {goal.map((v, i) => <circle key={`pg${i}`} cx={xs(i)} cy={ys(v)} r="4" fill="white" stroke="#d1d5db" strokeWidth="2" />)}
          {actual.map((v, i) => <circle key={`pa${i}`} cx={xs(i)} cy={ys(v)} r="4" fill="white" stroke="#3b82f6" strokeWidth="2" />)}
          {labels.map((l, i) => (
            <text key={`lx${i}`} x={xs(i)} y={height - padB + 16} textAnchor="middle" fontSize="11" fill="#6b7280">{l}</text>
          ))}
          <text x={width - 4} y={padT - 6} textAnchor="end" fontSize="12" fill="#6b7280">Retos</text>
        </svg>

        <div className="mt-3 flex items-center gap-4 text-xs text-neutral-600">
          <div className="flex items-center gap-2"><span className="inline-block w-4 h-[2px] bg-neutral-300" /> Objetivo</div>
          <div className="flex items-center gap-2"><span className="inline-block w-4 h-[2px] bg-blue-500" /> Hecho</div>
        </div>
      </div>
    </div>
  );
}

/* ===== Logros ===== */
function AchievementsStrip() {
  const items = [
    { key: 'superlector', title: 'Superlector', src: '/images/badges/superlector.png' },
    { key: 'domador-scroll', title: 'Domador del Scroll', src: '/images/badges/detox-tecnologico.png' },
  ];
  return (
    <div className="grid grid-cols-3 gap-4">
      {items.map((b) => (
        <div key={b.key} className="flex flex-col items-center">
          <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-neutral-200 bg-neutral-50">
            <Image src={b.src} alt={b.title} fill className="object-cover" sizes="80px" />
          </div>
          <div className="mt-2 text-xs text-center text-neutral-800">{b.title}</div>
        </div>
      ))}
    </div>
  );
}

/* ===== Estados por día (listo para cuando CalendarLite lo soporte) ===== */
function getDayStatus(date: Date): 'none'|'some'|'all'|'missed' {
  const map = loadActive();
  let planned = 0, done = 0;
  for (const [slug, prog] of Object.entries(map)) {
    const lp = prog as LocalProgram;
    if (!lp?.startedAt) continue;
    const json = tryGetProgramJson(slug);
    const totalDays: number = json?.days?.length ?? json?.durationDays ?? 0;
    if (!totalDays) continue;
    const dNum = dayIdxSince(lp.startedAt, date);
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
