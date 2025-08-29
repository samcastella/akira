'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Check, RotateCcw, Trash2 } from 'lucide-react';

/* ====== storage + tipos ====== */
const LS_RETOS = 'akira_mizona_retos_v1';
type Reto = { id: string; text: string; createdAt: number; due: string; done: boolean; permanent?: boolean };

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

/* ====== página ====== */
export default function MiZonaPage() {
  const [retos, setRetos] = useState<Reto[]>(() => loadLS<Reto[]>(LS_RETOS, []));
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

  /* === lógica clave: completar y recrear si es permanente === */
  function completeReto(id: string) {
    setRetos(prev => {
      const idx = prev.findIndex(r => r.id === id);
      if (idx === -1) return prev;
      const r = prev[idx];

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
        // Lo ponemos arriba para que aparezca primero en listas
        updated.unshift(clone);
      }
      return updated;
    });
  }

  function undoReto(id: string) {
    setRetos(prev => prev.map(r => r.id === id ? { ...r, done: false } : r));
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
