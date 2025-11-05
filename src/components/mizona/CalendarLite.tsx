// src/components/mizona/CalendarLite.tsx
'use client';

import { useMemo, useState } from 'react';

export default function CalendarLite() {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const { year, monthLabel, grid } = useMemo(() => {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const monthLabel = cursor.toLocaleString('es-ES', { month: 'long' });
    const first = new Date(y, m, 1);
    const start = (first.getDay() + 6) % 7; // L=0..D=6
    const days = new Date(y, m + 1, 0).getDate();
    const cells = Array.from({ length: start + days }, (_, i) => (i < start ? '' : String(i - start + 1)));
    while (cells.length % 7) cells.push('');
    const rows: string[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return { year: y, monthLabel, grid: rows };
  }, [cursor]);

  function prev() {
    setCursor(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function next() {
    setCursor(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  return (
    <div className="rounded-2xl border border-neutral-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[15px] font-semibold capitalize">{monthLabel} {year}</div>
        <div className="flex items-center gap-2">
          <button onClick={prev} className="w-8 h-8 rounded-full border border-neutral-300 grid place-items-center hover:bg-neutral-50" aria-label="Mes anterior">‹</button>
          <button onClick={next} className="w-8 h-8 rounded-full border border-neutral-300 grid place-items-center hover:bg-neutral-50" aria-label="Mes siguiente">›</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2 text-center">
        {['L','M','X','J','V','S','D'].map(d=>(
          <div key={d} className="text-xs font-medium text-neutral-600">{d}</div>
        ))}
        {grid.flat().map((day, i) => (
          <div key={i} className={`aspect-square rounded-full ${day ? 'bg-rose-100 text-neutral-800' : ''} text-sm grid place-items-center`}>
            {day || ''}
          </div>
        ))}
      </div>
    </div>
  );
}
