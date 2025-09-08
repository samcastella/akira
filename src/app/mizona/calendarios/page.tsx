// src/app/mizona/calendarios/page.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { HabitMaster } from '@/components/habits/HabitForm';

const LS_HABITS_MASTER = 'akira_habits_master_v1';
const LS_HABITS_DAILY  = 'akira_habits_daily_v1';

type DailyEntry = { done: boolean; doneAt?: number };
type DailyMap = Record<string, Record<string, DailyEntry>>;

/* ====== Storage ====== */
function loadMasterHabits(): HabitMaster[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(LS_HABITS_MASTER) || '[]'); } catch { return []; }
}
function loadDaily(): DailyMap {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(LS_HABITS_DAILY) || '{}'); } catch { return {}; }
}
function saveDaily(map: DailyMap) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_HABITS_DAILY, JSON.stringify(map));
}

/* ====== Fechas ====== */
const dateKey = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const parseKeyToDate = (k: string) => new Date(`${k}T00:00:00`);
const isInRange = (dKey: string, start?: string, end?: string) => {
  if (start && dKey < start) return false;
  if (end && dKey > end) return false;
  return true;
};
const isWeekendDay = (d: Date) => {
  const g = d.getDay(); // 0=Dom, 6=Sáb
  return g === 0 || g === 6;
};
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

type HabitView = HabitMaster & {};

