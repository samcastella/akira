'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import type { HabitMaster } from '@/components/habits/HabitForm';
import { useUserProfile } from '@/lib/user';

const LS_HABITS_MASTER = 'akira_habits_master_v1';
const LS_HABITS_DAILY  = 'akira_habits_daily_v1'; // { [yyyy-mm-dd]: { [habitId]: { done, doneAt? } } }
const LS_ACTIVE_PROGRAMS = 'akira_programs_active_v1';

type DailyEntry = { done: boolean; doneAt?: number };
type DailyMap = Record<string, Record<string, DailyEntry>>; // dateKey -> habitId -> entry

/* ===== Mensajes de felicitación ===== */
const CONGRATS_MESSAGES = [
  '¡Genial! Has completado todos los hábitos del día. Puedes sentirte muy orgulloso. Mañana seguimos 💪🏻',
  '¡Bravo! Día perfecto. Mantén la racha y descansa; mañana repetimos ✨',
  '¡Lo lograste! Cada check suma. Disfruta esta mini-victoria 🥳',
  '¡Qué máquina! Todos los hábitos listos por hoy. A por el siguiente día 🚀',
  '¡Excelente! Cerraste tus hábitos de hoy. Tu constancia marca la diferencia 🙌',
] as const;

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

/* ===== Helpers de fechas ===== */
const dateKey = (d = new Date()) => d.toISOString().slice(0,10);
const isInRange = (dKey: string, start?: string, end?: string) => {
  if (start && dKey < start) return false;
  if (end && dKey > end) return false;
  return true;
};
const isWeekendDay = (d: Date) => {
  const g = d.getDay(); // 0=Dom, 6=Sáb
  return g === 0 || g === 6;
};
const parseKeyToDate = (k: string) => new Date(k + 'T00:00:00');

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

/* ===== Confeti (import dinámico) ===== */
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
  } catch { /* silencioso */ }
}

