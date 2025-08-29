'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Notebook, Heart, Target, BookOpen,
  Check, Trash2, Copy, X,
  Pencil, Save, Eye, Repeat as RepeatIcon
} from 'lucide-react';

/* ===========================
   Helpers de almacenamiento
   =========================== */
const LS_NOTES = 'akira_notes_v2';              // v2: ahora incluye "title"
const LS_GRATITUDE = 'akira_gratitude_v2';      // v2: filas por día
const LS_GOALS = 'akira_goals_today_v1';
const LS_BOOKS = 'akira_books_v1';
const LS_RETOS = 'akira_mizona_retos_v1';       // retos para "Mi zona"
const OLD_LS_NOTES = 'akira_notes_v1';          // <- para migración

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
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
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
    // Si ya existe v2, no migramos.
    if (localStorage.getItem(LS_NOTES)) return;

    const raw = localStorage.getItem(OLD_LS_NOTES);
    if (!raw) return;

    const v1 = JSON.parse(raw);
    if (!Array.isArray(v1)) return;

    // Acepta formatos antiguos: string o {id,text,createdAt}
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
  } catch {
    // noop
  }
}

/* ===========================
   Tipos
   =========================== */
type Note = { id: string; title: string; text: string; createdAt: number };

type GratitudeRow = { id: string; text: string };
type GratitudeEntry = { date: string; rows: GratitudeRow[]; savedAt: number }; // por día (YYYY-MM-DD)

type Goal = { id: string; text: string; done: boolean; createdAt: number; repeat?: '3'|'7'|'21'|'30'|'perm' };
type GoalsByDay = Record<string, Goal[]>;

type BookBase = { id: string; title: string; author?: string; notes?: string; createdAt: number };
type BookReading = BookBase & { startedAt: number };
type BookFinished = BookBase & { finishedAt: number };
type BooksStore = { reading: BookReading[]; wishlist: BookBase[]; finished: BookFinished[] };

/** ⬇️ ahora soporta retos permanentes */
type Reto = { id: string; text: string; createdAt: number; due: string; done: boolean; permanent?: boolean };

/* ===========================
   Herramientas
   =========================== */
export default function Herramientas() {
  type TabKey = 'notas' | 'gratitud' | 'objetivos' | 'libros';
  const TABS: { key: TabKey; label: string; Icon: React.ComponentType<any> }[] = [
    { key: 'notas', label: 'Mis notas', Icon: Notebook },
    { key: 'gratitud', label: 'Diario de gratitud', Icon: Heart },
    { key: 'objetivos', label: 'Objetivos para hoy', Icon: Target },
    { key: 'libros', label: 'Mis libros', Icon: BookOpen },
  ];

  const [tab, setTab] = useState<TabKey>('notas');

  return (
    <div className="py-6 container">
      <h2 className="page-title">Herramientas</h2>
      <p className="muted" style={{ margin: '0 0 16px' }}>Tu espacio para escribir y agradecer cada día.</p>

      {/* Tabs tipo píldora con iconos (estilos en globals.css .tabbar) */}
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
        {tab === 'objetivos' && <GoalsTool />}
        {tab === 'libros' && <BooksTool />}
      </section>
    </div>
  );
}

/* ===========================
   Notas (con Título) — incluye migración v1->v2 + Editar/Guardar
   =========================== */
