'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Notebook, Heart, Target, BookOpen,
  Trash2, X, Pencil, Save, Eye, Utensils, Calculator
} from 'lucide-react';
import CalorieCalculatorModal from '@/components/CalorieCalculatorModal';

/* ===========================
   Helpers de almacenamiento
   =========================== */
const LS_NOTES = 'akira_notes_v2';
const LS_GRATITUDE = 'akira_gratitude_v2';
const LS_GOALS = 'akira_goals_today_v1';
const LS_BOOKS = 'akira_books_v1';
const LS_RETOS = 'akira_mizona_retos_v1';
const LS_MEALS = 'akira_meals_v1';
const OLD_LS_NOTES = 'akira_notes_v1';

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
const fmtDate = (d: string | number) =>
  new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '');
const todayKey = () => new Date().toISOString().slice(0, 10);

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
   Tipos (añadimos pages?: number)
   =========================== */
type Note = { id: string; title: string; text: string; createdAt: number };

type BookBase = { id: string; title: string; author?: string; notes?: string; pages?: number; createdAt: number };
type BookReading = BookBase & { startedAt: number };
type BookFinished = BookBase & { finishedAt: number };
type BooksStore = { reading: BookReading[]; wishlist: BookBase[]; finished: BookFinished[] };

type Goal = { id: string; text: string; done: boolean; createdAt: number };
type GoalsByDay = Record<string, Goal[]>;

type Reto = { id: string; text: string; createdAt: number; due: string; done: boolean; permanent?: boolean };

/* ===== Registro de comidas (tipos) ===== */
type MealItem = {
  id: string;
  foodId?: string;
  customName?: string;
  kcalPer100g: number;
  grams: number;
};
type MealResult = {
  id: string;
  name: string;
  items: MealItem[];
  totalKcal: number;
  createdAt: number;
};
type MealsByDay = Record<string, MealResult[]>;

/* ===========================
   Herramientas
   =========================== */
export default function Herramientas() {
  type TabKey = 'comidas' | 'notas' | 'gratitud' | 'objetivos' | 'libros';
  const TABS: { key: TabKey; label: string; Icon: React.ComponentType<any> }[] = [
    { key: 'comidas', label: 'Comidas', Icon: Utensils },
    { key: 'notas', label: 'Mis notas', Icon: Notebook },
    { key: 'gratitud', label: 'Diario de gratitud', Icon: Heart },
    { key: 'objetivos', label: 'Objetivos para hoy', Icon: Target },
    { key: 'libros', label: 'Mis libros', Icon: BookOpen },
  ];

  const [tab, setTab] = useState<TabKey>('comidas');

  return (
    <div className="py-6 container" style={{ background: '#fff' }}>
      <h2 className="page-title">Herramientas</h2>
      <p className="muted" style={{ margin: '0 0 16px' }}>Tu espacio para escribir y agradecer cada día.</p>

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
        {tab === 'comidas' && <FoodLogTool />}
        {tab === 'notas' && <NotasTool />}
        {tab === 'gratitud' && <GratitudTool />}
        {tab === 'objetivos' && <GoalsTool />}
        {tab === 'libros' && <BooksTool />}
      </section>
    </div>
  );
}

/* ===========================
   Registro de Comidas
   =========================== */
