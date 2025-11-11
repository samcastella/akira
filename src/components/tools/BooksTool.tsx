'use client';

import React, { useEffect, useState } from 'react';
import { loadLS, saveLS, fmtDate } from './_helpers';

const LS_BOOKS = 'akira_books_v1';

type BookBase = { id: string; title: string; author?: string; notes?: string; pages?: number; createdAt: number };
type BookReading = BookBase & { startedAt: number };
type BookFinished = BookBase & { finishedAt: number };
type BooksStore = { reading: BookReading[]; wishlist: BookBase[]; finished: BookFinished[] };

export default function BooksTool() {
  const [store, setStore] = useState<BooksStore>(() => loadLS<BooksStore>(LS_BOOKS, { reading: [], wishlist: [], finished: [] }));
  useEffect(() => { saveLS(LS_BOOKS, store); }, [store]);

  // Formularios
  const [formR, setFormR] = useState({ title: '', author: '', notes: '', pages: '' });
  const [formW, setFormW] = useState({ title: '', author: '', notes: '', pages: '' });

  // Stats modal
  const [statsOpen, setStatsOpen] = useState(false);
  const finishedCount = store.finished.length;
  const pagesRead = store.finished.reduce((acc, b) => acc + (b.pages || 0), 0);

  // Modal genérico
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

      {/* Modal estadísticas */}
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

      {/* Modal edición genérica */}
      {modal.open && modal.data && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{ width: 'min(560px, 92vw)' }}>
            <h4 style={{ marginTop: 0 }}>
              {modal.kind === 'reading' ? 'Libro en lectura'
               : modal.kind === 'wishlist' ? 'Libro en lista de deseos'
               : 'Libro terminado'}
            </h4>

            <div className="rows">
              <input className="input" placeholder="Título" value={modal.form.title}
                     onChange={e=>setModal(m=>({ ...m, form: { ...m.form, title: e.target.value } }))} />
              <input className="input" placeholder="Autor (opcional)" value={modal.form.author}
                     onChange={e=>setModal(m=>({ ...m, form: { ...m.form, author: e.target.value } }))} />
              <input className="input" placeholder="Número de páginas (opcional)" inputMode="numeric" value={modal.form.pages}
                     onChange={e=>setModal(m=>({ ...m, form: { ...m.form, pages: e.target.value } }))} />
              <textarea className="textarea" placeholder="Notas (opcional)" value={modal.form.notes}
                        onChange={e=>setModal(m=>({ ...m, form: { ...m.form, notes: e.target.value } }))} />
            </div>

            <div className="flex gap-2 justify-end mt-3">
              {modal.kind === 'wishlist' && !modal.editing && (
                <button className="btn" onClick={() => startFromWishlist((modal.data as BookBase).id)}>Empezar a leer</button>
              )}
              {modal.kind === 'finished' && !modal.editing && (
                <button className="btn" onClick={() => rereadFinished((modal.data as BookFinished).id)}>Volver a leer</button>
              )}
              {modal.kind === 'reading' && !modal.editing && (
                <button className="btn red" onClick={() => finishReading((modal.data as BookReading).id)}>Terminar</button>
              )}

              <button className="btn" disabled={!hasChanges} onClick={saveModal}>Guardar</button>
              <button className="btn ghost" onClick={closeModal}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
