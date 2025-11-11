'use client';

import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { loadLS, saveLS, todayKey, dateKey, fmtTime, formatDateLabel } from './_helpers';

const LS_BEHAVIORS = 'akira_behaviors_v1';

type Mood =
  | 'Aburrido' | 'Ansioso' | 'Nervioso' | 'Relajado' | 'Eufórico'
  | 'Triste' | 'Cansado' | 'Estresado' | 'Enfadado' | 'Feliz'
  | 'Otro';

type BehaviorEntry = {
  id: string;
  ts: number;
  signal: string;
  mood: Mood;
  moodOther?: string;
};
type Behavior = {
  id: string;
  name: string;
  createdAt: number;
  entries: BehaviorEntry[];
};

export default function ConductasTool() {
  const [behaviors, setBehaviors] = useState<Behavior[]>(() => loadLS<Behavior[]>(LS_BEHAVIORS, []));
  const [newName, setNewName] = useState('');
  useEffect(() => { saveLS(LS_BEHAVIORS, behaviors); }, [behaviors]);

  const moods: Mood[] = ['Aburrido','Ansioso','Nervioso','Relajado','Eufórico','Triste','Cansado','Estresado','Enfadado','Feliz','Otro'];

  const addBehavior = () => {
    const name = newName.trim();
    if (!name) return;
    const b: Behavior = { id: crypto.randomUUID(), name, createdAt: Date.now(), entries: [] };
    setBehaviors([b, ...behaviors]);
    setNewName('');
  };

  const deleteBehavior = (id: string) => {
    if (!confirm('¿Eliminar esta conducta y todos sus registros?')) return;
    setBehaviors(behaviors.filter(b => b.id !== id));
  };

  const addEntry = (id: string, payload: { signal: string; mood: Mood; moodOther?: string }) => {
    setBehaviors(behaviors.map(b => {
      if (b.id !== id) return b;
      const e: BehaviorEntry = { id: crypto.randomUUID(), ts: Date.now(), signal: payload.signal.trim(), mood: payload.mood, moodOther: payload.mood === 'Otro' ? (payload.moodOther || '').trim() : undefined };
      return { ...b, entries: [e, ...b.entries] };
    }));
  };

  const deleteEntry = (bid: string, eid: string) => {
    setBehaviors(behaviors.map(b => b.id === bid ? { ...b, entries: b.entries.filter(e => e.id !== eid) } : b));
  };

  const visible = behaviors.slice().sort((a,b) => (b.createdAt - a.createdAt));

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Registro de conductas</h3>
      <p className="muted">Crea conductas raíz (p. ej., <i>Fumar</i>) y registra cada repetición con su señal y estado de ánimo.</p>

      {/* Crear conducta */}
      <div className="rows" style={{ marginTop: 12 }}>
        <div className="row" style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <input className="input" placeholder="Nombre de la conducta (p. ej., Fumar)" value={newName} onChange={e=>setNewName(e.target.value)} style={{ flex:'1 1 260px', minWidth:0 }} />
          <button className="btn inline-flex items-center gap-2 whitespace-nowrap" onClick={addBehavior}>
            <Plus className="w-4 h-4" /> Crear
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="rows" style={{ marginTop: 16 }}>
        {visible.length === 0 && <div className="muted">Aún no hay conductas creadas.</div>}
        {visible.map(b => (
          <BehaviorCard
            key={b.id}
            behavior={b}
            moods={moods}
            onAddEntry={addEntry}
            onDelete={() => deleteBehavior(b.id)}
            onDeleteEntry={(eid) => deleteEntry(b.id, eid)}
          />
        ))}
      </div>
    </div>
  );
}

