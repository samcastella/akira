'use client';

import { useMemo, useState } from 'react';

type DayStatus = 'none' | 'some' | 'all' | 'missed';
type Mode = 'month' | 'rolling4w';

export default function CalendarLite({
  dayStatus,
  mode = 'month',
  endDate, // sólo para rolling4w; por defecto hoy
}: {
  dayStatus?: (date: Date) => DayStatus;
  mode?: Mode;
  endDate?: Date;
}) {
  /* ===== Estado y helpers comunes ===== */
  const today = new Date();

  // Cursor para 'month': primer día del mes visible
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  // Para 'rolling4w': fin de la ventana (incluido). Por defecto, hoy.
  const [endCursor, setEndCursor] = useState<Date>(() => (endDate ? startOfDay(endDate) : startOfDay(today)));

  /* ===== Renderizado por modos ===== */
  if (mode === 'rolling4w') {
    // Construimos 4x7 días hacia atrás desde endCursor (incluido)
    const { grid, rangeLabel } = useMemo(() => {
      const end = startOfDay(endCursor);
      const cells: Array<{ label: string; date: Date }> = [];
      for (let i = 27; i >= 0; i--) {
        const d = addDays(end, -i);
        cells.push({ label: String(d.getDate()), date: d });
      }
      const rows: typeof cells[] = [];
      for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
      const start = addDays(end, -27);
      const rangeLabel = `${fmtDDMM(start)} → ${fmtDDMM(end)}`;
      return { grid: rows, rangeLabel };
    }, [endCursor]);

    function prev28() { setEndCursor((d) => addDays(d, -28)); }
    function next28() { setEndCursor((d) => addDays(d, +28)); }

    return (
      <div className="rounded-2xl border border-neutral-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[15px] font-semibold">{rangeLabel}</div>
          <div className="flex items-center gap-2">
            <button onClick={prev28} className="w-8 h-8 rounded-full border border-neutral-300 grid place-items-center hover:bg-neutral-50" aria-label="Ventana anterior">‹</button>
            <button onClick={next28} className="w-8 h-8 rounded-full border border-neutral-300 grid place-items-center hover:bg-neutral-50" aria-label="Ventana siguiente">›</button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2 text-center">
          {['L','M','X','J','V','S','D'].map(d => (
            <div key={d} className="text-xs font-medium text-neutral-600">{d}</div>
          ))}

          {grid.flat().map((cell, i) => (
            <div
              key={i}
              className={[
                'ak-calendar-day',
                'aspect-square',
                'rounded-full',
                'text-sm',
                'grid place-items-center',
                'leading-none',
                colorFor(dayStatus, cell.date),
              ].join(' ')}
            >
              {cell.label}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ===== Modo 'month' por defecto =====
  const { year, monthLabel, grid } = useMemo(() => {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const monthLabel = cursor.toLocaleString('es-ES', { month: 'long' });
    const first = new Date(y, m, 1);
    const start = (first.getDay() + 6) % 7; // L=0..D=6
    const days = new Date(y, m + 1, 0).getDate();

    const cells: Array<{ label: string; date: Date | null }> = [];
    for (let i = 0; i < start; i++) cells.push({ label: '', date: null });
    for (let d = 1; d <= days; d++) cells.push({ label: String(d), date: new Date(y, m, d) });
    while (cells.length % 7) cells.push({ label: '', date: null });

    const rows: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

    return { year: y, monthLabel, grid: rows };
  }, [cursor]);

  function prevMonth() { setCursor(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)); }
  function nextMonth() { setCursor(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)); }

  return (
    <div className="rounded-2xl border border-neutral-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[15px] font-semibold capitalize">{monthLabel} {year}</div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="w-8 h-8 rounded-full border border-neutral-300 grid place-items-center hover:bg-neutral-50" aria-label="Mes anterior">‹</button>
          <button onClick={nextMonth} className="w-8 h-8 rounded-full border border-neutral-300 grid place-items-center hover:bg-neutral-50" aria-label="Mes siguiente">›</button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center">
        {['L','M','X','J','V','S','D'].map(d => (
          <div key={d} className="text-xs font-medium text-neutral-600">{d}</div>
        ))}

        {grid.flat().map((cell, i) => (
          <div
            key={i}
            className={[
              'ak-calendar-day',
              'aspect-square',
              'rounded-full',
              'text-sm',
              'grid place-items-center',
              'leading-none',
              cell.date ? colorFor(dayStatus, cell.date) : '',
            ].join(' ')}
          >
            {cell.label || ''}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===== helpers internos ===== */
function startOfDay(d: Date) {
  const x = new Date(d); x.setHours(0,0,0,0); return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d); x.setDate(x.getDate() + n); return x;
}
function fmtDDMM(d: Date) {
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
}
function colorFor(dayStatus?: (date: Date) => DayStatus, date?: Date | null): string {
  if (!date || !dayStatus) return '';
  const s = dayStatus(date);
  switch (s) {
    case 'some': return 'bg-orange-200 text-neutral-900';
    case 'all': return 'bg-green-200 text-neutral-900';
    case 'missed': return 'bg-red-200 text-neutral-900';
    default: return 'bg-neutral-200 text-neutral-700';
  }
}
