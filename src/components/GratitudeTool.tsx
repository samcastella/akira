'use client';
import React, { useEffect, useMemo, useState } from 'react';

const KEY = 'akira_gratitude_v2';

type Row = { id: string; text: string };
type Entry = { date: string; rows: Row[]; savedAt: number }; // YYYY-MM-DD

const todayKey = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d: string | number) => new Date(d).toLocaleDateString();

export default function GratitudeTool() {
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [initialised, setInitialised] = useState(false);
  const today = todayKey();

  // Carga
  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) setEntries(JSON.parse(raw)); } catch {}
    setInitialised(true);
  }, []);
  // Persistencia
  useEffect(() => { if (initialised) try { localStorage.setItem(KEY, JSON.stringify(entries)); } catch {} }, [entries, initialised]);

  const current = useMemo<Entry>(() => {
    const ex = entries[today];
    if (ex) return ex;
    return { date: today, rows: [0, 1, 2].map(() => ({ id: crypto.randomUUID(), text: '' })), savedAt: 0 };
  }, [entries, today]);

  const setCurrent = (e: Entry) => setEntries(prev => ({ ...prev, [today]: e }));
  const onChangeRow = (id: string, text: string) =>
    setCurrent({ ...current, rows: current.rows.map(r => (r.id === id ? { ...r, text } : r)) });
  const addRow = () => setCurrent({ ...current, rows: [...current.rows, { id: crypto.randomUUID(), text: '' }] });
  const hasAnyText = current.rows.some(r => r.text.trim());
  const saveOrUpdate = () => setCurrent({ ...current, savedAt: Date.now() });

  const days = Object.keys(entries).filter(d => d !== today).sort((a, b) => b.localeCompare(a));

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Diario de gratitud</h3>
      <p className="muted" style={{ marginTop: 4 }}>
        Anota durante el día las cosas por las que te sientes agradecido, desde las más pequeñas a las más grandes.
      </p>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-header">
          <div><div style={{ fontWeight: 600 }}>Hoy · {fmtDate(Date.now())}</div></div>
          <div className="muted">Escribe 3 cosas por las que dar las gracias</div>
        </div>

        <div className="rows">
          {current.rows.map((r, idx) => (
            <div key={r.id} className="row">
              <input className="input" placeholder={`Gracias por… (${idx + 1})`} value={r.text} onChange={e => onChangeRow(r.id, e.target.value)} />
            </div>
          ))}
          {current.rows.length >= 3 && (
            <button className="btn secondary" onClick={addRow}>Añadir otra</button>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn" onClick={saveOrUpdate}>{hasAnyText && current.savedAt ? 'Actualizar' : 'Guardar'}</button>
          </div>
        </div>
      </div>

      <section style={{ marginTop: 16 }}>
        <details className="accordion">
          <summary><strong>Entradas anteriores</strong></summary>
          <div style={{ marginTop: 8 }}>
            <ul className="list">
              {current.savedAt ? (
                <li className="card">
                  <strong>Hoy · {fmtDate(Date.now())}</strong>
                  <ul className="list" style={{ marginTop: 8 }}>
                    {current.rows.filter(r => r.text.trim()).map(r => (
                      <li key={r.id} style={{ padding: '8px 0' }}>{r.text}</li>
                    ))}
                  </ul>
                </li>
              ) : null}
              {days.map(d => (
                <li key={d} className="card">
                  <strong>{fmtDate(d)}</strong>
                  <ul className="list" style={{ marginTop: 8 }}>
                    {entries[d].rows.filter(r => r.text.trim()).map(r => (
                      <li key={r.id} style={{ padding: '8px 0' }}>{r.text}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </details>
      </section>
    </div>
  );
}
