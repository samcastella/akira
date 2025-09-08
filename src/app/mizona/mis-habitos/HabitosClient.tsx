// src/app/mizona/HabitosClient.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, ArrowRight } from 'lucide-react';
import type { HabitMaster } from '@/components/habits/HabitForm';
import { useUserProfile } from '@/lib/user';

const LS_HABITS_MASTER = 'akira_habits_master_v1';
const LS_HABITS_DAILY  = 'akira_habits_daily_v1';
const LS_ACTIVE_PROGRAMS = 'akira_programs_active_v1';

type DailyEntry = { done: boolean; doneAt?: number };
type DailyMap = Record<string, Record<string, DailyEntry>>;

/* ===== Helpers almacenamiento ===== */
function loadMasterHabits(): HabitMaster[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LS_HABITS_MASTER);
    return raw ? (JSON.parse(raw) as HabitMaster[]) : [];
  } catch { return []; }
}
function loadDaily(): DailyMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LS_HABITS_DAILY);
    return raw ? (JSON.parse(raw) as DailyMap) : {};
  } catch { return {}; }
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

/* Semana utilidades */
function mondayOf(date: Date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // 0=lunes
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

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

/* ===== Componente principal ===== */
export default function HabitosClient() {
  const [masters, setMasters] = useState<HabitMaster[]>([]);
  const [daily, setDaily] = useState<DailyMap>({});
  const [today, setToday] = useState<string>(dateKey());

  // Rollover a medianoche (local)
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
    return () => { if (midnightTimer.current) window.clearTimeout(midnightTimer.current); };
  }, []);

  // Usuario
  const user = (useUserProfile?.() as any) || {};
  const username = String(user?.username ?? '').trim();
  const fullName = String(user?.nombre ?? '').trim();
  const parts = fullName.split(/\s+/).filter(Boolean);
  const firstName = parts[0] || '';
  const firstSurname = parts[1] || '';
  const nameAndSurname = (firstName + (firstSurname ? ' ' + firstSurname : '')).trim();
  const greetingName = firstName || username || 'usuario/a';
  const avatar = user?.foto as string | undefined;

  // Programas activos (placeholder)
  const [activePrograms, setActivePrograms] = useState<string[]>([]);

  useEffect(() => {
    setMasters(loadMasterHabits());
    setDaily(loadDaily());
    try {
      const raw = localStorage.getItem(LS_ACTIVE_PROGRAMS);
      setActivePrograms(raw ? JSON.parse(raw) : []);
    } catch { setActivePrograms([]); }
  }, []);

  // Asegura bucket de hoy
  useEffect(() => {
    if (masters.length === 0) return;
    ensureDailyForDate(today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masters, today]);

  function ensureDailyForDate(dKey: string) {
    setDaily(prev => {
      const map: DailyMap = { ...prev };
      const bucket: Record<string, DailyEntry> = { ...(map[dKey] ?? {}) };
      const d = parseKeyToDate(dKey);

      masters.forEach(h => {
        if (!isInRange(dKey, h.startDate, h.endDate)) return;
        if (h.weekend === false && isWeekendDay(d)) return;
        if (!bucket[h.id]) bucket[h.id] = { done: false };
      });

      map[dKey] = bucket;
      saveDaily(map);
      return map;
    });
  }

  // Helpers de aplicabilidad
  function applicableMasterIds(dKey: string) {
    const d = parseKeyToDate(dKey);
    return masters
      .filter(h => isInRange(dKey, h.startDate, h.endDate))
      .filter(h => !(h.weekend === false && isWeekendDay(d)))
      .map(h => h.id);
  }

  // Toggle
  function toggleDone(habitId: string, dKey?: string, evt?: React.MouseEvent) {
    const key = dKey ?? today;
    const bucket = daily[key] ?? {};
    const wasDone = !!bucket[habitId]?.done;
    let completedAllAfter = false;

    setDaily(prev => {
      const map: DailyMap = { ...prev };
      const b: Record<string, DailyEntry> = { ...(map[key] ?? {}) };
      const current = b[habitId] ?? { done: false };
      const next: DailyEntry = current.done ? { done: false } : { done: true, doneAt: Date.now() };
      b[habitId] = next;
      map[key] = b;

      const ids = applicableMasterIds(key);
      completedAllAfter = ids.length > 0 && ids.every(id => b[id]?.done === true);

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
      .filter(h => isInRange(today, h.startDate, h.endDate))
      .filter(h => !(h.weekend === false && isWeekendDay(d)))
      .map(h => ({ ...h, done: !!bucket[h.id]?.done }));
  }, [masters, daily, today]);

  const BORDER = '#E5E7EB'; // gris claro

  /* ====== RENDER ====== */
  return (
    <main className="mx-auto w-full max-w-3xl px-5 sm:px-6 md:px-8 py-6" style={{ background: 'white' }}>
      {/* Saludo destacado (primero) */}
      <section className="mb-4">
        <h1 className="text-xl font-extrabold m-0">Hola {greetingName},</h1>
        <p className="mt-1 text-sm text-black/70">
          En esta zona podrás ver tus hábitos del día, crear nuevos, ver tus logros y editar tu perfil.
        </p>
      </section>

      {/* Botones (añadido Calendarios) */}
      <nav className="mb-4 flex flex-wrap gap-3">
        <Link href="/mizona" className="btn" style={{ background: 'black', color: 'white', border: '1px solid black' }}>
          Mis hábitos
        </Link>
        <Link href="/mizona/crear-habitos" className="btn" style={{ background: 'white', color: 'black', border: '1px solid var(--line)' }}>
          Crear hábito
        </Link>
        <Link href="/mizona/logros" className="btn" style={{ background: 'white', color: 'black', border: '1px solid var(--line)' }}>
          Logros
        </Link>
        <Link href="/mizona/perfil" className="btn" style={{ background: 'white', color: 'black', border: '1px solid var(--line)' }}>
          Mi perfil
        </Link>
        {/* NUEVO */}
        <Link href="/mizona/calendarios" className="btn" style={{ background: 'white', color: 'black', border: '1px solid var(--line)' }}>
          Calendarios
        </Link>
      </nav>

      {/* Tarjeta de perfil con borde gris y botón negro alineado a la derecha (sin cambios) */}
      <div className="mb-5 rounded-2xl" style={{ border: `1px solid ${BORDER}`, padding: 12 }}>
        <div className="flex items-center gap-3">
          <span
            className="rounded-full overflow-hidden flex items-center justify-center"
            style={{ width: 56, height: 56, border: `1px solid ${BORDER}`, background: '#f7f7f7' }}
          >
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="Foto de perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: 20, color: '#9ca3af' }}>👤</span>
            )}
          </span>

          <div className="min-w-0 flex-1">
            <div className="font-bold truncate">{nameAndSurname || username || 'usuario/a'}</div>
            {username && <div className="text-xs text-black/70 truncate">@{username}</div>}
          </div>

          <Link
            href="/mizona/perfil"
            className="btn"
            style={{ background: 'black', color: 'white', border: '1px solid black', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            aria-label="Ver perfil"
          >
            Ver perfil <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {/* ⛳️ Se ha eliminado el semáforo y el calendario de esta página */}

      {/* Título de hoy */}
      <h3 style={{ marginTop: 0, marginBottom: 10 }}>
        ¿Qué tenemos para hoy {new Date(`${today}T00:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}?
      </h3>

      {/* Hábitos creados por ti (sin cambios) */}
      <section className="mb-6">
        <h4 style={{ margin: '6px 0 8px 0' }}>Hábitos creados por ti</h4>
        {masters.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/20 px-4 py-6 text-center text-sm text-black/60">
            No tienes hábitos creados todavía. Ve a{' '}
            <Link href="/mizona/crear-habitos" className="font-medium underline">Crear mis hábitos</Link>.
          </div>
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

                  {/* Círculo de check */}
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

      {/* Programas activos (placeholder) */}
      {activePrograms?.map((p) => (
        <section key={p} className="mb-6">
          <h4 style={{ margin: '6px 0 8px 0' }}>Programa activo: {p}</h4>
          <div className="rounded-2xl border border-dashed border-black/20 px-4 py-6 text-center text-sm text-black/60">
            Próximamente: hábitos con check por programa.
          </div>
        </section>
      ))}

      {/* Retos con amigos (placeholder) */}
      <section className="mb-2">
        <h4 style={{ margin: '6px 0 8px 0' }}>Retos con amigos</h4>
        <div className="rounded-2xl border border-dashed border-black/20 px-4 py-6 text-center text-sm text-black/60">
          Próximamente: “Ir al gym durante 30 días” y otros retos compartidos, con sus checks diarios.
        </div>
      </section>
    </main>
  );
}
