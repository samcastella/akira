// src/components/mizona/CalendarLite.tsx
'use client';

import { useMemo, useState } from 'react';

type DayState = 'none' | 'some' | 'all' | 'missed';

export default function CalendarLite({
  dayStatus,
}: {
  /** Estado por día para colorear el calendario */
  dayStatus?: (d: Date) => DayState;
}) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const { year, month, monthLabel, cells } = useMemo(() => {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const monthLabel = cursor.toLocaleString('es-ES', { month: 'long' });

    // Primer día del mes y cálculo de desplazamiento (semana empieza en Lunes)
    const first = new Date(y, m, 1);
    const start = (first.getDay() + 6) % 7; // L=0..D=6

    const daysInMonth = new Date(y, m + 1, 0).getDate();

    // Construimos celdas con su Date correspondiente o null si es hueco
    const arr: (Date | null)[] = [];
    for (let i = 0; i < start; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(y, m, d));
    while (arr.length % 7) arr.push(null);

    return { year: y, month: m, monthLabel, cells: arr };
  }, [cursor]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  function prev() {
    setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function next() {
    setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  // Mapea estado → clases de fondo/borde
  function clsFor(date: Date | null): string {
    if (!date) return '';
    const base = 'ak-calendar-day aspect-square rounded-full text-sm flex items-center justify-center';

    const dClean = new Date(date);
    dClean.setHours(0, 0, 0, 0);
    const isToday = dClean.getTime() === today;

    const state: DayState | undefined = dayStatus ? dayStatus(dClean) : undefined;

    const bg =
      state === 'all'
        ? 'bg-green-200'
        : state === 'some'
        ? 'bg-orange-200'
        : state === 'missed'
        ? 'bg-red-200'
        : state === 'none'
        ? 'bg-neutral-200'
        : 'bg-neutral-100';

    const ring = isToday ? 'ring-2 ring-black/10' : '';

    return `${base} ${bg} ${ring} text-neutral-900`;
  }

  return (
    <div className="rounded-2xl border border-neutral-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[15px] font-semibold capitalize">
          {monthLabel} {year}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={prev}
            className="w-8 h-8 rounded-full border border-neutral-300 grid place-items-center hover:bg-neutral-50"
            aria-label="Mes anterior"
          >
            ‹
          </button>
          <button
            onClick={next}
            className="w-8 h-8 rounded-full border border-neutral-300 grid place-items-center hover:bg-neutral-50"
            aria-label="Mes siguiente"
          >
            ›
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
          <div key={d} className="text-xs font-medium text-neutral-600">
            {d}
          </div>
        ))}

        {cells.map((date, i) => {
          const label = date ? String(date.getDate()) : '';
          // Celdas vacías mantienen el hueco sin estilos
          if (!date) {
            return (
              <div
                key={i}
                className="aspect-square rounded-full text-sm grid place-items-center text-neutral-400"
                aria-hidden
              />
            );
          }
          return (
            <div key={i} className={clsFor(date)} title={label}>
              {label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