function NotasTool() {
  // Ejecuta migración ANTES de leer estado inicial
  migrateNotesIfNeeded();

  const [notes, setNotes] = useState<Note[]>(() => loadLS<Note[]>(LS_NOTES, []));
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => { saveLS(LS_NOTES, notes); }, [notes]);

  const addNote = () => {
    const ti = title.trim(), tx = text.trim();
    if (!ti && !tx) return;
    setNotes([{ id: crypto.randomUUID(), title: ti, text: tx, createdAt: Date.now() }, ...notes]);
    setTitle(''); setText('');
  };

  const onUpdate = (upd: Note) => setNotes(notes.map(n => n.id === upd.id ? upd : n));
  const onDelete = (id: string) => setNotes(notes.filter(n => n.id !== id));

  const copyNote = async (n: Note) => {
    try {
      await navigator.clipboard.writeText(`${n.title ? n.title + '\n' : ''}${n.text}`);
      setCopiedId(n.id);
      setTimeout(() => setCopiedId(null), 1200);
    } catch {}
  };

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
          <div key={n.id} className="row">
            <NoteItem
              note={n}
              onUpdate={onUpdate}
              onDelete={() => onDelete(n.id)}
              onCopy={() => copyNote(n)}
              copied={copiedId === n.id}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* Subcomponente de nota con Editar/Guardar */
