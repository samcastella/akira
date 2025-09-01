'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Notebook, Heart, Target, BookOpen,
  Trash2, X, Pencil, Save, Eye, Activity, ChevronDown, ChevronUp, Plus, Utensils
} from 'lucide-react';
// NEW: importar el modal
import CalorieCalculatorModal, { MealResult } from '@/components/CalorieCalculatorModal';

/* ===========================
   Helpers de almacenamiento
   =========================== */
const LS_NOTES = 'akira_notes_v2';
const LS_GRATITUDE = 'akira_gratitude_v2';
const LS_GOALS = 'akira_goals_today_v1';
const LS_BOOKS = 'akira_books_v1';
const LS_RETOS = 'akira_mizona_retos_v1';
const OLD_LS_NOTES = 'akira_notes_v1';
const LS_BEHAVIORS = 'akira_behaviors_v1';
const LS_MEALS = 'akira_meals_v1';
const LS_MEALS_PROFILE = 'akira_meals_profile_v1';

function loadLS<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function saveLS<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}
const fmtDateTime = (d: string | number) =>
  new Date(d).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace('.', '');
const fmtTime = (d: number) =>
  new Date(d).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
const fmtDate = (d: string | number) =>
  new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '');

/* =========
   Claves de fecha — **LOCAL** (no UTC)
   ========= */
function localDateKeyFromDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}
const todayKey = () => localDateKeyFromDate(new Date());
const dateKey = (ts: number) => localDateKeyFromDate(new Date(ts));

/* =========
   Fechas legibles (Hoy/Ayer)
   ========= */
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}
function formatDateLabel(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  const now = new Date();
  const yesterday = new Date(); yesterday.setDate(now.getDate() - 1);
  const dateStr = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '');
  if (sameDay(d, now)) return `Hoy · ${dateStr}`;
  if (sameDay(d, yesterday)) return `Ayer · ${dateStr}`;
  return dateStr;
}

/* =========
   Migración v1 -> v2 de notas
   ========= */
function migrateNotesIfNeeded() {
  if (typeof window === 'undefined') return;
  try {
    if (localStorage.getItem(LS_NOTES)) return;
    const raw = localStorage.getItem(OLD_LS_NOTES);
    if (!raw) return;
    const v1 = JSON.parse(raw);
    if (!Array.isArray(v1)) return;
    const migrated = v1.map((n: any) => {
      if (typeof n === 'string') {
        return { id: crypto.randomUUID(), title: '', text: n, createdAt: Date.now() };
      }
      return {
        id: n?.id || crypto.randomUUID(),
        title: '',
        text: typeof n?.text === 'string' ? n.text : '',
        createdAt: Number(n?.createdAt) || Date.now(),
      };
    });
    localStorage.setItem(LS_NOTES, JSON.stringify(migrated));
    localStorage.removeItem(OLD_LS_NOTES);
  } catch { /* noop */ }
}

/* ===========================
   Tipos existentes
   =========================== */
type Note = { id: string; title: string; text: string; createdAt: number };

type BookBase = { id: string; title: string; author?: string; notes?: string; pages?: number; createdAt: number };
type BookReading = BookBase & { startedAt: number };
type BookFinished = BookBase & { finishedAt: number };
type BooksStore = { reading: BookReading[]; wishlist: BookBase[]; finished: BookFinished[] };

type Goal = { id: string; text: string; done: boolean; createdAt: number };
type GoalsByDay = Record<string, Goal[]>;

type Reto = { id: string; text: string; createdAt: number; due: string; done: boolean; permanent?: boolean };

/* ===========================
   Tipos NUEVOS (Conductas)
   =========================== */
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

/* ===========================
   Tipos NUEVOS (Comidas)
   =========================== */
type MealType = 'Desayuno' | 'Almuerzo' | 'Comida' | 'Merienda' | 'Cena' | 'Picoteo';
type MealEntry = { id: string; ts: number; type: MealType; title: string; calories?: number };
type MealsByDay = Record<string, MealEntry[]>;
type MealProfile = { height?: number; weight?: number; target?: number };

/* ===========================
   Herramientas
   =========================== */
