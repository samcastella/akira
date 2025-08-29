'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Notebook, Heart, Target, BookOpen, Check, Trash2, Copy, X } from 'lucide-react';

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
  new Date(d).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtDate = (d: string | number) =>
  new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
const todayKey = () => new Date().toISOString().slice(0, 10);

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

type Goal = { id: string; text: string; done: boolean; createdAt: number };
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
   Notas (con Título) — incluye migración v1->v2
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

  const delNote = (id: string) => setNotes(notes.filter(n => n.id !== id));

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
            <div className="mb-1" style={{ fontSize: 11, color: '#777' }}>{fmtDateTime(n.createdAt)}</div>
            {n.title && <div style={{ fontWeight: 700, marginBottom: 4 }}>{n.title}</div>}
            {n.text && <p className="whitespace-pre-wrap" style={{ margin: 0 }}>{n.text}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={() => copyNote(n)} className="btn ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {copiedId === n.id ? <Check size={14} /> : <Copy size={14} />} {copiedId === n.id ? 'Copiado' : 'Copiar'}
              </button>
              <button onClick={() => delNote(n.id)} className="btn red" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Trash2 className="h-3.5 w-3.5" /> Borrar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===========================
   Gratitud (v2: filas) — abre "Entradas anteriores" al guardar
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
        <details className="accordion" open={!!current.savedAt}>
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

/* ===========================
   Objetivos para hoy → Mi zona (sin check, con Editar/Repetir/Borrar)
   =========================== */
function GoalsTool() {
  const [byDay, setByDay] = useState<GoalsByDay>(() => loadLS<GoalsByDay>(LS_GOALS, {}));
  const [text, setText] = useState('');
  const today = todayKey();
  const list = byDay[today] || [];

  useEffect(() => { saveLS(LS_GOALS, byDay); }, [byDay]);

  // Helpers retos (Mi zona)
  const loadRetos = (): Reto[] => loadLS<Reto[]>(LS_RETOS, []);
  const saveRetos = (retos: Reto[]) => saveLS(LS_RETOS, retos);

  const add = () => {
    const t = text.trim();
    if (!t) return;
    // 1) Enviar a Mi zona (no permanente por defecto)
    const reto: Reto = { id: crypto.randomUUID(), text: t, createdAt: Date.now(), due: today, done: false, permanent: false };
    saveRetos([reto, ...loadRetos()]);
    alert('¡Fenomenal! Has añadido un reto nuevo. Puedes verlo en “Mi zona”. Este reto se eliminará cuando lo hayas cumplido o si lo borras.');

    // 2) Guardar histórico local sin check
    const simple = { id: reto.id, text: reto.text, createdAt: reto.createdAt, done: false };
    setByDay({ ...byDay, [today]: [simple, ...list] });
    setText('');
  };

  const edit = (id: string) => {
    const nuevo = prompt('Editar objetivo:', list.find(x => x.id === id)?.text || '');
    if (nuevo == null) return;
    const updated = list.map(x => x.id === id ? { ...x, text: nuevo } : x);
    setByDay({ ...byDay, [today]: updated });
    const retos = loadRetos();
    saveRetos(retos.map(r => r.id === id ? { ...r, text: nuevo } : r));
  };

  const del = (id: string) => {
    setByDay({ ...byDay, [today]: list.filter(g => g.id !== id) });
    saveRetos(loadRetos().filter(r => r.id !== id));
  };

  const repetir = (id: string) => {
    const opciones = ['3', '7', '21', '30', 'permanente'];
    const sel = prompt('Repetir durante (3, 7, 21, 30 días o permanente):', '7');
    if (!sel || !opciones.includes(sel)) return;

    const base = list.find(x => x.id === id);
    if (!base) return;

    // ✅ Permanente: crear reto para HOY con permanent:true (Mi zona lo recreará al completarlo)
    if (sel === 'permanente') {
      const retos = loadRetos();
      retos.unshift({
        id: crypto.randomUUID(),
        text: base.text,
        createdAt: Date.now(),
        due: today,
        done: false,
        permanent: true,
      });
      saveRetos(retos);
      alert('He marcado este reto como permanente. Al completarlo en “Mi zona” se recreará automáticamente para mañana.');
      return;
    }

    // 3/7/21/30 días: crear uno por día empezando hoy
    const n = parseInt(sel, 10);
    const retos = loadRetos();
    for (let i = 0; i < n; i++) {
      const due = new Date(); due.setDate(due.getDate() + i);
      retos.push({ id: crypto.randomUUID(), text: base.text, createdAt: Date.now(), due: due.toISOString().slice(0, 10), done: false, permanent: false });
    }
    saveRetos(retos);
    alert(`¡Listo! Repetiré este reto durante ${n} días en “Mi zona”.`);
  };

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Objetivos para hoy</h3>
      <p className="muted">Se enviarán a <b>Mi zona</b> como retos del día.</p>

      <div className="rows" style={{ marginTop: 12 }}>
        <div className="row" style={{ display: 'flex', gap: 8 }}>
          <input className="input" placeholder="Escribe un objetivo…" value={text} onChange={e => setText(e.target.value)} />
          <button className="btn" onClick={add}>Añadir</button>
        </div>

        {/* Histórico simple sin checkbox */}
        <ul className="list card">
          {list.length === 0 && <li style={{ padding: '8px 0' }} className="muted">Aún no hay objetivos guardados hoy.</li>}
          {list.map(g => (
            <li key={g.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
              <span>{g.text}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn secondary" onClick={() => edit(g.id)}>Editar</button>
                <button className="btn" onClick={() => repetir(g.id)}>Repetir</button>
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
