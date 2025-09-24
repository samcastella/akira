// src/app/mizona/mis-habitos/HabitosClient.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Plus } from 'lucide-react';
import type { HabitMaster } from '@/components/habits/HabitForm';
import { useUserProfile, useAuthUserId } from '@/lib/user';

/* Programas: helpers para checks diarios */
import {
  PROGRAMS,
  getRelativeDayIndexForDate,
  isTaskTodayCompleted,
  toggleTaskToday,
  loadStore as loadProgramsStore,
} from '@/data/programs';

import { loadActive } from '@/lib/programsLocal';
import { pullUserPrograms } from '@/lib/programSync';

const LS_HABITS_MASTER = 'akira_habits_master_v1';
const LS_HABITS_DAILY = 'akira_habits_daily_v1';

type DailyEntry = { done: boolean; doneAt?: number };
type DailyMap = Record<string, Record<string, DailyEntry>>;

/* ===== Helpers almacenamiento ===== */
function loadMasterHabits(): HabitMaster[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LS_HABITS_MASTER);
    return raw ? (JSON.parse(raw) as HabitMaster[]) : [];
  } catch {
    return [];
  }
}
function loadDaily(): DailyMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LS_HABITS_DAILY);
    return raw ? (JSON.parse(raw) as DailyMap) : {};
  } catch {
    return {};
  }
}
function saveDaily(map: DailyMap) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_HABITS_DAILY, JSON.stringify(map));
}

/* ===== Fechas (LOCAL) ===== */
const dateKey = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const isInRange = (dKey: string, start?: string, end?: string) => {
  if (start && dKey < start) return false;
  if (end && dKey > end) return false;
  return true;
};
const isWeekendDay = (d: Date) => {
  const g = d.getDay(); // 0=Dom, 6=Sáb
  return g === 0 || g === 6;
};
const parseKeyToDate = (k: string) => new Date(`${k}T00:00:00`);

/* ===== Tipado de lista para render ===== */
type HabitView = HabitMaster & { done: boolean };

/* ===== Confeti (opcional) ===== */
async function confettiBurst(evt?: React.MouseEvent, big = false) {
  try {
    const { default: confetti } = await import('canvas-confetti');
    const x = evt?.clientX ?? window.innerWidth / 2;
    const y = evt?.clientY ?? window.innerHeight / 2;
    const ox = Math.min(Math.max(x / window.innerWidth, 0), 1);
    const oy = Math.min(Math.max(y / window.innerHeight, 0), 1);

    confetti({
      particleCount: big ? 180 : 80,
      spread: big ? 90 : 65,
      startVelocity: big ? 45 : 35,
      ticks: 220,
      gravity: 0.9,
      origin: { x: ox, y: oy },
      scalar: big ? 1.05 : 0.9,
      zIndex: 9999,
    });
  } catch {}
}

/* ===== UI helpers ===== */
const BORDER = '#E5E7EB';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-extrabold tracking-tight mb-2">{children}</h3>;
}
function SubTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="text-sm font-semibold tracking-tight mb-2">{children}</h4>;
}
function EmptyBar({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-2xl border border-dashed px-4 py-3 text-sm"
      style={{ borderColor: 'var(--line, rgba(0,0,0,.16))' }}
    >
      <span className="text-black/60">{label}</span>
      <span className="grid h-7 w-7 place-items-center rounded-full border">
        <Plus size={16} />
      </span>
    </Link>
  );
}