export default function Herramientas() {
  type TabKey = 'notas' | 'gratitud' | 'conductas' | 'comidas' | 'objetivos' | 'libros';
  const TABS: { key: TabKey; label: string; Icon: React.ComponentType<any> }[] = [
    { key: 'notas', label: 'Mis notas', Icon: Notebook },
    { key: 'gratitud', label: 'Diario de gratitud', Icon: Heart },
    { key: 'conductas', label: 'Registro de conductas', Icon: Activity },
    { key: 'comidas', label: 'Registro de comidas', Icon: Utensils },
    { key: 'objetivos', label: 'Objetivos para hoy', Icon: Target },
    { key: 'libros', label: 'Mis libros', Icon: BookOpen },
  ];

  const [tab, setTab] = useState<TabKey>('notas');

  return (
    <div className="py-6 container" style={{ background: '#fff' }}>
      <h2 className="page-title">Herramientas</h2>
      <p className="muted" style={{ margin: '0 0 16px' }}>Tu espacio para escribir, agradecer y registrar conductas/comidas.</p>

      <div role="tablist" className="tabbar">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            aria-controls={`panel-${key}`}
            onClick={() => setTab(key)}
          >
            <span className="icon"><Icon size={20} /></span>{label}
          </button>
        ))}
      </div>

      <section className="card" id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'notas' && <NotasTool />}
        {tab === 'gratitud' && <GratitudTool />}
        {tab === 'conductas' && <ConductasTool />}
        {tab === 'comidas' && <ComidasTool />}
        {tab === 'objetivos' && <GoalsTool />}
        {tab === 'libros' && <BooksTool />}
      </section>
    </div>
  );
}

/* ===========================
   Notas
   =========================== */
function NotasTool() {
  migrateNotesIfNeeded();

  const [notes, setNotes] = useState<Note[]>(() => loadLS<Note[]>(LS_NOTES, []));
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');

  useEffect(() => { saveLS(LS_NOTES, notes); }, [notes]);

  const addNote = () => {
    const ti = title.trim(), tx = text.trim();
    if (!ti && !tx) return;
    setNotes([{ id: crypto.randomUUID(), title: ti, text: tx, createdAt: Date.now() }, ...notes]);
    setTitle(''); setText('');
  };

  const onUpdate = (upd: Note) => setNotes(notes.map(n => n.id === upd.id ? upd : n));
  const onDelete = (id: string) => setNotes(notes.filter(n => n.id !== id));

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Mis notas</h3>
      <div className="rows" style={{ marginTop: 12 }}>
        <input className="input" placeholder="Título (opcional)" value={title} onChange={e=>setTitle(e.target.value)} />
        <textarea className="textarea" rows={3} placeholder="Escribe una nota rápida…" value={text} onChange={e=>setText(e.target.value)} />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={addNote} className="btn">Guardar nota</button>
        </div>
      </div>

      <div className="rows" style={{ marginTop: 16 }}>
        {notes.length === 0 && <div className="muted">Aún no tienes notas.</div>}
        {notes.map(n => (
          <NoteItem
            key={n.id}
            note={n}
            onUpdate={onUpdate}
            onDelete={() => onDelete(n.id)}
          />
        ))}
      </div>
    </div>
  );
}