/* ====== Página ====== */
export default function CalendariosPage() {
  const [masters, setMasters] = useState<HabitMaster[]>([]);
  const [daily, setDaily] = useState<DailyMap>({});
  const [today, setToday] = useState<string>(dateKey());
  const [selectedDay, setSelectedDay] = useState<string>(today);

  // Rollover a medianoche
  const midnightTimer = useRef<number | null>(null);
  useEffect(() => {
    const schedule = () => {
      const now = new Date();
      const next = new Date(now);
      next.setHours(24, 0, 0, 0);
      const ms = next.getTime() - now.getTime();
      midnightTimer.current = window.setTimeout(() => {
        const t = dateKey();
        setToday(t);
        // si estás en el día actual, también actualizamos selectedDay
        setSelectedDay(sd => (sd > t ? t : sd));
        schedule();
      }, ms + 1000);
    };
    schedule();
    return () => { if (midnightTimer.current) window.clearTimeout(midnightTimer.current); };
  }, []);

  useEffect(() => {
    setMasters(loadMasterHabits());
    setDaily(loadDaily());
  }, []);

  // asegurar bucket para una fecha
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

  // semana activa basada en selectedDay
  const weekStart = useMemo(() => mondayOf(parseKeyToDate(selectedDay)), [selectedDay]);
  const weekKeys = useMemo(
    () => Array.from({ length: 7 }, (_, i) => dateKey(addDays(weekStart, i))),
    [weekStart]
  );

  // hábitos aplicables a lo largo de la semana (si aplican al menos un día)
  const weekHabits: HabitView[] = useMemo(() => {
    const anyApplies = (h: HabitMaster) =>
      weekKeys.some(k => {
        const d = parseKeyToDate(k);
        return isInRange(k, h.startDate, h.endDate) && !(h.weekend === false && isWeekendDay(d));
      });
    return masters.filter(anyApplies);
  }, [masters, weekKeys]);

  // construir calendario mensual
  const [monthCursor, setMonthCursor] = useState<Date>(() => {
    const t = parseKeyToDate(today);
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });
  useEffect(() => {
    const t = parseKeyToDate(selectedDay);
    setMonthCursor(new Date(t.getFullYear(), t.getMonth(), 1));
  }, [selectedDay]);

  function monthLabel(d: Date) {
    return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  }
  function prevMonth() { setMonthCursor(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)); }
  function nextMonth() { setMonthCursor(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)); }

  function buildMonthGrid(base: Date): (string | null)[] {
    const y = base.getFullYear();
    const m = base.getMonth();
    const first = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 0).getDate();
    const offsetMon0 = (first.getDay() + 6) % 7; // 0=lunes
    const cells: (string | null)[] = [];
    for (let i = 0; i < offsetMon0; i++) cells.push(null);
    for (let d = 1; d <= lastDay; d++) cells.push(dateKey(new Date(y, m, d)));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }
  const monthCells = useMemo(() => buildMonthGrid(monthCursor), [monthCursor]);

  // estilos
  const BORDER = '#E5E7EB';
  const labels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  // asegurar buckets visibles
  useEffect(() => {
    weekKeys.forEach(k => ensureDailyForDate(k));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKeys.join('|'), masters.length]);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 sm:px-6 md:px-8 py-6" style={{ background: 'white' }}>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="page-title m-0">Calendarios</h1>
        <Link href="/mizona" className="btn secondary">Volver a Mis hábitos</Link>
      </div>

      {/* Calendario mensual */}
      <section className="mb-6">
        <div className="mb-2 text-center text-sm font-medium">{monthLabel(monthCursor)}</div>

        <div className="mx-auto relative" style={{ maxWidth: 720 }}>
          <button
            type="button"
            onClick={prevMonth}
            aria-label="Mes anterior"
            className="absolute left-0"
            style={{ top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', padding: 6, cursor: 'pointer', zIndex: 2, fontSize: 18 }}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={nextMonth}
            aria-label="Mes siguiente"
            className="absolute right-0"
            style={{ top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', padding: 6, cursor: 'pointer', zIndex: 2, fontSize: 18 }}
          >
            ›
          </button>

          <div className="grid grid-cols-7 gap-2 px-6">
            {monthCells.map((k, idx) => {
              if (!k) return <div key={`x-${idx}`} style={{ width: '100%', aspectRatio: '1 / 1' }} />;
              const dNum = Number(k.slice(-2));
              const future = k > today;
              const isSelected = (() => {
                const sd = parseKeyToDate(selectedDay);
                const cur = parseKeyToDate(k);
                // marcar seleccionado si pertenece a la misma semana que selectedDay
                const a = mondayOf(sd).getTime();
                const b = mondayOf(cur).getTime();
                return a === b;
              })();

              return (
                <button
                  key={k}
                  onClick={() => setSelectedDay(k)}
                  title={k}
                  aria-label={`Seleccionar semana de ${k}`}
                  style={{
                    width: '100%', aspectRatio: '1 / 1',
                    display: 'grid', placeItems: 'center',
                    borderRadius: 12,
                    border: `1px solid ${BORDER}`,
                    background: future ? '#ffffff' : '#ffffff',
                    color: '#111',
                    fontWeight: 700, fontSize: 12,
                    outline: isSelected ? `2px solid ${BORDER}` : 'none', outlineOffset: 2,
                  }}
                >
                  {dNum}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Tabla semanal: hábitos × (L..D) */}
      <section>
        <div className="mb-2 text-sm text-black/70">
          Semana del <strong>{mondayOf(parseKeyToDate(selectedDay)).toLocaleDateString('es-ES')}</strong>
        </div>

        <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: BORDER }}>
          <table className="w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr style={{ background: '#fafafa' }}>
                <th className="text-left p-3 border-b" style={{ borderColor: BORDER, minWidth: 160 }}>Hábito</th>
                {labels.map(l => (
                  <th key={l} className="p-3 border-b text-center" style={{ borderColor: BORDER, width: 48 }}>{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weekHabits.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-black/60">
                    No hay hábitos aplicables en esta semana.
                  </td>
                </tr>
              ) : weekHabits.map(h => {
                return (
                  <tr key={h.id}>
                    <td className="p-3 border-b" style={{ borderColor: BORDER }}>
                      <span className="mr-2">{h.icon ?? '🧩'}</span>{h.name}
                    </td>
                    {weekKeys.map(k => {
                      const d = parseKeyToDate(k);
                      const applies =
                        isInRange(k, h.startDate, h.endDate) &&
                        !(h.weekend === false && isWeekendDay(d));
                      const cell = daily[k]?.[h.id];
                      const isFuture = k > today;

                      let content: React.ReactNode = '';
                      if (!applies) {
                        content = <span className="text-black/30">—</span>;
                      } else if (isFuture) {
                        content = ''; // futuro en blanco
                      } else if (cell?.done) {
                        content = <span aria-label="Hecho" title="Hecho" style={{ color: '#16a34a', fontWeight: 800 }}>✓</span>;
                      } else {
                        content = <span aria-label="No hecho" title="No hecho" style={{ color: '#e10600', fontWeight: 800 }}>✕</span>;
                      }

                      return (
                        <td key={k} className="p-3 border-b text-center align-middle" style={{ borderColor: BORDER }}>
                          {content}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-2 text-xs text-black/60">
          Nota: Los días futuros aparecen en blanco; los no aplicables muestran “—”.
        </p>
      </section>
    </main>
  );
}