/* ===== Pequeño Modal para el mensaje ===== */
function CongratsModal({ open, text, onClose }: { open: boolean; text: string; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative z-[101] w-[92%] max-w-md rounded-2xl border border-black/10 bg-white p-5 text-center shadow-lg">
        <h3 className="mb-2 text-lg font-semibold">¡Felicidades! 🎉</h3>
        <p className="mb-4 text-sm text-black/80">{text}</p>
        <button
          onClick={onClose}
          className="rounded-xl border border-black bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          autoFocus
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

/* ===== Componente principal ===== */
export default function HabitosClient() {
  const [masters, setMasters] = useState<HabitMaster[]>([]);
  const [daily, setDaily] = useState<DailyMap>({});
  const [today, setToday] = useState<string>(dateKey());

  // Usuario (para avatar y nombre)
  const user = (useUserProfile?.() as any) || {};
  const username = user?.username || user?.nombre || 'usuario/a';
  const avatar = user?.foto as string | undefined;

  // Programas activos (placeholder visual por ahora)
  const [activePrograms, setActivePrograms] = useState<string[]>([]);

  // Felicitación
  const [showCongrats, setShowCongrats] = useState(false);
  const [congratsText, setCongratsText] = useState<typeof CONGRATS_MESSAGES[number]>(CONGRATS_MESSAGES[0]);
  const [lastMsgIndex, setLastMsgIndex] = useState<number | null>(null);

  useEffect(() => {
    setMasters(loadMasterHabits());
    setDaily(loadDaily());
    try {
      const raw = localStorage.getItem(LS_ACTIVE_PROGRAMS);
      setActivePrograms(raw ? JSON.parse(raw) : []);
    } catch { setActivePrograms([]); }
  }, []);

  // Asegura que para "hoy" existan entradas de todos los hábitos aplicables
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

  // Semáforo: estado por día ('green'|'orange'|'red'|'gray')
  function dayStatus(dKey: string): 'green' | 'orange' | 'red' | 'gray' {
    const ids = applicableMasterIds(dKey);
    if (ids.length === 0) return 'gray';
    const bucket = daily[dKey] ?? {};
    const doneCount = ids.filter(id => bucket[id]?.done).length;
    if (doneCount === 0) {
      // rojo solo si es un día pasado y no se hizo ninguno
      if (dKey < today) return 'red';
      return 'orange';
    }
    if (doneCount === ids.length) return 'green';
    return 'orange';
  }

  // ✅ dKey ahora es opcional
  function toggleDone(habitId: string, dKey?: string, evt?: React.MouseEvent) {
    const key = dKey ?? today;
    const bucket = daily[key] ?? {};
    const wasDone = !!bucket[habitId]?.done; // estado previo
    let completedAllAfter = false;

    setDaily(prev => {
      const map: DailyMap = { ...prev };
      const b: Record<string, DailyEntry> = { ...(map[key] ?? {}) };
      const current = b[habitId] ?? { done: false };
      const next: DailyEntry = current.done ? { done: false } : { done: true, doneAt: Date.now() };
      b[habitId] = next;
      map[key] = b;

      // ¿Todos hechos ahora?
      const ids = applicableMasterIds(key);
      completedAllAfter = ids.length > 0 && ids.every(id => b[id]?.done === true);

      saveDaily(map);
      return map;
    });

    // confeti normal al marcar
    if (!wasDone) void confettiBurst(evt);

    // si tras el cambio quedaron todos hechos -> confeti grande + popup
    if (!wasDone && completedAllAfter) {
      void confettiBurst(undefined, true);

      // elige un mensaje aleatorio (no repetir el último si se puede)
      const pool = CONGRATS_MESSAGES;
      let idx = Math.floor(Math.random() * pool.length);
      if (lastMsgIndex !== null && pool.length > 1 && idx === lastMsgIndex) {
        idx = (idx + 1) % pool.length;
      }
      setLastMsgIndex(idx);
      setCongratsText(pool[idx]);
      setShowCongrats(true);
    }
  }

  const todayHabits: HabitView[] = useMemo(() => {
    const d = parseKeyToDate(today);
    const bucket = daily[today] ?? {};
    return masters
      .filter(h => isInRange(today, h.startDate, h.endDate))
      .filter(h => !(h.weekend === false && isWeekendDay(d)))
      .map(h => ({ ...h, done: !!bucket[h.id]?.done }));
  }, [masters, daily, today]);

  const formatNoYear = (k: string) =>
    new Date(k + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6" style={{ background: 'white' }}>
      {/* Subnavegación */}
      <nav className="mb-4 flex flex-wrap gap-3">
        <Link
          href="/mizona"
          className="btn"
          style={{ background: 'black', color: 'white', border: '1px solid black' }} // Mis hábitos seleccionado
        >
          Mis hábitos
        </Link>
        <Link
          href="/mizona/logros"
          className="btn"
          style={{ background: 'white', color: 'black', border: '1px solid var(--line)' }}
        >
          Logros
        </Link>
        <Link
          href="/mizona/perfil"
          className="btn"
          style={{ background: 'white', color: 'black', border: '1px solid var(--line)' }}
        >
          Mi perfil
        </Link>
      </nav>

      {/* Perfil compacto (avatar + @username, todo clicable) */}
      <Link
        href="/mizona/perfil"
        className="mb-3 flex items-center gap-3 text-inherit"
        style={{ textDecoration: 'none' }}
        aria-label="Ir a mi perfil"
      >
        <span
          className="rounded-full overflow-hidden flex items-center justify-center"
          style={{ width: 44, height: 44, border: '1px solid var(--line)', background: '#f7f7f7' }}
        >
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="Foto de perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 18, color: '#9ca3af' }}>👤</span>
          )}
        </span>
        <span style={{ fontWeight: 600 }}>@{String(username).trim()}</span>
      </Link>

      {/* Semáforo semanal centrado (sin recuadro) */}
      <div className="mb-5 flex items-center justify-center gap-4">
        {(() => {
          const weekStart = mondayOf(new Date());
          const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
          const labels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
          return days.map((d, i) => {
            const k = dateKey(d);
            const status = dayStatus(k); // 'green'|'orange'|'red'|'gray'
            const bg =
              status === 'green' ? '#10b981' :
              status === 'orange' ? '#f59e0b' :
              status === 'red' ? '#e10600' : '#ffffff';
            const fg = status === 'gray' ? '#111' : '#fff';
            return (
              <div key={k} style={{ textAlign: 'center' }}>
                <div
                  title={`${labels[i]} · ${k}`}
                  style={{
                    width: 40, height: 40, borderRadius: 999,
                    display: 'grid', placeItems: 'center',
                    border: '1px solid #000', background: bg, color: fg,
                    fontSize: 13, fontWeight: 700
                  }}
                >
                  {labels[i]}
                </div>
              </div>
            );
          });
        })()}
      </div>

      {/* Título de hoy */}
      <h3 style={{ marginTop: 0, marginBottom: 10 }}>
        ¿Qué tenemos para hoy {formatNoYear(today)}?
      </h3>

      {/* Hábitos creados por ti */}
      <section className="mb-6">
        <h4 style={{ margin: '6px 0 8px 0' }}>Hábitos creados por ti</h4>
        {masters.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/20 px-4 py-6 text-center text-sm text-black/60">
            No tienes hábitos creados todavía. Ve a{' '}
            <Link href="/mizona/crear-habitos" className="font-medium underline">Crear mis hábitos</Link>.
          </div>
        ) : todayHabits.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/20 px-4 py-6 text-center text-sm text-black/60">
            No hay hábitos programados para hoy (según rango o fin de semana).
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

      {/* Programas activos (placeholder hasta vincular hábitos de programa) */}
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

      {/* Enlace crear/editar */}
      <div className="mt-6">
        <Link
          href="/mizona/crear-habitos"
          className="rounded-full border border-black/20 bg-white px-4 py-2 text-sm hover:bg-black/5"
        >
          Crear/editar hábitos
        </Link>
      </div>

      {/* Modal de felicitación */}
      <CongratsModal
        open={showCongrats}
        text={congratsText}
        onClose={() => setShowCongrats(false)}
      />
    </main>
  );
}