function NoteItem({
  note, onUpdate, onDelete
}: {
  note: Note;
  onUpdate: (n: Note) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [text, setText] = useState(note.text);

  return (
    <article style={{ border: '1px solid var(--line)', borderRadius: 16, padding: 12, overflow: 'hidden' }}>
      {!editing ? (
        <>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="mb-1" style={{ fontSize: 11, color: '#777' }}>{fmtDateTime(note.createdAt)}</div>
              {note.title && <div style={{ fontWeight: 700, marginBottom: 4 }}>{note.title}</div>}
            </div>
            <div className="flex gap-2">
              <button className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border hover:bg-neutral-50" onClick={() => setEditing(true)} title="Editar nota">
                <Pencil className="w-4 h-4" /> Editar
              </button>
              <button className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border hover:bg-red-50 text-red-600" onClick={onDelete} title="Eliminar">
                <Trash2 className="h-3.5 w-3.5" /> Borrar
              </button>
            </div>
          </div>
          {note.text && <p className="mt-2 whitespace-pre-wrap" style={{ margin: 0 }}>{note.text}</p>}
        </>
      ) : (
        <>
          <input className="input w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" />
          <textarea className="textarea w-full mt-2" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Contenido" />
          <div className="flex gap-2 mt-3 justify-end">
            <button className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-black text-white"
              onClick={() => { onUpdate({ ...note, title: title.trim(), text: text.trim() }); setEditing(false); }}>
              <Save className="w-4 h-4" /> Guardar
            </button>
            <button className="px-3 py-1.5 rounded-lg border hover:bg-neutral-50" onClick={() => { setTitle(note.title); setText(note.text); setEditing(false); }}>
              Cancelar
            </button>
          </div>
        </>
      )}
    </article>
  );
}

/* ===========================
   Gratitud
   =========================== */
type GratitudeRow = { id: string; text: string };
type GratitudeEntry = { date: string; rows: GratitudeRow[]; savedAt: number };

function GratitudTool() {
  type Entries = Record<string, GratitudeEntry>;
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

  const prevDays = useMemo(() => Object.keys(entries).filter(d => d !== today).sort((a, b) => b.localeCompare(a)), [entries, today]);

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

/* ===========================
   Registro de Conductas
   =========================== */
function ConductasTool() {
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
      <p className="muted">Crea conductas raíz (p. ej., <i>Fumar</i> o <i>Uso dispositivo móvil</i>) y registra cada repetición con su señal y estado de ánimo.</p>

      {/* Crear conducta */}
      <div className="rows" style={{ marginTop: 12 }}>
        <div className="row" style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <input className="input" placeholder="Nombre de la conducta (p. ej., Fumar)" value={newName} onChange={e=>setNewName(e.target.value)} style={{ flex:'1 1 260px', minWidth:0 }} />
          <button className="btn inline-flex items-center gap-2 whitespace-nowrap" onClick={addBehavior}>
            <Plus className="w-4 h-4" /> Crear
          </button>
        </div>
      </div>

      {/* Lista de conductas */}
      <div className="rows" style={{ marginTop: 16 }}>
        {visible.length === 0 && (
          <div className="muted">Aún no hay conductas creadas.</div>
        )}
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

/* ===========================
   Registro de Comidas (rediseñado) — borde gris + Editar inline
   =========================== */
function ComidasTool() {
  // Perfil
  const [profile, setProfile] = useState<MealProfile>(() => loadLS<MealProfile>(LS_MEALS_PROFILE, {}));
  const [editingProfile, setEditingProfile] = useState(false);
  useEffect(() => { saveLS(LS_MEALS_PROFILE, profile); }, [profile]);

  // Entradas por día
  const [byDay, setByDay] = useState<MealsByDay>(() => loadLS<MealsByDay>(LS_MEALS, {}));
  useEffect(() => { saveLS(LS_MEALS, byDay); }, [byDay]);

  const today = todayKey();

  // Abrir/cerrar por día (hoy abierto por defecto)
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});
  useEffect(() => { setOpenDays(o => ({ ...o, [today]: true })); }, [today]);

  // Formularios por día (para poder añadir en días pasados)
  type FormState = { type: MealType; title: string; calStr: string; time: string };
  const [forms, setForms] = useState<Record<string, FormState>>({});

  const getForm = (dk: string): FormState => forms[dk] || { type: 'Comida', title: '', calStr: '', time: '' };
  const setForm = (dk: string, next: Partial<FormState>) =>
    setForms(prev => ({ ...prev, [dk]: { ...getForm(dk), ...next } }));

  // --- Edición inline de una comida concreta
  const [editingEntry, setEditingEntry] = useState<{ id: string; day: string } | null>(null);
  const [editForm, setEditForm] = useState<FormState>({ type: 'Comida', title: '', calStr: '', time: '' });

  const pad2 = (n: number) => String(n).padStart(2, '0');
  const hhmmFromTs = (ts: number) => {
    const d = new Date(ts);
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  };

  // Días disponibles (si no hay registro de hoy, igualmente aparece)
  const allDays = useMemo(() => {
    const s = new Set<string>(Object.keys(byDay));
    s.add(today);
    return Array.from(s).sort((a,b)=>b.localeCompare(a));
  }, [byDay, today]);

  // Helpers
  const summarize = (arr: MealEntry[]) => {
    const count = arr.length;
    const provided = arr.some(m => typeof m.calories === 'number');
    const kcal = provided ? arr.reduce((acc, m) => acc + (m.calories || 0), 0) : null;
    const diff = (typeof profile.target === 'number' && kcal !== null) ? (kcal - profile.target) : null;
    return { count, kcal, diff };
  };

  const addMealForDay = (dk: string) => {
    const f = getForm(dk);
    const title = f.title.trim();
    if (!title) return;

    const calories = f.calStr.trim() ? Math.max(0, Number(f.calStr.trim())) : undefined;
    const hhmm = /^\d{2}:\d{2}$/.test(f.time) ? f.time : '12:00';
    // Timestamp local dentro del día seleccionado
    const ts = new Date(`${dk}T${hhmm}:00`).getTime();

    const entry: MealEntry = { id: crypto.randomUUID(), ts, type: f.type, title, calories };
    setByDay(prev => {
      const arr = prev[dk] || [];
      const newArr = [entry, ...arr].sort((a,b)=>b.ts - a.ts);
      return { ...prev, [dk]: newArr };
    });
    // limpiar formulario de ese día
    setForm(dk, { title: '', calStr: '', time: '' });
    setOpenDays(o => ({ ...o, [dk]: true })); // lo dejamos abierto
  };

  const deleteMeal = (dk: string, id: string) => {
    setByDay(prev => ({ ...prev, [dk]: (prev[dk] || []).filter(m => m.id !== id) }));
    if (editingEntry?.id === id) setEditingEntry(null);
  };

  const startEditMeal = (dk: string, e: MealEntry) => {
    setEditingEntry({ id: e.id, day: dk });
    setEditForm({
      type: e.type,
      title: e.title,
      calStr: typeof e.calories === 'number' ? String(e.calories) : '',
      time: hhmmFromTs(e.ts),
    });
  };

  const saveEditMeal = () => {
    if (!editingEntry) return;
    const { id, day } = editingEntry;
    const f = editForm;
    const title = f.title.trim();
    if (!title) return;

    const calories = f.calStr.trim() ? Math.max(0, Number(f.calStr.trim())) : undefined;
    const hhmm = /^\d{2}:\d{2}$/.test(f.time) ? f.time : '12:00';
    const ts = new Date(`${day}T${hhmm}:00`).getTime();

    setByDay(prev => {
      const arr = prev[day] || [];
      const newArr = arr
        .map(m => (m.id === id ? { ...m, type: f.type, title, calories, ts } : m))
        .sort((a,b)=>b.ts - a.ts);
      return { ...prev, [day]: newArr };
    });
    setEditingEntry(null);
  };

  // NEW: estado para abrir/cerrar modal y saber el día objetivo
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcDay, setCalcDay] = useState<string | null>(null);

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Registro de comidas</h3>

      {/* Perfil — borde gris */}
      <section className="border rounded-2xl p-4" style={{ borderColor: 'var(--line)' }}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <strong>Mi perfil</strong>
          {!editingProfile ? (
            <button className="btn secondary" onClick={() => setEditingProfile(true)}>Editar</button>
          ) : (
            <div className="flex gap-2">
              <button className="btn" onClick={() => setEditingProfile(false)}>Guardar</button>
              <button className="btn ghost" onClick={() => { setEditingProfile(false); }}>Cancelar</button>
            </div>
          )}
        </div>

        <div className="rows mt-3">
          {!editingProfile ? (
            <div className="muted" style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
              <span>Altura: <b>{profile.height ?? '—'}</b> cm</span>
              <span>Peso: <b>{profile.weight ?? '—'}</b> kg</span>
              <span>Calorías deseadas: <b>{profile.target ?? '—'}</b> kcal</span>
            </div>
          ) : (
            <div className="row" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:8 }}>
              <input className="input" inputMode="numeric" placeholder="Altura (cm)" value={profile.height ?? ''}
                     onChange={e=>setProfile(p=>({ ...p, height: e.target.value ? Number(e.target.value) : undefined }))} />
              <input className="input" inputMode="numeric" placeholder="Peso (kg)" value={profile.weight ?? ''}
                     onChange={e=>setProfile(p=>({ ...p, weight: e.target.value ? Number(e.target.value) : undefined }))} />
              <input className="input" inputMode="numeric" placeholder="Calorías deseadas (kcal)" value={profile.target ?? ''}
                     onChange={e=>setProfile(p=>({ ...p, target: e.target.value ? Number(e.target.value) : undefined }))} />
            </div>
          )}
        </div>
      </section>

      {/* Tarjetas por día (resumen + desplegable + formulario + lista) */}
      <section className="rows" style={{ marginTop: 12 }}>
        {allDays.map(dk => {
          const arr = (byDay[dk] || []).slice().sort((a,b)=>b.ts - a.ts);
          const { count, kcal, diff } = summarize(arr);
          const open = !!openDays[dk];
          const form = getForm(dk);

          return (
            <div key={dk} className="border rounded-2xl p-4" style={{ borderColor: 'var(--line)' }}>
              {/* Resumen compactado */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <div>· <b>Fecha:</b> {formatDateLabel(dk)}</div>
                  <div className="muted" style={{ marginTop: 4 }}>
                    <div>· Número de comidas: <b>{count}</b></div>
                    <div>· Calorías consumidas: <b>{kcal !== null ? kcal : '—'}</b></div>
                    <div>· Diferencia vs objetivo: <b>{diff !== null ? `${diff > 0 ? `+${diff}` : diff} kcal` : '—'}</b></div>
                  </div>
                </div>
                <button
                  className="btn secondary inline-flex items-center px-2 py-1"
                  aria-label={open ? 'Ocultar' : 'Ver detalles'}
                  title={open ? 'Ocultar' : 'Ver detalles'}
                  onClick={() => setOpenDays(o => ({ ...o, [dk]: !o[dk] }))}
                >
                  {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {/* Contenido desplegable */}
              {open && (
                <div className="rows mt-3">
                  {/* Formulario para este día */}
                  <div className="row" style={{ display:'grid', gap:8, gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))' }}>
                    <select className="input" value={form.type} onChange={e=>setForm(dk, { type: e.target.value as MealType })}>
                      {(['Desayuno','Almuerzo','Comida','Merienda','Cena','Picoteo'] as MealType[]).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <textarea className="textarea" rows={2} placeholder="Comida (p. ej., Huevos con bacon)" value={form.title} onChange={e=>setForm(dk, { title: e.target.value })} />
                    <input className="input" inputMode="numeric" placeholder="Calorías (kcal · opcional)" value={form.calStr} onChange={e=>setForm(dk, { calStr: e.target.value })} />
                    <input className="input" type="time" placeholder="Hora (opcional)" value={form.time} onChange={e=>setForm(dk, { time: e.target.value })} />

                    {/* NEW: abrir calculadora de kcal para este día */}
                    <button
                      className="btn secondary inline-flex items-center gap-2 whitespace-nowrap"
                      onClick={() => { setCalcDay(dk); setCalcOpen(true); }}
                      title="Abrir calculadora de calorías"
                    >
                      Calcular kcal
                    </button>

                    <button className="btn inline-flex items-center gap-2 whitespace-nowrap" onClick={() => addMealForDay(dk)}>
                      <Plus className="w-4 h-4" /> Registrar en {formatDateLabel(dk)}
                    </button>
                  </div>

                  {/* Lista de comidas del día */}
                  <ul className="list" style={{ marginTop: 8 }}>
                    {arr.length === 0 && <li className="muted" style={{ padding:'6px 0' }}>Sin comidas registradas.</li>}
                    {arr.map(e => {
                      const isEditing = editingEntry?.id === e.id && editingEntry.day === dk;
                      return (
                        <li key={e.id} style={{ padding:'8px 0' }}>
                          {!isEditing ? (
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div style={{ minWidth:0, flex:'1 1 320px' }}>
                                <div className="muted" style={{ fontSize:12 }}>{fmtTime(e.ts)}</div>
                                <div className="inline-flex items-center gap-2">
                                  <span className="inline-block rounded-full border px-2 py-0.5">{e.type}</span>
                                  <span><b>{e.title}</b></span>
                                  <span className="muted">{typeof e.calories === 'number' ? `· ${e.calories} kcal` : '· kcal —'}</span>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button className="btn secondary inline-flex items-center gap-2 whitespace-nowrap" onClick={() => startEditMeal(dk, e)}>
                                  <Pencil className="w-4 h-4" /> Editar
                                </button>
                                <button className="btn red inline-flex items-center gap-2 whitespace-nowrap" onClick={() => deleteMeal(dk, e.id)}>
                                  <Trash2 className="w-4 h-4" /> Borrar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="rows">
                              <div className="row" style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                                <select className="input" value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value as MealType }))}>
                                  {(['Desayuno', 'Almuerzo', 'Comida', 'Merienda', 'Cena', 'Picoteo'] as MealType[]).map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <textarea className="textarea" rows={2} value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
                                <input className="input" inputMode="numeric" placeholder="kcal" value={editForm.calStr} onChange={e => setEditForm(f => ({ ...f, calStr: e.target.value }))} />
                                <input className="input" type="time" value={editForm.time} onChange={e => setEditForm(f => ({ ...f, time: e.target.value }))} />
                              </div>
                              <div className="flex gap-2 justify-end mt-2">
                                <button className="btn" onClick={saveEditMeal}>
                                  <Save className="w-4 h-4" /> Guardar
                                </button>
                                <button className="btn ghost" onClick={() => setEditingEntry(null)}>Cancelar</button>
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* NEW: modal calculadora de calorías (montado una sola vez) */}
      <CalorieCalculatorModal
        isOpen={calcOpen}
        onClose={() => setCalcOpen(false)}
        initialName={calcDay ? getForm(calcDay).title : ""}
        onSave={(meal: MealResult) => {
          if (calcDay) {
            // Rellenar el formulario del día con el nombre y las kcal totales calculadas
            setForm(calcDay, { title: meal.name, calStr: String(meal.totalKcal) });
          }
          setCalcOpen(false);
        }}
      />
    </div>
  );
}

/* ===========================
   Objetivos para hoy
   =========================== */
function GoalsTool() {
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

/* ===========================
   Mis libros — con páginas + pop-ups + estadísticas
   =========================== */
function BooksTool() {
  const [store, setStore] = useState<BooksStore>(() => loadLS<BooksStore>(LS_BOOKS, { reading: [], wishlist: [], finished: [] }));
  useEffect(() => { saveLS(LS_BOOKS, store); }, [store]);

  // Formularios (añadimos pages)
  const [formR, setFormR] = useState({ title: '', author: '', notes: '', pages: '' });
  const [formW, setFormW] = useState({ title: '', author: '', notes: '', pages: '' });

  // Stats modal
  const [statsOpen, setStatsOpen] = useState(false);
  const finishedCount = store.finished.length;
  const pagesRead = store.finished.reduce((acc, b) => acc + (b.pages || 0), 0);

  // --- MODAL estado general
  type ModalKind = 'reading' | 'wishlist' | 'finished';
  const [modal, setModal] = useState<{
    open: boolean;
    kind: ModalKind | null;
    editing: boolean;
    data: (BookReading | BookBase | BookFinished) | null;
    init: { title: string; author: string; notes: string; pages: string };
    form: { title: string; author: string; notes: string; pages: string };
  }>({
    open: false, kind: null, editing: false, data: null,
    init: { title: '', author: '', notes: '', pages: '' },
    form: { title: '', author: '', notes: '', pages: '' },
  });

  const openModal = (kind: ModalKind, book: any, editing = false) => {
    const init = {
      title: book.title || '',
      author: book.author || '',
      notes: book.notes || '',
      pages: book.pages ? String(book.pages) : '',
    };
    setModal({ open: true, kind, editing, data: book, init, form: { ...init } });
  };
  const closeModal = () => setModal(m => ({ ...m, open: false }));

  const hasChanges = modal.form.title !== modal.init.title
    || modal.form.author !== modal.init.author
    || modal.form.notes !== modal.init.notes
    || modal.form.pages !== modal.init.pages;

  // --- Acciones modal
  const saveModal = () => {
    if (!modal.data || !modal.kind) return;
    const np = modal.form.pages.trim() ? Math.max(0, Number(modal.form.pages.trim())) : undefined;

    if (modal.kind === 'reading') {
      const b = modal.data as BookReading;
      const nb: BookReading = {
        ...b,
        title: modal.form.title.trim() || b.title,
        author: modal.form.author.trim() || undefined,
        notes: modal.form.notes.trim() || undefined,
        pages: np,
      };
      setStore(s => ({ ...s, reading: s.reading.map(x => x.id === b.id ? nb : x) }));
    }
    if (modal.kind === 'wishlist') {
      const b = modal.data as BookBase;
      const nb: BookBase = {
        ...b,
        title: modal.form.title.trim() || b.title,
        author: modal.form.author.trim() || undefined,
        notes: modal.form.notes.trim() || undefined,
        pages: np,
      };
      setStore(s => ({ ...s, wishlist: s.wishlist.map(x => x.id === b.id ? nb : x) }));
    }
    if (modal.kind === 'finished') {
      const b = modal.data as BookFinished;
      const nb: BookFinished = {
        ...b,
        title: modal.form.title.trim() || b.title,
        author: modal.form.author.trim() || undefined,
        notes: modal.form.notes.trim() || undefined,
        pages: np,
      };
      setStore(s => ({ ...s, finished: s.finished.map(x => x.id === b.id ? nb : x) }));
    }
    setModal(m => ({ ...m, init: { ...m.form }, editing: false }));
  };

  const startFromWishlist = (id: string, payload?: { title?: string; author?: string; notes?: string; pages?: number }) => {
    setStore(s => {
      const b = s.wishlist.find(x => x.id === id);
      if (!b) return s;
      const now = Date.now();
      const reading: BookReading = {
        id: b.id,
        title: payload?.title ?? b.title,
        author: payload?.author ?? b.author,
        notes: payload?.notes ?? b.notes,
        pages: payload?.pages ?? b.pages,
        createdAt: b.createdAt,
        startedAt: now,
      };
      return { ...s, wishlist: s.wishlist.filter(x => x.id !== id), reading: [reading, ...s.reading] };
    });
    closeModal();
  };

  const finishReading = (id: string) => {
    setStore(s => {
      const b = s.reading.find(x => x.id === id);
      if (!b) return s;
      const finished: BookFinished = { ...b, finishedAt: Date.now() };
      // @ts-ignore remove startedAt for finished shape
      delete (finished as any).startedAt;
      return { ...s, reading: s.reading.filter(x => x.id !== id), finished: [finished, ...s.finished] };
    });
  };

  const rereadFinished = (id: string) => {
    setStore(s => {
      const b = s.finished.find(x => x.id === id);
      if (!b) return s;
      const reading: BookReading = { ...b, startedAt: Date.now(), createdAt: Date.now() };
      // @ts-ignore finished -> reading
      delete (reading as any).finishedAt;
      return { ...s, finished: s.finished.filter(x => x.id !== id), reading: [reading, ...s.reading] };
    });
    closeModal();
  };

  const addReading = () => {
    if (!formR.title.trim()) return alert('El nombre del libro es obligatorio');
    const now = Date.now();
    const book: BookReading = {
      id: crypto.randomUUID(),
      title: formR.title.trim(),
      author: formR.author.trim() || undefined,
      notes: formR.notes.trim() || undefined,
      pages: formR.pages.trim() ? Math.max(0, Number(formR.pages.trim())) : undefined,
      createdAt: now,
      startedAt: now,
    };
    setStore({ ...store, reading: [book, ...store.reading] });
    setFormR({ title: '', author: '', notes: '', pages: '' });
  };

  const addWishlist = () => {
    if (!formW.title.trim()) return alert('El nombre del libro es obligatorio');
    const now = Date.now();
    const b: BookBase = {
      id: crypto.randomUUID(),
      title: formW.title.trim(),
      author: formW.author.trim() || undefined,
      notes: formW.notes.trim() || undefined,
      pages: formW.pages.trim() ? Math.max(0, Number(formW.pages.trim())) : undefined,
      createdAt: now,
    };
    setStore({ ...store, wishlist: [b, ...store.wishlist] });
    setFormW({ title: '', author: '', notes: '', pages: '' });
  };

  // --- UI
  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Mis libros</h3>

      {/* Leyendo */}
      <section className="card" style={{ marginTop: 8 }}>
        <h4 style={{ margin: '0 0 8px' }}>Libros que me estoy leyendo</h4>
        <div className="rows">
          <input className="input" placeholder="Nombre del libro *" value={formR.title} onChange={e => setFormR({ ...formR, title: e.target.value })} />
          <input className="input" placeholder="Autor (opcional)" value={formR.author} onChange={e => setFormR({ ...formR, author: e.target.value })} />
          <input className="input" placeholder="Número de páginas (opcional)" inputMode="numeric"
                 value={formR.pages} onChange={e => setFormR({ ...formR, pages: e.target.value })} />
          <textarea className="textarea" placeholder="¿Qué estás aprendiendo de este libro? (opcional)"
                    value={formR.notes} onChange={e => setFormR({ ...formR, notes: e.target.value })} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button className="btn" onClick={addReading}>{store.reading.length ? 'Actualizar' : 'Guardar'}</button>
          </div>
        </div>

        <ul className="list" style={{ marginTop: 12 }}>
          {store.reading.map(b => (
            <li key={b.id} style={{ padding: '10px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 220px', minWidth: 0, overflow: 'hidden' }}>
                  <strong>{b.title}</strong>{b.author ? ` · ${b.author}` : ''}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button className="btn secondary" onClick={() => openModal('reading', b, false)}>Ver</button>
                  <button className="btn" onClick={() => openModal('reading', b, true)}>Editar</button>
                  <button className="btn red" onClick={() => finishReading(b.id)}>Libro terminado</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Quiero leer */}
      <section className="card" style={{ marginTop: 12 }}>
        <h4 style={{ margin: '0 0 8px' }}>Libros que quiero leer</h4>
        <div className="rows">
          <input className="input" placeholder="Nombre del libro *" value={formW.title} onChange={e => setFormW({ ...formW, title: e.target.value })} />
          <input className="input" placeholder="Autor (opcional)" value={formW.author} onChange={e => setFormW({ ...formW, author: e.target.value })} />
          <input className="input" placeholder="Número de páginas (opcional)" inputMode="numeric"
                 value={formW.pages} onChange={e => setFormW({ ...formW, pages: e.target.value })} />
          <textarea className="textarea" placeholder="Notas (opcional)" value={formW.notes} onChange={e => setFormW({ ...formW, notes: e.target.value })} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button className="btn" onClick={addWishlist}>{store.wishlist.length ? 'Actualizar' : 'Guardar'}</button>
          </div>
        </div>
        <ul className="list" style={{ marginTop: 12 }}>
          {store.wishlist.map(b => (
            <li key={b.id} style={{ padding: '10px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 220px', minWidth: 0, overflow: 'hidden' }}>
                  <strong>{b.title}</strong>{b.author ? ` · ${b.author}` : ''}
                  {b.pages ? <div className="muted">Páginas: {b.pages}</div> : null}
                  {b.notes && <div className="muted" style={{ marginTop: 4, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{b.notes}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button className="btn secondary" onClick={() => openModal('wishlist', b, true)}>Editar</button>
                  <button className="btn" onClick={() => startFromWishlist(b.id)}>Empezar a leer</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Terminados */}
      <section className="card" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <h4 style={{ margin: '0 0 8px' }}>Libros terminados</h4>
          <button className="btn" onClick={() => setStatsOpen(true)}>Estadísticas</button>
        </div>
        <ul className="list">
          {store.finished.length === 0 && <li style={{ padding: '8px 0' }} className="muted">Aún no hay libros terminados.</li>}
          {store.finished.map(b => (
            <li key={b.id} style={{ padding: '10px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                  <strong>{b.title}</strong>{b.author ? ` · ${b.author}` : ''}
                  <div className="muted" style={{ marginTop: 4 }}>
                    Terminado el {fmtDate(b.finishedAt)}{b.pages ? ` · ${b.pages} páginas` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button className="btn secondary" onClick={() => openModal('finished', b, false)}>Ver</button>
                  <button className="btn" onClick={() => openModal('finished', b, true)}>Editar</button>
                  <button className="btn" onClick={() => rereadFinished(b.id)}>Volver a leer</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ======== MODAL ESTADÍSTICAS ======== */}
      {statsOpen && (
        <div className="modal-backdrop" onClick={() => setStatsOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 'min(520px, 92vw)', textAlign: 'center' }}>
            <h4 style={{ marginTop: 0 }}>Estadísticas de lectura</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
              <div className="card" style={{ padding: 16 }}>
                <div className="muted">Libros que me he leído</div>
                <div style={{ fontSize: 42, fontWeight: 800, lineHeight: 1, marginTop: 6 }}>{finishedCount}</div>
              </div>
              <div className="card" style={{ padding: 16 }}>
                <div className="muted">Páginas leídas</div>
                <div style={{ fontSize: 42, fontWeight: 800, lineHeight: 1, marginTop: 6 }}>{pagesRead}</div>
              </div>
            </div>
            <div className="actions" style={{ marginTop: 16 }}>
              <button className="btn red" onClick={() => setStatsOpen(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

