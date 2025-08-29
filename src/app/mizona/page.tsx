'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Check, RotateCcw, Trash2, ExternalLink } from 'lucide-react';
import Link from 'next/link';

/* ====== storage + tipos ====== */
const LS_RETOS = 'akira_mizona_retos_v1';
type Reto = {
  id: string;
  text: string;
  createdAt: number;
  due: string;
  done: boolean;
  permanent?: boolean;
};

function loadLS<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function saveLS<T>(key: string, val: T) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(val));
}

const todayKey = () => new Date().toISOString().slice(0,10);
const fmtDate = (d: string | number) =>
  new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '');

/* ====== integración con motor legacy ====== */
import { PROGRAMS, loadStore, saveStore, getRelativeDayIndexForDate } from '@/lib/programs';
import { LEGACY_TO_SLUG } from '@/lib/programs_map';

/** Marca TODAS las tareas del día (para una fecha concreta) como hechas en el motor legacy */
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

/** Desmarca todas las tareas del día en el motor legacy (para una fecha concreta) */
function unmarkLegacyDay(legacyKey: string, dateStr: string) {
  const store = loadStore();
  if (!store[legacyKey]) return;
  if (store[legacyKey].completedByDate) {
    store[legacyKey].completedByDate[dateStr] = [];
    saveStore(store);
  }
}

/** Extrae el slug del programa a partir del id del reto si es de programa */
function slugFromRetoId(id: string): string | null {
  const m = /^prog:([^:]+):(\d{4}-\d{2}-\d{2})$/.exec(id);
  if (!m) return null;
  const legacyKey = m[1];
  return LEGACY_TO_SLUG[legacyKey] ?? null;
}

/* ====== página ====== */
export default function MiZonaPage() {
  // Normaliza retos del orquestador (pueden venir sin due/done)
  const [retos, setRetos] = useState<Reto[]>(() => {
    const raw = loadLS<any[]>(LS_RETOS, []);
    const today = todayKey();
    const normalized: Reto[] = raw.map((r) => ({
      id: r.id,
      text: r.text,
      createdAt: r.createdAt ?? Date.now(),
      due: r.due ?? today,
      done: r.done ?? false,
      permanent: r.permanent ?? false,
    }));
    // guarda normalizados para futuras lecturas
    saveLS(LS_RETOS, normalized);
    return normalized;
  });

  useEffect(() => { saveLS(LS_RETOS, retos); }, [retos]);

  const today = todayKey();

  const atrasados = useMemo(
    () => retos.filter(r => !r.done && r.due < today).sort((a,b)=>a.due.localeCompare(b.due)),
    [retos, today]
  );
  const hoy = useMemo(
    () => retos.filter(r => !r.done && r.due === today),
    [retos, today]
  );
  const proximos = useMemo(
    () => retos.filter(r => !r.done && r.due > today).sort((a,b)=>a.due.localeCompare(b.due)),
    [retos, today]
  );
  const hechos = useMemo(
    () => retos.filter(r => r.done).sort((a,b)=>b.createdAt - a.createdAt),
    [retos]
  );

  /* === completar / deshacer + sincronización con motor legacy si es reto de programa === */
  function completeReto(id: string) {
    setRetos(prev => {
      const idx = prev.findIndex(r => r.id === id);
      if (idx === -1) return prev;
      const r = prev[idx];

      const m = /^prog:([^:]+):(\d{4}-\d{2}-\d{2})$/.exec(r.id);
      if (m) {
        const legacyKey = m[1];
        const dateStr = m[2] || r.due;
        markLegacyDayDone(legacyKey, dateStr);
      }

      const updated = [...prev];
      updated[idx] = { ...r, done: true };

      if (r.permanent) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const clone: Reto = {
          id: crypto.randomUUID(),
          text: r.text,
          createdAt: Date.now(),
          due: tomorrow.toISOString().slice(0,10),
          done: false,
          permanent: true,
        };
        updated.unshift(clone);
      }
      return updated;
    });
  }

  function undoReto(id: string) {
    setRetos(prev => {
      const idx = prev.findIndex(r => r.id === id);
      if (idx === -1) return prev;
      const r = prev[idx];

      const m = /^prog:([^:]+):(\d{4}-\d{2}-\d{2})$/.exec(r.id);
      if (m) {
        const legacyKey = m[1];
        const dateStr = m[2] || r.due;
        unmarkLegacyDay(legacyKey, dateStr);
      }

      const updated = [...prev];
      updated[idx] = { ...r, done: false };
      return updated;
    });
  }

  function deleteReto(id: string) {
    setRetos(prev => prev.filter(r => r.id !== id));
  }

  return (
    <main className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <h2 className="page-title">Mi zona</h2>

      {/* Panel blanco, ancho completo dentro del container, SIN borde */}
      <section
        style={{
          background: 'var(--background)',
          borderRadius: 'var(--radius-card)',
          padding: 18,
          border: 'none',
        }}
      >
        <p className="muted" style={{ marginTop: 0 }}>
          Tus retos diarios. Marca como hecho y, si es permanente, se recreará automáticamente para mañana.
        </p>

        <Section title="Atrasados" empty="No tienes retos atrasados.">
          {atrasados.map(r => (
            <RetoItem
              key={r.id}
              reto={r}
              onDone={() => completeReto(r.id)}
              onUndo={() => undoReto(r.id)}
              onDelete={() => deleteReto(r.id)}
            />
          ))}
        </Section>

        <Section title={`Hoy · ${fmtDate(today)}`} empty="Nada para hoy.">
          {hoy.map(r => (
            <RetoItem
              key={r.id}
              reto={r}
              onDone={() => completeReto(r.id)}
              onUndo={() => undoReto(r.id)}
              onDelete={() => deleteReto(r.id)}
            />
          ))}
        </Section>

        <Section title="Próximos" empty="Sin retos próximos.">
          {proximos.map(r => (
            <RetoItem
              key={r.id}
              reto={r}
              onDone={() => completeReto(r.id)}
              onUndo={() => undoReto(r.id)}
              onDelete={() => deleteReto(r.id)}
            />
          ))}
        </Section>

        <Section title="Hechos" empty="Aún no has completado retos.">
          {hechos.map(r => (
            <RetoItem
              key={r.id}
              reto={r}
              done
              onDone={() => completeReto(r.id)}
              onUndo={() => undoReto(r.id)}
              onDelete={() => deleteReto(r.id)}
            />
          ))}
        </Section>
      </section>
    </main>
  );
}

