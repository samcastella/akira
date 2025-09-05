'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import type { HabitMaster } from '@/components/habits/HabitForm';

const LS_HABITS_MASTER = 'akira_habits_master_v1';
const LS_HABITS_DAILY  = 'akira_habits_daily_v1'; // { [yyyy-mm-dd]: { [habitId]: { done, doneAt? } } }

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

  // Felicitación
  const [showCongrats, setShowCongrats] = useState(false);
  const [congratsText, setCongratsText] = useState<typeof CONGRATS_MESSAGES[number]>(CONGRATS_MESSAGES[0]);
  const [lastMsgIndex, setLastMsgIndex] = useState<number | null>(null);

  useEffect(() => {
    setMasters(loadMasterHabits());
    setDaily(loadDaily());
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

  function moveDay(delta: number) {
    const d = parseKeyToDate(today);
    d.setDate(d.getDate() + delta);
    const k = dateKey(d);
    setToday(k);
    ensureDailyForDate(k);
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6" style={{ background: 'white' }}>
      <div className="mb-4">
        <h2 className="page-title" style={{ marginBottom: 6 }}>Mis hábitos</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Marca los hábitos de hoy. Los colores e iconos vienen del hábito raíz que creaste.
        </p>
      </div>

      {/* Navegación de fecha */}
      <div className="mb-4 flex items-center justify-between">
        <button
          className="rounded-full border border-black/20 bg-white px-3 py-1 text-sm hover:bg-black/5"
          onClick={() => moveDay(-1)}
        >
          ← Ayer
        </button>
        <div className="text-sm font-semibold">
          {parseKeyToDate(today).toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'short' })}
        </div>
        <button
          className="rounded-full border border-black/20 bg-white px-3 py-1 text-sm hover:bg-black/5"
          onClick={() => moveDay(+1)}
        >
          Mañana →
        </button>
      </div>

      {/* Si no hay masters */}
      {masters.length === 0 && (
        <div className="rounded-2xl border border-dashed border-black/20 px-4 py-6 text-center text-sm text-black/60">
          No tienes hábitos creados todavía. Ve a{' '}
          <Link href="/mizona/crear-habitos" className="font-medium underline">
            Crear mis hábitos
          </Link>.
        </div>
      )}

      {/* Lista de hoy */}
      {masters.length > 0 && (
        <ul className="space-y-3">
          {todayHabits.length === 0 ? (
            <li className="rounded-2xl border border-dashed border-black/20 px-4 py-6 text-center text-sm text-black/60">
              No hay hábitos programados para hoy (según rango o fin de semana).
            </li>
          ) : (
            todayHabits.map((h) => {
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
            })
          )}
        </ul>
      )}

      {/* Enlace de vuelta */}
      <div className="mt-8">
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