/* ===== Mini barra con checks del programa para HOY ===== */
function ProgramMiniBar({ slug }: { slug: string }) {
  // Buscar el programa por slug (array u objeto)
  const program: any =
    (PROGRAMS as any)[slug] ||
    (Array.isArray(PROGRAMS) ? (PROGRAMS as any[]).find((p) => p.slug === slug) : null);
  if (!program) return null;

  const todayIdx =
    typeof getRelativeDayIndexForDate === 'function'
      ? getRelativeDayIndexForDate(slug, new Date())
      : 0;

  const tasks: any[] = program?.days?.[todayIdx]?.tasks || [];

  return (
    <div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--line, rgba(0,0,0,.16))' }}>
      <div className="text-sm font-medium mb-2 truncate">{program.title || slug}</div>
      {tasks.length === 0 ? (
        <span className="text-xs text-black/50">Hoy no hay tareas.</span>
      ) : (
        <ul className="flex items-center gap-8">
          {tasks.map((t) => {
            const checked =
              typeof isTaskTodayCompleted === 'function' ? isTaskTodayCompleted(slug, t.id) : false;
            return (
              <li key={t.id}>
                <button
                  onClick={() => toggleTaskToday?.(slug, t.id)}
                  className="grid h-6 w-6 place-items-center rounded-full border"
                  title={checked ? 'Desmarcar' : 'Marcar'}
                  aria-label={checked ? `Desmarcar ${t.label}` : `Marcar ${t.label}`}
                  style={
                    checked
                      ? { background: '#22c55e', color: 'white', borderColor: '#16a34a' }
                      : { background: 'white' }
                  }
                >
                  {checked ? <Check size={14} /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ===== Componente principal ===== */
export default function HabitosClient() {
  const [masters, setMasters] = useState<HabitMaster[]>([]);
  const [daily, setDaily] = useState<DailyMap>({});
  const [today, setToday] = useState<string>(dateKey());

  // rollover a medianoche (local)
  const midnightTimer = useRef<number | null>(null);
  useEffect(() => {
    const schedule = () => {
      const now = new Date();
      const next = new Date(now);
      next.setHours(24, 0, 0, 0);
      const ms = next.getTime() - now.getTime();
      midnightTimer.current = window.setTimeout(() => {
        setToday(dateKey());
        schedule();
      }, ms + 1000);
    };
    schedule();
    return () => {
      if (midnightTimer.current) window.clearTimeout(midnightTimer.current);
    };
  }, []);

  // usuario
  const user = (useUserProfile?.() as any) || {};
  const username = String(user?.username ?? '').trim();
  const fullName = String(user?.nombre ?? '').trim();
  const parts = fullName.split(/\s+/).filter(Boolean);
  const firstName = parts[0] || '';
  const greetingName = firstName || username || 'usuario/a';
  const avatar = (user?.foto as string | undefined) || undefined;

  // Programas activos (desde storage + sync)
  const [activePrograms, setActivePrograms] = useState<string[]>([]);

  const uid = useAuthUserId();
  useEffect(() => {
    setMasters(loadMasterHabits());
    setDaily(loadDaily());

    const readActives = () => {
      try {
        const store = loadActive(); // { [slug]: LocalProgram }
        setActivePrograms(Object.keys(store || {}));
      } catch {
        setActivePrograms([]);
      }
    };

    readActives();

    // Pull remoto y refresco local
    const hydrate = async () => {
      try {
        if (uid) await pullUserPrograms();
      } catch {}
      readActives();
    };
    hydrate();

    const onProgramsUpdated = () => readActives();
    window.addEventListener('storage', onProgramsUpdated);
    window.addEventListener('akira:programs-updated', onProgramsUpdated as EventListener);
    return () => {
      window.removeEventListener('storage', onProgramsUpdated);
      window.removeEventListener('akira:programs-updated', onProgramsUpdated as EventListener);
    };
  }, [uid]);

  // asegurar bucket de hoy
  useEffect(() => {
    if (masters.length === 0) return;
    ensureDailyForDate(today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masters, today]);

  function ensureDailyForDate(dKey: string) {
    setDaily((prev) => {
      const map: DailyMap = { ...prev };
      const bucket: Record<string, DailyEntry> = { ...(map[dKey] ?? {}) };
      const d = parseKeyToDate(dKey);

      masters.forEach((h) => {
        if (!isInRange(dKey, h.startDate, h.endDate)) return;
        if (h.weekend === false && isWeekendDay(d)) return;
        if (!bucket[h.id]) bucket[h.id] = { done: false };
      });

      map[dKey] = bucket;
      saveDaily(map);
      return map;
    });
  }

  // helpers de aplicabilidad
  function applicableMasterIds(dKey: string) {
    const d = parseKeyToDate(dKey);
    return masters
      .filter((h) => isInRange(dKey, h.startDate, h.endDate))
      .filter((h) => !(h.weekend === false && isWeekendDay(d)))
      .map((h) => h.id);
  }

  // toggle hábito personal
  function toggleDone(habitId: string, dKey?: string, evt?: React.MouseEvent) {
    const key = dKey ?? today;
    const bucket = daily[key] ?? {};
    const wasDone = !!bucket[habitId]?.done;
    let completedAllAfter = false;

    setDaily((prev) => {
      const map: DailyMap = { ...prev };
      const b: Record<string, DailyEntry> = { ...(map[key] ?? {}) };
      const current = b[habitId] ?? { done: false };
      const next: DailyEntry = current.done ? { done: false } : { done: true, doneAt: Date.now() };
      b[habitId] = next;
      map[key] = b;

      const ids = applicableMasterIds(key);
      completedAllAfter = ids.length > 0 && ids.every((id) => b[id]?.done === true);

      saveDaily(map);
      return map;
    });

    if (!wasDone) void confettiBurst(evt);
    if (!wasDone && completedAllAfter) void confettiBurst(undefined, true);
  }

  const todayHabits: HabitView[] = useMemo(() => {
    const d = parseKeyToDate(today);
    const bucket = daily[today] ?? {};
    return masters
      .filter((h) => isInRange(today, h.startDate, h.endDate))
      .filter((h) => !(h.weekend === false && isWeekendDay(d)))
      .map((h) => ({ ...h, done: !!bucket[h.id]?.done }));
  }, [masters, daily, today]);

  /* ===== RENDER ===== */
  return (
    <main className="mx-auto w-full max-w-3xl px-5 sm:px-6 md:px-8 py-6" style={{ background: 'white' }}>
      {/* Cabecera minimalista con avatar pequeño clicable */}
      <section className="mb-5 flex items-center gap-3">
        <Link
          href="/mizona/perfil"
          className="rounded-full overflow-hidden flex items-center justify-center"
          style={{ width: 32, height: 32, border: `1px solid ${BORDER}`, background: '#f7f7f7' }}
          aria-label="Ir a mi perfil"
          title="Mi perfil"
        >
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="Foto de perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 16, color: '#9ca3af' }}>👤</span>
          )}
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold m-0 leading-none">Hola {greetingName},</h1>
          <p className="mt-1 text-sm text-black/70 m-0">Gestiona tus hábitos y retos diarios.</p>
        </div>
      </section>

      {/* Menú superior (se mantiene) */}
      <nav className="mb-4 flex flex-wrap gap-3">
        <Link href="/mizona" className="btn" style={{ background: 'black', color: 'white', border: '1px solid black' }}>
          Mis hábitos
        </Link>
        <Link
          href="/mizona/crear-habitos"
          className="btn"
          style={{ background: 'white', color: 'black', border: '1px solid var(--line)' }}
        >
          Crear hábito
        </Link>
        <Link href="/mizona/logros" className="btn" style={{ background: 'white', color: 'black', border: '1px solid var(--line)' }}>
          Logros
        </Link>
        <Link href="/mizona/perfil" className="btn" style={{ background: 'white', color: 'black', border: '1px solid var(--line)' }}>
          Mi perfil
        </Link>
        <Link
          href="/mizona/calendarios"
          className="btn"
          style={{ background: 'white', color: 'black', border: '1px solid var(--line)' }}
        >
          Calendarios
        </Link>
      </nav>

      {/* RETOS PARA HOY */}
      <SectionTitle>
        Retos para hoy —{' '}
        <span className="font-normal">
          {new Date(`${today}T00:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
      </SectionTitle>

      {/* 1) Creados por ti */}
      <section className="mb-6">
        <SubTitle>Creados por ti</SubTitle>
        {todayHabits.length === 0 ? (
          <EmptyBar label="Añadir hábito personal" href="/mizona/crear-habitos" />
        ) : (
          <ul className="space-y-3">
            {todayHabits.map((h) => {
              const checked = h.done;
              const bg = checked ? (h.color ?? '#E8EAF6') : '#fff';
              const textColor = checked ? (h.textColor === 'white' ? '#fff' : '#111') : '#111';

              return (
                <li
                  key={h.id}
                  className="flex items-center justify-between rounded-2xl border border-black/20 px-4 py-3 transition"
                  style={{ background: bg, color: textColor }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{h.icon ?? '🧩'}</span>
                    <span className="text-sm">{h.name}</span>
                  </div>

                  <button
                    onClick={(e) => toggleDone(h.id, undefined, e)}
                    className="grid h-6 w-6 place-items-center rounded-full border border-black/60 bg-white text-black"
                    title={checked ? 'Desmarcar' : 'Marcar como hecho'}
                    aria-label={checked ? `Desmarcar ${h.name}` : `Marcar ${h.name} como hecho`}
                    style={checked ? { background: '#22c55e', color: 'white', borderColor: '#16a34a' } : undefined}
                  >
                    {checked ? <Check size={14} /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 2) Programas activos */}
      <section className="mb-6">
        <SubTitle>Programas activos</SubTitle>
        {activePrograms?.length ? (
          <div className="space-y-3">
            {activePrograms.map((slug) => (
              <ProgramMiniBar key={slug} slug={slug} />
            ))}
          </div>
        ) : (
          <EmptyBar label="Añadir programa" href="/habitos" />
        )}
      </section>

      {/* 3) Retos con amigos */}
      <section className="mb-2">
        <SubTitle>Retos con amigos</SubTitle>
        <EmptyBar label="Añadir reto con amigos" href="/mis-amigos" />
      </section>
    </main>
  );
}
