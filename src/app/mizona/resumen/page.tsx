// src/app/mizona/resumen/page.tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import TodayWheel from '@/components/mizona/TodayWheel';
import CalendarLite from '@/components/mizona/CalendarLite';
import StreakCard from '@/components/mizona/StreakCard';
import { useTodayActivity } from '@/lib/activity/useTodayActivity';
import { useUserProfile } from '@/lib/user';
import { useMemo } from 'react';
import { loadActive, type LocalStore } from '@/lib/programsLocal';
import { ChevronRight } from 'lucide-react';

/* ====== helpers locales ====== */

// intenta cargar el JSON del programa para sacar título y total de días
function tryGetProgramJson(slug: string): any | null {
  try {
    // @ts-ignore
    const m = require(`@/data/programs/${slug}.json`);
    return m?.default ?? m ?? null;
  } catch {
    return null;
  }
}
// día actual (1..N) desde startedAt
function dayFromStarted(startedAt: number, totalDays: number) {
  const a = new Date(startedAt);
  a.setHours(0, 0, 0, 0);
  const b = new Date();
  b.setHours(0, 0, 0, 0);
  const delta = Math.floor((b.getTime() - a.getTime()) / 86_400_000) + 1;
  return Math.min(totalDays, Math.max(1, delta));
}