function NoteItem({
  note, onUpdate, onDelete, onCopy, copied
}: {
  note: Note;
  onUpdate: (n: Note) => void;
  onDelete: () => void;
  onCopy: () => void;
  copied: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [text, setText] = useState(note.text);

  return (
    <article className="border rounded-xl p-4">
      {!editing ? (
        <>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="mb-1" style={{ fontSize: 11, color: '#777' }}>{fmtDateTime(note.createdAt)}</div>
              {note.title && <div style={{ fontWeight: 700, marginBottom: 4 }}>{note.title}</div>}
            </div>
            <div className="flex gap-2">
              <button
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border hover:bg-neutral-50"
                onClick={() => setEditing(true)}
                title="Editar nota"
              >
                <Pencil className="w-4 h-4" /> Editar
              </button>
              <button
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border hover:bg-neutral-50"
                onClick={onCopy}
                title="Copiar"
              >
                {copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? 'Copiado' : 'Copiar'}
              </button>
              <button
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border hover:bg-red-50 text-red-600"
                onClick={onDelete}
                title="Eliminar"
              >
                <Trash2 className="h-3.5 w-3.5" /> Borrar
              </button>
            </div>
          </div>
          {note.text && <p className="mt-2 whitespace-pre-wrap">{note.text}</p>}
        </>
      ) : (
        <>
          <input
            className="input w-full"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título"
          />
          <textarea
            className="textarea w-full mt-2"
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Contenido"
          />
          <div className="flex gap-2 mt-3 justify-end">
            <button
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-black text-white"
              onClick={() => { onUpdate({ ...note, title: title.trim(), text: text.trim() }); setEditing(false); }}
            >
              <Save className="w-4 h-4" /> Guardar
            </button>
            <button
              className="px-3 py-1.5 rounded-lg border hover:bg-neutral-50"
              onClick={() => { setTitle(note.title); setText(note.text); setEditing(false); }}
            >
              Cancelar
            </button>
          </div>
        </>
      )}
    </article>
  );
}

/* ===========================
   Gratitud (v2: filas) — Hoy visible y resto colapsado con "Ver"
   =========================== */
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
      <p className="muted" style={{ marginTop: 4 }}>
        Anota durante el día las cosas por las que te sientes agradecido, desde las más pequeñas a las más grandes.
      </p>

      {/* Hoy (siempre visible) */}
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
          {current.rows.length >= 3 && (
            <button className="btn secondary" onClick={addRow}>Añadir otra</button>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn" onClick={saveOrUpdate}>{hasAnyText && current.savedAt ? 'Actualizar' : 'Guardar'}</button>
          </div>
        </div>
      </div>

      {/* Anteriores: solo fecha + botón Ver que despliega */}
      <section style={{ marginTop: 16 }}>
        {prevDays.length === 0 && <p className="text-sm text-neutral-500 mt-3">No hay registros anteriores.</p>}
        {prevDays.map(d => (
          <CollapsedGratitudeDay key={d} date={d} rows={entries[d].rows} />
        ))}
      </section>
    </div>
  );
}

function CollapsedGratitudeDay({ date, rows }: { date: string; rows: GratitudeRow[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-xl p-4 mb-3">
      <div className="flex items-center justify-between">
        <strong>{formatDateLabel(date)}</strong>
        <button
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border hover:bg-neutral-50 text-sm"
          onClick={() => setOpen(!open)}
        >
          {!open ? <><Eye className="w-4 h-4" /> Ver</> : <>Ocultar</>}
        </button>
      </div>
      {open && (
        <ul className="mt-3 list-disc pl-5">
          {rows?.filter(r => r.text.trim()).length
            ? rows.filter(r => r.text.trim()).map(r => <li key={r.id}>{r.text}</li>)
            : <li className="text-neutral-500">Sin entradas</li>}
        </ul>
      )}
    </div>
  );
}

/* ===========================
   Objetivos para hoy → Mi zona (sin check) + selector Repetir (iOS-like)
   =========================== */
const REPEAT_OPTIONS: Array<{ val: Goal['repeat']; label: string; hint?: string }> = [
  { val: undefined, label: 'Sin repetir' },
  { val: '3',   label: 'Cada 3 días' },
  { val: '7',   label: 'Cada 7 días (semanal)' },
  { val: '21',  label: 'Cada 21 días' },
  { val: '30',  label: 'Cada 30 días (mensual aprox.)' },
  { val: 'perm',label: 'Permanente', hint: 'Se recrea al completarlo' },
];
function repeatLabel(v: Goal['repeat']) {
  return REPEAT_OPTIONS.find(o => o.val === v)?.label ?? 'Sin repetir';
}

function RepeatPicker({
  value,
  onChange,
}: {
  value: Goal['repeat'];
  onChange: (v: Goal['repeat']) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-neutral-50"
        onClick={() => setOpen(o => !o)}
      >
        <RepeatIcon className="w-4 h-4" />
        <span className="text-sm">{repeatLabel(value)}</span>
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-64 bg-white border rounded-xl shadow-lg overflow-hidden">
          <ul className="max-h-72 overflow-auto">
            {REPEAT_OPTIONS.map(opt => (
              <li key={String(opt.val)}>
                <button
                  className="w-full px-3 py-2 flex items-center justify-between hover:bg-neutral-50 text-left"
                  onClick={() => { onChange(opt.val ?? undefined); setOpen(false); }}
                >
                  <div className="flex flex-col">
                    <span>{opt.label}</span>
                    {opt.hint && <span className="text-xs text-neutral-500">{opt.hint}</span>}
                  </div>
                  {value === opt.val && <Check className="w-4 h-4" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function GoalsTool() {
  const [byDay, setByDay] = useState<GoalsByDay>(() => loadLS<GoalsByDay>(LS_GOALS, {}));
  const [text, setText] = useState('');
  const [newRepeat, setNewRepeat] = useState<Goal['repeat']>(undefined);
  const today = todayKey();
  const list = byDay[today] || [];

  useEffect(() => { saveLS(LS_GOALS, byDay); }, [byDay]);

  // Helpers retos (Mi zona)
  const loadRetos = (): Reto[] => loadLS<Reto[]>(LS_RETOS, []);
  const saveRetos = (retos: Reto[]) => saveLS(LS_RETOS, retos);

  function pushRetosForRepeat(baseText: string, repeat: Goal['repeat']) {
    const retos = loadRetos();
    if (repeat === 'perm') {
      retos.unshift({ id: crypto.randomUUID(), text: baseText, createdAt: Date.now(), due: today, done: false, permanent: true });
      saveRetos(retos);
      return;
    }
    const n = repeat ? parseInt(repeat, 10) : 0;
    const now = Date.now();
    if (n > 0) {
      for (let i = 0; i < n; i++) {
        const d = new Date(now); d.setDate(d.getDate() + i);
        retos.push({
          id: crypto.randomUUID(),
          text: baseText,
          createdAt: now,
          due: d.toISOString().slice(0, 10),
          done: false,
          permanent: false
        });
      }
      saveRetos(retos);
    } else {
      // Sin repetir: solo hoy
      retos.unshift({ id: crypto.randomUUID(), text: baseText, createdAt: Date.now(), due: today, done: false, permanent: false });
      saveRetos(retos);
    }
  }

  const add = () => {
    const t = text.trim();
    if (!t) return;

    // 1) Enviar a Mi zona según repeat
    pushRetosForRepeat(t, newRepeat);

    // 2) Guardar histórico local sin check
    const g: Goal = { id: crypto.randomUUID(), text: t, createdAt: Date.now(), done: false, repeat: newRepeat };
    setByDay({ ...byDay, [today]: [g, ...list] });
    setText('');
    setNewRepeat(undefined);
    alert('¡Fenomenal! Objetivo enviado a “Mi zona”.');
  };

  const edit = (id: string) => {
    const nuevo = prompt('Editar objetivo:', list.find(x => x.id === id)?.text || '');
    if (nuevo == null) return;
    const updated = list.map(x => x.id === id ? { ...x, text: nuevo } : x);
    setByDay({ ...byDay, [today]: updated });

    // Actualizar futuros retos con mismo id no es trivial; dejamos tal cual y añadimos uno nuevo para hoy
    // opción simple: añadir reto hoy con el nuevo texto
    pushRetosForRepeat(nuevo, updated.find(x => x.id === id)?.repeat);
  };

  const del = (id: string) => {
    setByDay({ ...byDay, [today]: list.filter(g => g.id !== id) });
    // No tocamos Mi zona histórica para no borrar si ya está en curso.
  };

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Objetivos para hoy</h3>
      <p className="muted">Se enviarán a <b>Mi zona</b> como retos del día.</p>

      {/* Crear objetivo */}
      <div className="rows" style={{ marginTop: 12 }}>
        <div className="row" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input className="input" placeholder="Escribe un objetivo…" value={text} onChange={e => setText(e.target.value)} />
          <RepeatPicker value={newRepeat} onChange={setNewRepeat} />
          <button className="btn" onClick={add}>Añadir</button>
        </div>

        {/* Histórico simple sin checkbox */}
        <ul className="list card">
          {list.length === 0 && <li style={{ padding: '8px 0' }} className="muted">Aún no hay objetivos guardados hoy.</li>}
          {list.map(g => (
            <li key={g.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', gap: 12 }}>
              <div>
                <span>{g.text}</span>
                {g.repeat && (
                  <span className="text-xs text-neutral-500 inline-block ml-2">
                    {repeatLabel(g.repeat)}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <RepeatPicker
                  value={g.repeat}
                  onChange={(v) => {
                    const updated = list.map(x => x.id === g.id ? { ...x, repeat: v } : x);
                    setByDay({ ...byDay, [today]: updated });
                    // al cambiar repetición, registrar en Mi zona a partir de hoy
                    pushRetosForRepeat(g.text, v);
                  }}
                />
                <button className="btn secondary" onClick={() => edit(g.id)}>Editar</button>
                <button className="btn red" onClick={() => del(g.id)}>Borrar</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ===========================
   Mis libros (pop-up directo, botón verde, editar/volver a leer)
   =========================== */
function BooksTool() {
  const [store, setStore] = useState<BooksStore>(() => loadLS<BooksStore>(LS_BOOKS, { reading: [], wishlist: [], finished: [] }));
  useEffect(() => { saveLS(LS_BOOKS, store); }, [store]);

  const [formR, setFormR] = useState({ title: '', author: '', notes: '' });
  const [formW, setFormW] = useState({ title: '', author: '', notes: '' });

  const addReading = () => {
    if (!formR.title.trim()) return alert('El nombre del libro es obligatorio');
    const now = Date.now();
    const book: BookReading = {
      id: crypto.randomUUID(),
      title: formR.title.trim(),
      author: formR.author.trim() || undefined,
      notes: formR.notes.trim() || undefined,
      createdAt: now,
      startedAt: now,
    };
    setStore({ ...store, reading: [book, ...store.reading] });
    setFormR({ title: '', author: '', notes: '' });
  };

  const finishReading = (id: string) => {
    const b = store.reading.find(x => x.id === id); if (!b) return;
    const finished: BookFinished = { ...b, finishedAt: Date.now() };
    setStore({ ...store, reading: store.reading.filter(x => x.id !== id), finished: [finished, ...store.finished] });
  };

  const addWishlist = () => {
    if (!formW.title.trim()) return alert('El nombre del libro es obligatorio');
    const now = Date.now();
    const b: BookBase = {
      id: crypto.randomUUID(),
      title: formW.title.trim(),
      author: formW.author.trim() || undefined,
      notes: formW.notes.trim() || undefined,
      createdAt: now,
    };
    setStore({ ...store, wishlist: [b, ...store.wishlist] });
    setFormW({ title: '', author: '', notes: '' });
  };

  // Modal compartir / confirmar "Empezar a leer" (directo)
  const [showModal, setShowModal] = useState<{ open: boolean; text: string; onConfirm: () => void }>({ open: false, text: '', onConfirm: () => {} });
  const closeModal = () => setShowModal({ open: false, text: '', onConfirm: () => {} });

  const startFromWishlist = (id: string) => {
    const b = store.wishlist.find(x => x.id === id); if (!b) return;
    const now = Date.now();
    const r: BookReading = { ...b, startedAt: now } as BookReading;

    const shareText = `Voy a empezar un nuevo libro: "${b.title}"${b.author ? ` de ${b.author}` : ''}. ¡Es una excelente noticia! Me estoy convirtiendo en un gran lector.`;
    const confirm = () => {
      setStore({
        ...store,
        wishlist: store.wishlist.filter(x => x.id !== id),
        reading: [r, ...store.reading],
      });
    };

    setShowModal({ open: true, text: shareText, onConfirm: () => { confirm(); closeModal(); } });
  };

  const shareLinks = useMemo(() => {
    const t = encodeURIComponent(showModal.text);
    return {
      whatsapp: `https://wa.me/?text=${t}`,
      twitter: `https://twitter.com/intent/tweet?text=${t}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?quote=${t}`,
      instagram: `https://www.instagram.com/`,
      tiktok: `https://www.tiktok.com/`,
    };
  }, [showModal.text]);

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Mis libros</h3>

      {/* Leyendo */}
      <section className="card" style={{ marginTop: 8 }}>
        <h4 style={{ margin: '0 0 8px' }}>Libros que me estoy leyendo</h4>
        <div className="rows">
          <input className="input" placeholder="Nombre del libro *" value={formR.title} onChange={e => setFormR({ ...formR, title: e.target.value })} />
          <input className="input" placeholder="Autor (opcional)" value={formR.author} onChange={e => setFormR({ ...formR, author: e.target.value })} />
          <textarea className="textarea" placeholder="¿Qué estás aprendiendo de este libro? (opcional)" value={formR.notes} onChange={e => setFormR({ ...formR, notes: e.target.value })} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn" onClick={addReading}>{store.reading.length ? 'Actualizar' : 'Guardar'}</button>
          </div>
        </div>

        <ul className="list" style={{ marginTop: 12 }}>
          {store.reading.map(b => (
            <li key={b.id} style={{ padding: '10px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div>
                  <strong>{b.title}</strong>{b.author ? ` · ${b.author}` : ''}
                  {b.notes && <div className="muted" style={{ marginTop: 4 }}>{b.notes}</div>}
                </div>
                <button className="btn red" onClick={() => finishReading(b.id)}>Terminar</button>
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
          <textarea className="textarea" placeholder="Notas (opcional)" value={formW.notes} onChange={e => setFormW({ ...formW, notes: e.target.value })} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn" onClick={addWishlist}>{store.wishlist.length ? 'Actualizar' : 'Guardar'}</button>
          </div>
        </div>
        <ul className="list" style={{ marginTop: 12 }}>
          {store.wishlist.map(b => (
            <li key={b.id} style={{ padding: '10px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{b.title}</strong>{b.author ? ` · ${b.author}` : ''}
                {b.notes && <div className="muted" style={{ marginTop: 4 }}>{b.notes}</div>}
              </div>
              <button className="btn" onClick={() => startFromWishlist(b.id)}>Empezar a leer</button>
            </li>
          ))}
        </ul>
      </section>

      {/* Terminados */}
      <section className="card" style={{ marginTop: 12 }}>
        <h4 style={{ margin: '0 0 8px' }}>Libros terminados</h4>
        <ul className="list">
          {store.finished.length === 0 && <li style={{ padding: '8px 0' }} className="muted">Aún no hay libros terminados.</li>}
          {store.finished.map(b => (
            <FinishedItem
              key={b.id}
              book={b}
              onUpdate={(nb) => {
                setStore({ ...store, finished: store.finished.map(x => x.id === nb.id ? nb : x) });
              }}
              onReRead={() => {
                const reread: BookReading = { ...b, startedAt: Date.now(), createdAt: Date.now() };
                setStore({ ...store, finished: store.finished.filter(x => x.id !== b.id), reading: [reread, ...store.reading] });
              }}
            />
          ))}
        </ul>
      </section>

      {/* Modal compartir */}
      {showModal.open && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0 }}>Vas a empezar un nuevo libro 📚</h4>
              <button onClick={closeModal} className="btn ghost" aria-label="Cerrar"><X size={16} /></button>
            </div>
            <p style={{ marginTop: 8 }}>
              ¡Es una excelente noticia! Te estás convirtiendo en un gran lector. ¿Te gustaría anunciar al mundo el libro que vas a comenzar?
              Eso reforzará tu deseo de hacerlo y puede motivar a los demás a seguir tu camino.
            </p>
            <div className="actions">
              <a href={shareLinks.whatsapp} target="_blank" rel="noreferrer">💬 WhatsApp</a>
              <a href={shareLinks.twitter} target="_blank" rel="noreferrer">🐦 Twitter/X</a>
              <a href={shareLinks.facebook} target="_blank" rel="noreferrer">📘 Facebook</a>
              <a href={shareLinks.instagram} target="_blank" rel="noreferrer">📸 Instagram</a>
              <a href={shareLinks.tiktok} target="_blank" rel="noreferrer">🎵 TikTok</a>
              <button className="btn green" onClick={showModal.onConfirm}>Vamos a por ello</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Subcomponente para "Libros terminados" con Editar/Volver a leer */
function FinishedItem({ book, onUpdate, onReRead }: {
  book: BookFinished;
  onUpdate: (b: BookFinished) => void;
  onReRead: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(book.notes || '');

  const save = () => { onUpdate({ ...book, notes: notes.trim() || undefined }); setEditing(false); };

  return (
    <li style={{ padding: '10px 0' }}>
      <div><strong>{book.title}</strong>{book.author ? ` · ${book.author}` : ''}</div>
      <small className="muted">Terminado el {fmtDate(book.finishedAt)}</small>

      {editing ? (
        <div className="rows" style={{ marginTop: 8 }}>
          <textarea className="textarea" placeholder="Notas del libro…" value={notes} onChange={e => setNotes(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn" onClick={save}>Guardar</button>
            <button className="btn ghost" onClick={() => { setNotes(book.notes || ''); setEditing(false); }}>Cancelar</button>
          </div>
        </div>
      ) : (
        <>
          {book.notes && <div className="muted" style={{ marginTop: 6 }}>{book.notes}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn secondary" onClick={() => setEditing(true)}>Editar</button>
            <button className="btn" onClick={onReRead}>Volver a leer</button>
          </div>
        </>
      )}
    </li>
  );
}
