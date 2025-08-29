'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, dateKey } from '@/lib/date';
import { dayColorStatus, PROGRAMS, loadStore } from '@/lib/programs';
import { LEGACY_TO_SLUG } from '@/lib/programs_map';
import DayDetailModal, { type DayProgramItem } from './DayDetailModal';
import Link from 'next/link';

// Helpers internos
function monthLabel(d: Date) {
  return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfCalendar(d: Date) {
  // Lunes como primer día
  const first = startOfMonth(d);
  const js = first.getDay(); // 0..6 (dom..sáb)
  const offset = (js + 6) % 7; // 0 si lunes
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  return start;
}

/* ====== integración con motor legacy (acciones) ====== */
import { saveStore, getRelativeDayIndexForDate } from '@/lib/programs';

function markLegacyDayDone(legacyKey: string, dateStr: string) {
  const store = loadStore();
  const prog = PROGRAMS[legacyKey];
  if (!store[legacyKey] || !prog) return;
  const dayIdx = getRelativeDayIndexForDate(legacyKey, dateStr);
  if (dayIdx < 1) return;
  const tasksCount = prog.days[dayIdx - 1]?.tasks.length ?? 0;
  if (!store[legacyKey].completedByDate) store[legacyKey].completedByDate = {};
  const already = new Set(store[legacyKey].completedByDate[dateStr] ?? []);
  for (let i = 0; i < tasksCount; i++) already.add(i);
  store[legacyKey].completedByDate[dateStr] = Array.from(already).sort((a, b) => a - b);
  saveStore(store);
}
function unmarkLegacyDay(legacyKey: string, dateStr: string) {
  const store = loadStore();
  if (!store[legacyKey]) return;
  if (store[legacyKey].completedByDate) {
    store[legacyKey].completedByDate[dateStr] = [];
    saveStore(store);
  }
}

export default function Calendar() {
  const [cursor, setCursor] = useState(() => new Date());
  const [openDay, setOpenDay] = useState<string | null>(null); // YYYY-MM-DD
  const start = useMemo(() => startOfCalendar(cursor), [cursor]);

  const days = useMemo(() => {
    // 6 semanas * 7 días = 42 celdas
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [start]);

  const month = cursor.getMonth();

  function buildItemsForDate(dateStr: string): DayProgramItem[] {
    const store = loadStore();
    const items: DayProgramItem[] = [];
    for (const legacyKey of Object.keys(store)) {
      const progDef = PROGRAMS[legacyKey];
      if (!progDef) continue;
      const dayIdx = getRelativeDayIndexForDate(legacyKey, dateStr);
      if (dayIdx < 1) continue; // aún no está dentro del plan
      const tasksCount = progDef.days[dayIdx - 1]?.tasks.length ?? 0;
      const doneCount = (store[legacyKey].completedByDate?.[dateStr] ?? []).length;
      const slug = LEGACY_TO_SLUG[legacyKey];
      const title = slug ? `Programa ${legacyKey}` : `Programa ${legacyKey}`;
      items.push({ legacyKey, title: progDef.name ?? `Programa ${legacyKey}`, slug, tasksCount, doneCount });
    }
    return items;
  }

  const cellFor = (d: Date) => {
    const key = dateKey(d);
    const status = dayColorStatus(key); // 'empty' | 'none' | 'some' | 'all'
    let dot = '#d1d5db'; // gris por defecto (empty)
    if (status === 'none') dot = '#ef4444';     // rojo
    if (status === 'some') dot = '#f59e0b';     // ámbar
    if (status === 'all')  dot = '#10b981';     // verde

    const isOtherMonth = d.getMonth() !== month;

    return (
      <button
        key={key}
        onClick={() => setOpenDay(key)}
        style={{
          padding: 8,
          borderTop: '1px solid var(--line)',
          borderLeft: '1px solid var(--line)',
          background: 'transparent',
          opacity: isOtherMonth ? 0.5 : 1,
          minHeight: 44,
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12 }}>{d.getDate()}</span>
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: dot,
              display: 'inline-block',
            }}
          />
        </div>
      </button>
    );
  };

  const items = openDay ? buildItemsForDate(openDay) : [];

  return (
    <section style={{ marginTop: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <strong>Calendario</strong>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="btn"
            onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            title="Mes anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="muted" style={{ minWidth: 140, textAlign: 'center' }}>
            {monthLabel(cursor)}
          </span>
          <button
            className="btn"
            onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            title="Mes siguiente"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Cabecera lunes..domingo */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          textTransform: 'uppercase',
          fontSize: 11,
          color: '#6b7280',
          marginBottom: 4,
          gap: 0,
        }}
      >
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
          <div key={d} style={{ padding: '6px 8px' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Grilla 7x6 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          borderRight: '1px solid var(--line)',
          borderBottom: '1px solid var(--line)',
          borderTop: '1px solid var(--line)',
        }}
      >
        {days.map(cellFor)}
      </div>

      {/* Leyenda */}
      <div className="muted" style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 12 }}>
        <LegendDot color="#ef4444" label="Nada hecho" />
        <LegendDot color="#f59e0b" label="Parcial" />
        <LegendDot color="#10b981" label="Todo hecho" />
      </div>

      {/* Modal de detalle por día */}
      {openDay && (
        <DayDetailModal
          dateStr={openDay}
          items={items}
          onClose={() => setOpenDay(null)}
          onMarkAll={(legacyKey) => {
            markLegacyDayDone(legacyKey, openDay);
            // fuerza refresco de leyenda recomputando estado
            setOpenDay((prev) => prev && prev); // noop para re-render
          }}
          onClear={(legacyKey) => {
            unmarkLegacyDay(legacyKey, openDay);
            setOpenDay((prev) => prev && prev);
          }}
        />
      )}
    </section>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <i style={{ width: 8, height: 8, borderRadius: 999, background: color, display: 'inline-block' }} />
      {label}
    </span>
  );
}