export default function MiActividadResumen() {
  const { totalGoal, totalDone } = useTodayActivity();
  const pct = totalGoal ? Math.round((totalDone / totalGoal) * 100) : 0;

  const user = useUserProfile();
  const name =
    (user?.nombre && user.nombre.trim()) ||
    (user?.username && user.username.trim()) ||
    'Tú';

  return (
    <div className="py-6 space-y-8">
      {/* Rueda estilo captura: texto + % + a/b checks + fuego arriba centrado */}
      <section>
        <div className="relative w-full max-w-[520px] mx-auto">
          {/* 🔥 centrado arriba del aro */}
          <div
            aria-hidden
            className="absolute -top-2 left-1/2 -translate-x-1/2 z-[1] text-xl select-none"
            title="racha"
          >
            🔥
          </div>

          {/* Aro */}
          <TodayWheel value={pct} label="" />

          {/* Contenido centrado (texto + % + a/b) */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <div className="text-[11px] tracking-[0.12em] text-neutral-500">
              ACTIVIDADES DE ESTA SEMANA
            </div>
            <div className="mt-1 text-[28px] sm:text-[32px] font-extrabold text-neutral-900 tabular-nums leading-none">
              {pct}% completado
            </div>
            <div className="mt-2 text-sm text-neutral-500">
              {totalDone}/{totalGoal} checks
            </div>
          </div>
        </div>
      </section>

      {/* Racha (verde + confeti) */}
      <StreakCard />

      {/* Tarjeta perfil (avatar debe cubrir el círculo) */}
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
        <div className="flex-1">
          <div className="text-[15px] font-semibold text-neutral-900">{name}</div>
          <div className="text-sm text-neutral-600">Sigue así, ¡vas genial!</div>
        </div>
        <Link
          href="/mizona/perfil"
          className="text-sm font-medium px-3 py-1.5 rounded-xl border border-neutral-300 hover:bg-neutral-50"
        >
          Editar
        </Link>
      </section>

      {/* Programas activos (cards rectangulares grises; si termina, no aparece) */}
      <section>
        <div className="mb-1 flex items-baseline justify-between">
          <h3 className="text-lg font-semibold">Programas activos</h3>
          <Link href="/programas" className="text-sm font-medium text-neutral-700 hover:underline">
            Ver todos
          </Link>
        </div>
        <p className="text-sm text-neutral-600 mb-3">Sigue con tus programas activos.</p>
        <ActiveProgramsList />
      </section>

      {/* Estadísticas (gráfico compacto) */}
      <section>
        <h3 className="text-lg font-semibold mb-2">Estadísticas</h3>
        <p className="text-sm text-neutral-600 mb-3">Descubre tus estadísticas de esta semana</p>
        <MiniWeeklyChart />
      </section>

      {/* Calendario (números centrados) */}
      <section>
        <h3 className="text-lg font-semibold mb-2">Calendario</h3>
        <p className="text-sm text-neutral-600 mb-3">Selecciona calendario</p>
        <div className="[&_.ak-calendar-day]:flex [&_.ak-calendar-day]:items-center [&_.ak-calendar-day]:justify-center">
          <CalendarLite />
        </div>
      </section>

      {/* Logros / Insignias */}
      <section>
        <h3 className="text-lg font-semibold mb-3">Logros</h3>
        <AchievementsStrip />
      </section>

      {/* CTA Crear hábito */}
      <section className="rounded-2xl border border-dashed border-neutral-300 p-4">
        <h3 className="text-lg font-semibold">Crear hábito</h3>
        <p className="text-sm text-neutral-600">Crea tu propio hábito personalizado</p>
        <Link
          href="/mizona/crear-habito"
          className="inline-block mt-3 px-4 py-2 rounded-2xl bg-black text-white text-sm font-semibold active:scale-[0.98]"
        >
          Empezar
        </Link>
      </section>
    </div>
  );
}

/* ======= Programas activos — cards rectangulares ======= */
function ActiveProgramsList() {
  const activeMap = useMemo<LocalStore>(() => loadActive(), []);
  // primero cargamos todos y luego filtramos fuera los completados comparando día actual y días totales
  const entries = Object.entries(activeMap).filter(([slug, p]) => {
    const lp = p as any;
    if (!lp?.startedAt) return false;
    const json = tryGetProgramJson(slug);
    const totalDays: number = json?.days?.length ?? json?.durationDays ?? 0;
    if (!totalDays) return false;
    const currentDay = dayFromStarted(lp.startedAt, totalDays);
    // ocultar completados (cuando ya superas todos los días)
    return currentDay <= totalDays;
  });

  if (!entries.length) {
    return <div className="text-sm text-neutral-600">No tienes programas activos.</div>;
  }

  return (
    <div className="space-y-3">
      {entries.map(([slug, p]) => {
        const lp = p as any;
        const json = tryGetProgramJson(slug);
        const title: string = json?.title || slug.replaceAll('-', ' ');
        const totalDays: number = json?.days?.length ?? json?.durationDays ?? 0;
        const currentDay = lp?.startedAt && totalDays ? dayFromStarted(lp.startedAt, totalDays) : 0;
        const pct = totalDays ? Math.round((currentDay / totalDays) * 100) : 0;

        const thumb = `/images/programs/${slug.replace('-30', '')}-hero.jpg`;

        return (
          <Link
            key={slug}
            href={`/programas/${slug}`}
            className="block rounded-3xl bg-neutral-100 px-4 py-4"
          >
            <div className="flex items-center gap-3">
              <div className="relative w-14 h-14 rounded-full overflow-hidden ring-1 ring-white/70 bg-white">
                <Image src={thumb} alt={title} fill className="object-cover" sizes="56px" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-neutral-500">Programa</div>
                <div className="text-[15px] font-semibold text-neutral-900 truncate">{title}</div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-2 w-full rounded-full bg-white/60 overflow-hidden">
                    <div
                      className="h-2 bg-yellow-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-xs text-neutral-600 whitespace-nowrap">
                    {totalDays ? `${currentDay}/${totalDays}` : '—'}
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

/* ======= Mini gráfico semanal (placeholder conectado luego) ======= */
function MiniWeeklyChart() {
  // de momento valores estáticos; cuando quieras lo conectamos a weeklySeries de useTodayActivity
  const width = 640, height = 220, padL = 28, padR = 16, padT = 20, padB = 28;
  const labels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const goal = [5, 5, 5, 5, 5, 5, 5];
  const actual = [0, 0, 0, 0, 0, 0, 0];

  const xs = (i: number) => padL + (i * (width - padL - padR)) / 6;
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
          {[0, 1, 2, 3, 4].map((i) => {
            const y = padT + ((height - padT - padB) * i) / 4;
            return <line key={`g${i}`} x1={padL} x2={width - padR} y1={y} y2={y} stroke="#e5e7eb" strokeWidth="1" />;
          })}
          {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
            const val = Math.round(niceMax * p);
            const y = padT + (height - padT - padB) * (1 - p);
            return <text key={`t${i}`} x={width - padR + 6} y={y + 4} fontSize="10" fill="#6b7280">{val}</text>;
          })}
          <path d={pathFor(goal)} fill="none" stroke="#d1d5db" strokeWidth="2" />
          <path d={pathFor(actual)} fill="none" stroke="#3b82f6" strokeWidth="2" />
          {goal.map((v, i) => <circle key={`pg${i}`} cx={xs(i)} cy={ys(v)} r="4" fill="white" stroke="#d1d5db" strokeWidth="2" />)}
          {actual.map((v, i) => <circle key={`pa${i}`} cx={xs(i)} cy={ys(v)} r="4" fill="white" stroke="#3b82f6" strokeWidth="2" />)}
          {labels.map((l, i) => (
            <text key={`lx${i}`} x={xs(i)} y={height - padB + 16} textAnchor="middle" fontSize="11" fill="#6b7280">
              {l}
            </text>
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

/* ======= Logros / Insignias ======= */
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
