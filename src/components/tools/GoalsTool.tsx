'use client';

import React, { useEffect, useState } from 'react';
import { loadLS, saveLS, todayKey } from './_helpers';

const LS_GOALS = 'akira_goals_today_v1';
const LS_RETOS = 'akira_mizona_retos_v1';

type Goal = { id: string; text: string; done: boolean; createdAt: number };
type GoalsByDay = Record<string, Goal[]>;
type Reto = { id: string; text: string; createdAt: number; due: string; done: boolean; permanent?: boolean };

export default function GoalsTool() {
  const [byDay, setByDay] = useState<GoalsByDay>(() => loadLS<GoalsByDay>(LS_GOALS, {}));
  const [text, setText] = useState('');
  const today = todayKey();
  const list = byDay[today] || [];
  useEffect(() => { saveLS(LS_GOALS, byDay); }, [byDay]);

  const loadRetos = (): Reto[] => loadLS<Reto[]>(LS_RETOS, []);
  const saveRetos = (retos: Reto[]) => saveLS(LS_RETOS, retos);

  const add = () => {
    const t = text.trim(); if (!t) return;
    const reto: Reto = { id: crypto.randomUUID(), text: t, createdAt: Date.now(), due: today, done: false };
    saveRetos([reto, ...loadRetos()]);
    const g: Goal = { id: reto.id, text: reto.text, createdAt: reto.createdAt, done: false };
    setByDay({ ...byDay, [today]: [g, ...list] });
    setText('');
  };

  const edit = (id: string) => {
    const nuevo = prompt('Editar objetivo:', list.find(x => x.id === id)?.text || '');
    if (nuevo == null) return;
    const updated = list.map(x => x.id === id ? { ...x, text: nuevo } : x);
    setByDay({ ...byDay, [today]: updated });
    saveRetos(loadRetos().map(r => r.id === id ? { ...r, text: nuevo } : r));
  };

  const del = (id: string) => {
    setByDay({ ...byDay, [today]: list.filter(g => g.id !== id) });
    saveRetos(loadRetos().filter(r => r.id !== id));
  };

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Objetivos para hoy</h3>
      <p className="muted">Se enviarán a <b>Mi zona</b> como retos del día.</p>

      <div className="rows" style={{ marginTop: 12 }}>
        <div className="row" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="input" placeholder="Escribe un objetivo…" value={text} onChange={e => setText(e.target.value)}
                 style={{ flex: '1 1 240px', minWidth: 0 }} />
          <button className="btn" onClick={add}>Añadir</button>
        </div>

        <div className="rows">
          {list.length === 0 && <div className="muted">Aún no hay objetivos guardados hoy.</div>}
          {list.map(g => (
            <div key={g.id} className="row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span>{g.text}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn secondary" onClick={() => edit(g.id)}>Editar</button>
                <button className="btn red" onClick={() => del(g.id)}>Borrar</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