/* ====== UI ====== */
function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const has =
    Array.isArray(children) ? (children as React.ReactNode[]).length > 0 : !!children;
  return (
    <section style={{ marginTop: 16 }}>
      <h3 style={{ marginTop: 0, marginBottom: 8 }}>{title}</h3>
      <ul className="list" style={{ margin: 0 }}>
        {has ? children : <li className="muted" style={{ padding: '8px 0' }}>{empty}</li>}
      </ul>
    </section>
  );
}

function RetoItem({
  reto, done = false, onDone, onUndo, onDelete
}: {
  reto: Reto;
  done?: boolean;
  onDone: () => void;
  onUndo: () => void;
  onDelete: () => void;
}) {
  const programSlug = slugFromRetoId(reto.id);

  return (
    <li
      style={{
        padding: '10px 0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        borderTop: '1px solid var(--line)'
      }}
    >
      <div>
        <div>
          <span style={{ textDecoration: done ? 'line-through' : 'none' }}>{reto.text}</span>
          {reto.permanent && <span className="badge" style={{ marginLeft: 8 }}>permanente</span>}
        </div>
        <small className="muted">Para: {fmtDate(reto.due)}</small>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {/* Acceso directo al programa si aplica */}
        {programSlug && (
          <Link href={`/habitos/${programSlug}`} className="btn" title="Ir al programa">
            <ExternalLink size={16} />
          </Link>
        )}
        {!done ? (
          <button className="btn" onClick={onDone} title="Marcar como hecho"><Check size={16} /></button>
        ) : (
          <button className="btn secondary" onClick={onUndo} title="Deshacer"><RotateCcw size={16} /></button>
        )}
        <button className="btn red" onClick={onDelete} title="Eliminar"><Trash2 size={16} /></button>
      </div>
    </li>
  );
}