function BehaviorCard({
  behavior, moods, onAddEntry, onDelete, onDeleteEntry
}:{
  behavior: Behavior;
  moods: Mood[];
  onAddEntry: (id: string, payload:{signal:string; mood:Mood; moodOther?:string}) => void;
  onDelete: () => void;
  onDeleteEntry: (eid: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [signal, setSignal] = useState('');
  const [mood, setMood] = useState<Mood>('Relajado');
  const [moodOther, setMoodOther] = useState('');

  const tKey = todayKey();
  const countToday = behavior.entries.filter(e => dateKey(e.ts) === tKey).length;
  const total = behavior.entries.length;

  // Últimos 7 días
  const now = new Date();
  const from = new Date(now); from.setHours(0,0,0,0); from.setDate(from.getDate() - 6);
  const last7 = behavior.entries.filter(e => new Date(e.ts) >= from);
  const moodDist = last7.reduce<Record<string, number>>((acc, e) => {
    const k = e.mood === 'Otro' ? (e.moodOther?.trim() || 'Otro') : e.mood;
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const moodDistPairs = Object.entries(moodDist).sort((a,b)=>b[1]-a[1]);

  // Historial agrupado por día
  const grouped: Record<string, BehaviorEntry[]> = {};
  for (const e of behavior.entries) {
    const dk = dateKey(e.ts);
    (grouped[dk] ||= []).push(e);
  }
  const days = Object.keys(grouped).sort((a,b)=>b.localeCompare(a));

  const submitEntry = () => {
    onAddEntry(behavior.id, { signal, mood, moodOther });
    setSignal(''); setMood('Relajado'); setMoodOther('');
    setAdding(false);
    setOpen(true);
  };

  return (
    <article className="border rounded-2xl p-4" style={{ borderColor: 'var(--line)' }}>
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, display:'flex', alignItems:'center', gap:8 }}>
            {behavior.name}
          </div>

          {/* Totales + Flecha */}
          <div style={{ marginTop: 2, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
            <span className="muted">Hoy: <b>{countToday}</b></span>
            <span className="muted">Total: <b>{total}</b></span>
            <button
              className="btn secondary inline-flex items-center px-2 py-1"
              aria-label={open ? 'Ocultar historial' : 'Ver historial'}
              title={open ? 'Ocultar historial' : 'Ver historial'}
              onClick={() => setOpen(!open)}
            >
              {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {!adding ? (
            <button className="btn inline-flex items-center gap-2 whitespace-nowrap" onClick={() => setAdding(true)}>Registrar</button>
          ) : (
            <button className="btn ghost inline-flex items-center gap-2 whitespace-nowrap" onClick={() => setAdding(false)}>Cancelar</button>
          )}
          <button className="btn red inline-flex items-center gap-2 whitespace-nowrap" onClick={onDelete}>
            <Trash2 className="w-4 h-4" /> Borrar
          </button>
        </div>
      </div>

      {/* Formulario rápido */}
      {adding && (
        <div className="rows mt-3">
          <input className="input" placeholder="Señal (¿qué ocurrió antes?)" value={signal} onChange={e=>setSignal(e.target.value)} />
          <div className="row" style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            <select className="input" value={mood} onChange={e=>setMood(e.target.value as Mood)} style={{ flex:'1 1 220px' }}>
              {moods.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            {mood === 'Otro' && (
              <input className="input" placeholder="Especifica el estado de ánimo" value={moodOther} onChange={e=>setMoodOther(e.target.value)} style={{ flex:'2 1 260px' }} />
            )}
            <button className="btn inline-flex items-center gap-2 whitespace-nowrap" onClick={submitEntry}>Añadir registro</button>
          </div>
        </div>
      )}

      {/* Resumen 7 días */}
      {moodDistPairs.length > 0 && (
        <div className="mt-3">
          <div className="muted" style={{ marginBottom: 6 }}>Últimos 7 días: <b>{last7.length}</b> registros</div>
          <div className="flex gap-6 flex-wrap">
            {moodDistPairs.map(([k, v]) => (
              <span key={k} className="inline-flex items-center gap-2" style={{ fontSize: 13 }}>
                <span className="inline-block rounded-full border px-2 py-0.5">{k}</span>
                <b>{v}</b>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Historial */}
      {open && (
        <div className="rows mt-3">
          {days.map(dk => (
            <div key={dk} className="border rounded-xl p-3">
              <div style={{ fontWeight: 600 }}>{formatDateLabel(dk)}</div>
              <ul className="list" style={{ marginTop: 8 }}>
                {grouped[dk].map(e => (
                  <li key={e.id} style={{ padding:'8px 0' }}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div style={{ minWidth:0, flex:'1 1 280px' }}>
                        <div className="muted" style={{ fontSize:12 }}>{fmtTime(e.ts)}</div>
                        <div><b>Estado:</b> {e.mood === 'Otro' ? (e.moodOther?.trim() || 'Otro') : e.mood}</div>
                        <div className="muted" style={{ whiteSpace:'pre-wrap' }}>
                          {e.signal ? `Señal: ${e.signal}` : 'Señal: —'}
                        </div>
                      </div>
                      <button className="btn red inline-flex items-center gap-2 whitespace-nowrap" onClick={() => onDeleteEntry(e.id)}>
                        <Trash2 className="w-4 h-4" /> Borrar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {days.length === 0 && <div className="muted">Sin registros todavía.</div>}
        </div>
      )}
    </article>
  );
}
