'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, RotateCcw, Trash2 } from 'lucide-react';

/** Clave de almacenamiento compartida con Mi zona */
const LS_RETOS = 'akira_mizona_retos_v1';

/** Formato de reto (compatible con Mi zona) */
export type Reto = {
  id: string;
  text: string;
  createdAt: number;
  due: string;         // YYYY-MM-DD
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

/* ====== integración con motor legacy (opcional si el id viene de un programa) ====== */
import { PROGRAMS, loadStore, saveStore, getRelativeDayIndexForDate } from '@/lib/programs';

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

/** Checklist autónoma de los retos de HOY (lee y escribe en localStorage) */
export default function TodayChecklist() {
  // Normaliza por si el orquestador creó retos sin due/done
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
    saveLS(LS_RETOS, normalized);
    return normalized;
  });
  useEffect(() => { saveLS(LS_RETOS, retos); }, [retos]);

  const today = todayKey();
  const hoy = useMemo(() => retos.filter(r => r.due === today).sort((a,b)=>a.createdAt - b.createdAt), [retos, today]);
  const hechos = hoy.filter(r => r.done);
  const pendientes = hoy.filter(r => !r.done);

  function completeReto(id: string) {
    setRetos(prev => {
      const idx = prev.findIndex(r => r.id === id);
      if (idx === -1) return prev;
      const r = prev[idx];

      const m = /^prog:([^:]+):(\d{4}-\d{2}-\d{2})$/.exec(r.id);
      if (m) markLegacyDayDone(m[1], m[2] || r.due);

      const updated = [...prev];
      updated[idx] = { ...r, done: true };

      if (r.permanent) {
        const t = new Date(); t.setDate(t.getDate() + 1);
        updated.unshift({
          id: crypto.randomUUID(),
          text: r.text,
          createdAt: Date.now(),
          due: t.toISOString().slice(0,10),
          done: false,
          permanent: true,
        });
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
      if (m) unmarkLegacyDay(m[1], m[2] || r.due);

      const updated = [...prev];
      updated[idx] = { ...r, done: false };
      return updated;
    });
  }

  function deleteReto(id: string) {
    setRetos(prev => prev.filter(r => r.id !== id));
  }

  return (
    <section
      style={{
        background: 'var(--background)',
        borderRadius: 'var(--radius-card)',
        padding: 18,
        border: 'none',
      }}
    >
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>Hoy · {fmtDate(today)}</h3>
        <small className="muted">{hechos.length}/{hoy.length} completados</small>
      </div>

      <ul className="list" style={{ margin: 0 }}>
        {hoy.length === 0 && <li className="muted" style={{ padding: '8px 0' }}>Nada para hoy.</li>}

        {pendientes.map(r => (
          <Item key={r.id} reto={r} onDone={()=>completeReto(r.id)} onUndo={()=>undoReto(r.id)} onDelete={()=>deleteReto(r.id)} />
        ))}

        {hechos.length > 0 && (
          <>
            <li className="muted" style={{ padding: '6px 0' }}>Hechos</li>
            {hechos.map(r => (
              <Item key={r.id} reto={r} done onDone={()=>completeReto(r.id)} onUndo={()=>undoReto(r.id)} onDelete={()=>deleteReto(r.id)} />
            ))}
          </>
        )}
      </ul>
    </section>
  );
}

function Item({
  reto, done = false, onDone, onUndo, onDelete
}: {
  reto: Reto; done?: boolean;
  onDone: ()=>void; onUndo: ()=>void; onDelete: ()=>void;
}) {
  return (
    <li
      style={{
        padding: '10px 0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        borderTop: '1px solid var(--line)',
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
