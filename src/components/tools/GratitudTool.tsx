'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Eye } from 'lucide-react';
import { loadLS, saveLS, todayKey, formatDateLabel } from './_helpers';

const LS_GRATITUDE = 'akira_gratitude_v2';

type GratitudeRow = { id: string; text: string };
type GratitudeEntry = { date: string; rows: GratitudeRow[]; savedAt: number };
type Entries = Record<string, GratitudeEntry>;

export default function GratitudTool() {
  const [entries, setEntries] = useState<Entries>(() => loadLS<Entries>(LS_GRATITUDE, {}));
  const [initialised, setInitialised] = useState(false);
  const today = todayKey();

  useEffect(() => { setInitialised(true); }, []);
  useEffect(() => { if (initialised) saveLS(LS_GRATITUDE, entries); }, [entries, initialised]);

  const current: GratitudeEntry = useMemo(() => {
    const ex = entries[today];
    if (ex) return ex;
    return { date: today, rows: [0,1,2].map(() => ({ id: crypto.randomUUID(), text: '' })), savedAt: 0 };
  }, [entries, today]);

  const setCurrent = (e: GratitudeEntry) => setEntries(prev => ({ ...prev, [today]: e }));
  const onChangeRow = (id: string, text: string) =>
    setCurrent({ ...current, rows: current.rows.map(r => (r.id === id ? { ...r, text } : r)) });
  const addRow = () => setCurrent({ ...current, rows: [...current.rows, { id: crypto.randomUUID(), text: '' }] });
  const hasAnyText = current.rows.some(r => r.text.trim());
  const saveOrUpdate = () => setCurrent({ ...current, savedAt: Date.now() });

  const prevDays = useMemo(
    () => Object.keys(entries).filter(d => d !== today).sort((a, b) => b.localeCompare(a)),
    [entries, today]
  );

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Diario de gratitud</h3>
      <p className="muted" style={{ marginTop: 4 }}>Anota durante el día las cosas por las que te sientes agradecido.</p>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-header">
          <div><div style={{ fontWeight: 600 }}>{formatDateLabel(today)}</div></div>
          <div className="muted">Escribe 3 cosas por las que dar las gracias</div>
        </div>
        <div className="rows">
          {current.rows.map((r, idx) => (
            <div key={r.id} className="row">
              <input className="input" placeholder={`Gracias por… (${idx + 1})`} value={r.text} onChange={e => onChangeRow(r.id, e.target.value)} />
            </div>
          ))}
          {current.rows.length >= 3 && <button className="btn secondary" onClick={addRow}>Añadir otra</button>}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn" onClick={saveOrUpdate}>{current.savedAt ? 'Actualizar' : 'Guardar'}</button>
          </div>
        </div>
      </div>

      <section style={{ marginTop: 16 }}>
        {(current.savedAt || hasAnyText) && (
          <GratitudeDay
            key={today}
            date={today}
            rows={current.rows}
            onUpdate={(rows) => setCurrent({ ...current, rows, savedAt: Date.now() })}
            editable
          />
        )}
        {prevDays.map(d => (
          <GratitudeDay
            key={d}
            date={d}
            rows={entries[d].rows}
            onUpdate={(rows) => setEntries(prev => ({ ...prev, [d]: { ...prev[d], rows, savedAt: Date.now() } }))}
            editable
          />
        ))}
        {prevDays.length === 0 && !current.savedAt && <p className="text-sm text-neutral-500 mt-3">No hay registros anteriores.</p>}
      </section>
    </div>
  );
}

function GratitudeDay({ date, rows, onUpdate, editable = true }: {
  date: string; rows: GratitudeRow[]; onUpdate: (rows: GratitudeRow[]) => void; editable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [localRows, setLocalRows] = useState(rows);
  useEffect(() => { setLocalRows(rows); }, [rows]);
  const addRow = () => setLocalRows([...localRows, { id: crypto.randomUUID(), text: '' }]);
  const visibleRows = rows.filter(r => r.text.trim());

  return (
    <div className="border rounded-xl p-4 mb-3" style={{ overflow: 'hidden' }}>
      <div className="flex items-center justify-between">
        <strong>{formatDateLabel(date)}</strong>
        {!open ? (
          <button className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border hover:bg-neutral-50 text-sm" onClick={() => setOpen(true)}>
            <Eye className="w-4 h-4" /> Ver
          </button>
        ) : (
          <button className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border hover:bg-neutral-50 text-sm" onClick={() => { setOpen(false); setEditing(false); }}>
            Ocultar
          </button>
        )}
      </div>

      {open && !editing && (
        <>
          <div className="mt-3 muted">Diste las gracias por:</div>
          <ul className="mt-2" style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
            {visibleRows.length ? visibleRows.map(r => <li key={r.id}>· {r.text}</li>) : <li className="text-neutral-500">Sin entradas</li>}
          </ul>
          {editable && <div className="flex gap-2 mt-3"><button className="btn secondary" onClick={() => setEditing(true)}>Editar</button></div>}
        </>
      )}

      {open && editing && (
        <div className="rows mt-3">
          {localRows.map((r, idx) => (
            <input key={r.id} className="input" placeholder={`Gracias por… (${idx + 1})`}
                   value={r.text} onChange={(e) => setLocalRows(localRows.map(x => x.id === r.id ? { ...x, text: e.target.value } : x))} />
          ))}
          <button className="btn secondary" onClick={addRow}>Añadir otra</button>
          <div className="flex gap-2 justify-end">
            <button className="btn" onClick={() => { onUpdate(localRows); setEditing(false); }}>Guardar</button>
            <button className="btn ghost" onClick={() => { setLocalRows(rows); setEditing(false); }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