function FoodLogTool() {
  const [byDay, setByDay] = useState<MealsByDay>(() => loadLS<MealsByDay>(LS_MEALS, {}));
  const [calcOpen, setCalcOpen] = useState(false);

  const today = todayKey();
  const meals = byDay[today] ?? [];
  const totalKcal = meals.reduce((a, m) => a + (m.totalKcal || 0), 0);

  // Quick add (si quieres registrar algo sin la calculadora)
  const [quickName, setQuickName] = useState('');
  const [quickKcal, setQuickKcal] = useState('');

  useEffect(() => { saveLS(LS_MEALS, byDay); }, [byDay]);

  const addMeal = (m: MealResult) => {
    setByDay(prev => ({ ...prev, [today]: [m, ...(prev[today] ?? [])] }));
  };

  const quickRegister = () => {
    const name = quickName.trim();
    const kcal = Number(quickKcal.trim());
    if (!name || !kcal || kcal <= 0) return;
    const payload: MealResult = {
      id: crypto.randomUUID(),
      name,
      items: [],
      totalKcal: Math.round(kcal),
      createdAt: Date.now(),
    };
    addMeal(payload);
    setQuickName(''); setQuickKcal('');
  };

  const delMeal = (id: string) => {
    setByDay(prev => ({ ...prev, [today]: (prev[today] ?? []).filter(m => m.id !== id) }));
  };

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Registro de comidas</h3>
      <div className="muted" style={{ marginTop: 4 }}>{formatDateLabel(today)}</div>

      {/* Botón negro: Calculadora de calorías */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <button
          className="btn"
          onClick={() => setCalcOpen(true)}
          title="Abrir calculadora de calorías"
          aria-label="Abrir calculadora de calorías"
        >
          <Calculator className="w-4 h-4" /> Calculadora de calorías
        </button>
      </div>

      {/* Formulario rápido + botón verde Registrar comida */}
      <div className="rows" style={{ marginTop: 12 }}>
        <div className="row" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="input" placeholder="Nombre de la comida" value={quickName}
                 onChange={e => setQuickName(e.target.value)} style={{ flex: '1 1 220px', minWidth: 0 }} />
          <input className="input" placeholder="kcal" inputMode="numeric" value={quickKcal}
                 onChange={e => setQuickKcal(e.target.value)} style={{ width: 120 }} />
          <button className="btn green" onClick={quickRegister}>
            <Utensils className="w-4 h-4" /> Registrar comida
          </button>
        </div>
      </div>

      {/* Lista de comidas del día */}
      <section className="card" style={{ marginTop: 12 }}>
        <div className="flex items-center justify-between gap-2" style={{ display: 'flex' }}>
          <h4 style={{ margin: 0 }}>Comidas de hoy</h4>
          <div className="muted">Total: <b>{Math.round(totalKcal)}</b> kcal</div>
        </div>

        <ul className="list" style={{ marginTop: 8 }}>
          {meals.length === 0 && <li className="muted" style={{ padding: '8px 0' }}>Aún no has registrado comidas hoy.</li>}
          {meals.map(m => (
            <li key={m.id} style={{ padding: '10px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                  <strong>{m.name}</strong>
                  <div className="muted" style={{ marginTop: 4 }}>
                    {m.items.length
                      ? `${m.items.length} ingrediente${m.items.length > 1 ? 's' : ''} · ${m.totalKcal} kcal`
                      : `${m.totalKcal} kcal`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button className="btn red" onClick={() => delMeal(m.id)}>Borrar</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Modal calculadora */}
      <CalorieCalculatorModal
        isOpen={calcOpen}
        onClose={() => setCalcOpen(false)}
        onSave={(meal) => { addMeal(meal); setCalcOpen(false); }}
      />
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
    init: { title: string; author: string; notes: string; pages: string }; // para detectar cambios
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

      {/* ======== MODAL LIBROS (reutilizable) ======== */}
      {modal.open && modal.kind && modal.data && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 'min(640px, 94vw)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h4 style={{ margin: 0 }}>
                {modal.kind === 'reading' && 'Libro en lectura'}
                {modal.kind === 'wishlist' && 'Libro que quiero leer'}
                {modal.kind === 'finished' && 'Libro terminado'}
              </h4>
              <button onClick={closeModal} className="btn red" aria-label="Cerrar">Cerrar</button>
            </div>

            {/* Contenido */}
            <div className="rows" style={{ marginTop: 12 }}>
              {!modal.editing ? (
                <>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{modal.form.title || 'Sin título'}</div>
                  {modal.form.author && <div className="muted">de {modal.form.author}</div>}
                  {modal.form.pages && <div className="muted">Páginas: {modal.form.pages}</div>}
                </>
              ) : (
                <>
                  <input className="input" placeholder="Título" value={modal.form.title}
                         onChange={e => setModal(m => ({ ...m, form: { ...m.form, title: e.target.value } }))} />
                  <input className="input" placeholder="Autor" value={modal.form.author}
                         onChange={e => setModal(m => ({ ...m, form: { ...m.form, author: e.target.value } }))} />
                  <input className="input" placeholder="Número de páginas (opcional)" inputMode="numeric" value={modal.form.pages}
                         onChange={e => setModal(m => ({ ...m, form: { ...m.form, pages: e.target.value } }))} />
                </>
              )}

              {!modal.editing ? (
                <div className="row" style={{ whiteSpace: 'pre-wrap', minHeight: 80 }}>
                  {modal.form.notes ? modal.form.notes : <span className="muted">Sin notas</span>}
                </div>
              ) : (
                <textarea className="textarea" rows={6} placeholder="Notas…"
                  value={modal.form.notes}
                  onChange={e => setModal(m => ({ ...m, form: { ...m.form, notes: e.target.value } }))} />
              )}
            </div>

            {/* Botonera */}
            <div className="actions" style={{ flexWrap: 'wrap' }}>
              {!modal.editing ? (
                <button className="btn secondary" onClick={() => setModal(m => ({ ...m, editing: true }))}>Editar</button>
              ) : (
                <button className="btn" disabled={!hasChanges} onClick={saveModal}>Actualizar</button>
              )}

              {modal.kind === 'reading' && (
                <button className="btn red" onClick={() => finishReading((modal.data as BookReading).id)}>Terminar libro</button>
              )}

              {modal.kind === 'wishlist' && (
                <button className="btn green"
                        onClick={() => startFromWishlist(
                          (modal.data as BookBase).id,
                          modal.editing
                            ? {
                                title: modal.form.title || undefined,
                                author: modal.form.author || undefined,
                                notes: modal.form.notes || undefined,
                                pages: modal.form.pages.trim() ? Number(modal.form.pages.trim()) : undefined,
                              }
                            : undefined
                        )}>
                  Empezar a leer
                </button>
              )}

              {modal.kind === 'finished' && (
                <button className="btn" onClick={() => rereadFinished((modal.data as BookFinished).id)}>Volver a leer</button>
              )}
            </div>
          </div>
        </div>
      )}

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
