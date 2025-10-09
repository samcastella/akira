'use client';

import React, { useEffect, useState } from 'react';
import { Pencil, Trash2, Save } from 'lucide-react';
import { loadLS, saveLS, fmtDateTime } from './_helpers';

/* v1 -> v2 migración */
const LS_NOTES = 'akira_notes_v2';
const OLD_LS_NOTES = 'akira_notes_v1';
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
  } catch {}
}

type Note = { id: string; title: string; text: string; createdAt: number };

export default function NotasTool() {
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
