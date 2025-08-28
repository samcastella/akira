'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { COLORS } from '@/lib/constants';
import { todayKey } from '@/lib/date';

/* ---- Notas ---- */
type Note = { id: string; text: string; createdAt: string; updatedAt?: string };
const NOTES_KEY = 'akira_notes_v1';
const loadNotes = (): Note[] => { try { return JSON.parse(localStorage.getItem(NOTES_KEY) || '[]'); } catch { return []; } };
const saveNotes = (notes: Note[]) => localStorage.setItem(NOTES_KEY, JSON.stringify(notes));

/* ---- Gratitud ---- */
type Gratitude = { date: string; items: string[]; note?: string };
const GRAT_KEY = 'akira_gratitude_v1';
const loadGratitude = (): Record<string, Gratitude> => { try { return JSON.parse(localStorage.getItem(GRAT_KEY) || '{}'); } catch { return {}; } };
const saveGratitude = (map: Record<string, Gratitude>) => localStorage.setItem(GRAT_KEY, JSON.stringify(map));

/* ---- Imágenes ---- */
type ImageItem = { id: string; url: string; createdAt: string };
const IMAGES_KEY = 'akira_images_v2';
const loadImages = (): ImageItem[] => { try { return JSON.parse(localStorage.getItem(IMAGES_KEY) || '[]'); } catch { return []; } };
const saveImages = (imgs: ImageItem[]) => localStorage.setItem(IMAGES_KEY, JSON.stringify(imgs));

export default function Herramientas() {
  const [tab, setTab] = useState<'notas' | 'gratitud' | 'imagenes'>('imagenes');

  // Notas
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // Gratitud
  const [grat, setGrat] = useState<Record<string, Gratitude>>({});
  const today = todayKey();
  const todayEntry = grat[today] || { date: today, items: ['', '', ''], note: '' };
  const [gItems, setGItems] = useState<string[]>(todayEntry.items);
  const [gNote, setGNote] = useState<string>(todayEntry.note || '');

  // Imágenes
  const [images, setImages] = useState<ImageItem[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setNotes(loadNotes());
    setGrat(loadGratitude());
    setImages(loadImages());
  }, []);
  useEffect(() => {
    if (!grat[today]) return;
    setGItems(grat[today].items);
    setGNote(grat[today].note || '');
  }, [grat, today]);

  /* --- acciones Notas --- */
  const addNote = () => {
    const text = draft.trim(); if (!text) return;
    const n: Note = { id: `${Date.now()}`, text, createdAt: new Date().toISOString() };
    const next = [n, ...notes]; setNotes(next); saveNotes(next); setDraft('');
  };
  const removeNote = (id: string) => { const next = notes.filter(n => n.id !== id); setNotes(next); saveNotes(next); };
  const startEdit = (n: Note) => { setEditingId(n.id); setEditText(n.text); };
  const saveEdit = () => {
    if (!editingId) return;
    const next = notes.map(n => n.id === editingId ? { ...n, text: editText, updatedAt: new Date().toISOString() } : n);
    setNotes(next); saveNotes(next); setEditingId(null); setEditText('');
  };
  const copyToClipboard = async (text: string) => { try { await navigator.clipboard.writeText(text); } catch {} };

  /* --- acciones Gratitud --- */
  const saveTodayGratitude = () => {
    const cleaned = gItems.map(s => s.trim());
    const map = { ...grat, [today]: { date: today, items: cleaned, note: gNote.trim() } };
    setGrat(map); saveGratitude(map);
  };
  const pastDays = Object.values(grat).filter(g => g.date !== today).sort((a, b) => b.date.localeCompare(a.date));

  /* --- acciones Imágenes --- */
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const newImg: ImageItem = { id: `${Date.now()}`, url: reader.result as string, createdAt: new Date().toISOString() };
      const next = [newImg, ...images]; setImages(next); saveImages(next);
    };
    reader.readAsDataURL(file);
  };
  const openViewer = (idx: number) => { setCurrentIndex(idx); setViewerOpen(true); };
  const closeViewer = () => setViewerOpen(false);
  const nextImg = () => setCurrentIndex(i => (i + 1) % images.length);
  const prevImg = () => setCurrentIndex(i => (i - 1 + images.length) % images.length);
  const deleteImage = (id: string) => {
    const next = images.filter(im => im.id !== id);
    setImages(next); saveImages(next);
    if (viewerOpen) { if (next.length === 0) setViewerOpen(false); else setCurrentIndex(i => Math.min(i, next.length - 1)); }
  };
  const shareImage = async (img: ImageItem) => {
    if (navigator.share) {
      try { await navigator.share({ title: 'Mira mi progreso 💪', text: 'Mi logro en Build your habits App', url: img.url }); } catch {}
    } else {
      try { await navigator.clipboard.writeText(img.url); alert('Enlace copiado al portapapeles.'); }
      catch { alert('Compartir no soportado en este dispositivo.'); }
    }
  };

  return (
    <div className="py-6">
      <h2 className="text-xl font-semibold">Herramientas</h2>
      <p className="mt-1 text-sm text-black/70">Escribe, agradece y guarda recuerdos visuales de tus logros.</p>

      {/* Tabs */}
      <div className="mt-4 flex gap-2 flex-wrap">
        <button onClick={() => setTab('notas')}
          className={`rounded-full px-4 py-2 text-sm border ${tab === 'notas' ? 'bg-black text-white' : 'bg-white text-black'}`}
          style={{ borderColor: COLORS.line }}>
          Mis notas
        </button>
        <button onClick={() => setTab('gratitud')}
          className={`rounded-full px-4 py-2 text-sm border ${tab === 'gratitud' ? 'bg-black text-white' : 'bg-white text-black'}`}
          style={{ borderColor: COLORS.line }}>
          Diario de gratitud
        </button>
        <button onClick={() => setTab('imagenes')}
          className={`rounded-full px-4 py-2 text-sm border ${tab === 'imagenes' ? 'bg-black text-white' : 'bg-white text-black'}`}
          style={{ borderColor: COLORS.line }}>
          Imágenes
        </button>
      </div>

      {/* --- IMÁGENES (Instagram-like) --- */}
      {tab === 'imagenes' && (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border p-4" style={{ borderColor: COLORS.line }}>
            <label className="block text-sm font-medium mb-2">Sube o haz una foto que te motive</label>
            <input type="file" accept="image/*" capture="environment" onChange={handleUpload} className="block w-full text-sm" />
            <p className="mt-2 text-xs text-black/60">Ideas: logros, progreso, lugares que te hacen sentir bien…</p>
          </div>

          <div className="grid grid-cols-3 gap-1">
            {images.length === 0 && (
              <div className="col-span-3 text-sm text-black/60 p-4 text-center border rounded-xl" style={{ borderColor: COLORS.line }}>
                Aún no has subido imágenes.
              </div>
            )}
            {images.map((img, idx) => (
              <button key={img.id} onClick={() => openViewer(idx)} className="relative w-full overflow-hidden" aria-label="Abrir imagen">
                <div className="relative w-full" style={{ height: 0, paddingBottom: '100%' }}>
                  <img src={img.url} alt="progreso" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                </div>
                <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-200 hover:bg-black/30" />
              </button>
            ))}
          </div>

          <p className="text-[11px] text-black/50">Las fotos se guardan en tu dispositivo (localStorage). Puedes compartirlas cuando quieras.</p>

          <AnimatePresence>
            {viewerOpen && images[currentIndex] && (
              <motion.div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <button onClick={closeViewer}
                        className="absolute right-3 top-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                        aria-label="Cerrar"><X className="h-6 w-6" /></button>

                <div className="mx-auto w-full max-w-3xl px-4">
                  <img src={images[currentIndex].url} alt="vista" className="max-h-[70vh] w-full object-contain rounded-xl" />
                  <div className="mt-3 flex items-center justify-between text-white">
                    <span className="text-xs opacity-80">{new Date(images[currentIndex].createdAt).toLocaleString()}</span>
                    <div className="flex gap-2">
                      <button onClick={() => shareImage(images[currentIndex])} className="rounded-full bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20">Compartir</button>
                      <button onClick={() => deleteImage(images[currentIndex].id)} className="rounded-full bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20">Borrar</button>
                    </div>
                  </div>
                </div>

                {images.length > 1 && (
                  <>
                    <button onClick={prevImg}
                            className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                            aria-label="Anterior"><ChevronLeft className="h-6 w-6" /></button>
                    <button onClick={nextImg}
                            className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                            aria-label="Siguiente"><ChevronRight className="h-6 w-6" /></button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* --- MIS NOTAS --- */}
      {tab === 'notas' && (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border p-4" style={{ borderColor: COLORS.line }}>
            <label className="text-sm font-medium">Escribe una nota</label>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
                      placeholder="Frases que te inspiran, ideas, reflexiones..."
                      className="mt-2 w-full rounded-xl border p-3 text-sm" style={{ borderColor: COLORS.line }} rows={4}/>
            <div className="mt-3 flex justify-end">
              <button onClick={addNote} className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white">Guardar nota</button>
            </div>
          </div>

          <div className="rounded-2xl border" style={{ borderColor: COLORS.line }}>
            <div className="px-4 py-3 text-sm font-medium">Tus notas ({notes.length})</div>
            <div className="divide-y" style={{ borderColor: COLORS.line }}>
              {notes.length === 0 && <div className="px-4 py-4 text-sm text-black/60">Aún no tienes notas guardadas.</div>}
              {notes.map((n) => (
                <div key={n.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs text-black/50">{new Date(n.createdAt).toLocaleString()}</div>
                    <div className="flex gap-2">
                      {editingId === n.id ? (
                        <button onClick={saveEdit} className="rounded-full bg-black px-3 py-1.5 text-xs text-white">Guardar</button>
                      ) : (
                        <button onClick={() => startEdit(n)} className="rounded-full bg-white px-3 py-1.5 text-xs border" style={{ borderColor: COLORS.line }}>Editar</button>
                      )}
                      <button onClick={() => copyToClipboard(n.text)} className="rounded-full bg-white px-3 py-1.5 text-xs border" style={{ borderColor: COLORS.line }}>Copiar</button>
                      <button onClick={() => removeNote(n.id)} className="rounded-full bg-white px-3 py-1.5 text-xs border text-red-600" style={{ borderColor: COLORS.line }}>Borrar</button>
                    </div>
                  </div>
                  {editingId === n.id ? (
                    <textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="mt-2 w-full rounded-xl border p-3 text-sm" style={{ borderColor: COLORS.line }} rows={3}/>
                  ) : (
                    <p className="mt-2 whitespace-pre-wrap text-sm">{n.text}</p>
                  )}
                  {n.updatedAt && <div className="mt-1 text-[11px] text-black/50">Editado: {new Date(n.updatedAt).toLocaleString()}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- DIARIO DE GRATITUD --- */}
      {tab === 'gratitud' && (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border p-4" style={{ borderColor: COLORS.line }}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Hoy · {new Date().toLocaleDateString()}</div>
              <div className="text-xs text-black/60">Escribe 3 cosas por las que dar las gracias</div>
            </div>

            <div className="mt-3 space-y-2">
              {gItems.map((val, i) => (
                <input key={i} value={val} onChange={(e) => { const next = [...gItems]; next[i] = e.target.value; setGItems(next); }}
                       placeholder={`Agradecimiento ${i + 1}`} className="w-full rounded-xl border p-3 text-sm" style={{ borderColor: COLORS.line }}/>
              ))}
              <textarea value={gNote} onChange={(e) => setGNote(e.target.value)}
                        placeholder="Notas o reflexión del día (opcional)"
                        className="w-full rounded-xl border p-3 text-sm" style={{ borderColor: COLORS.line }} rows={3}/>
              <div className="flex justify-end">
                <button onClick={saveTodayGratitude} className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white">Guardar</button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border" style={{ borderColor: COLORS.line }}>
            <div className="px-4 py-3 text-sm font-medium">Entradas anteriores</div>
            <div className="divide-y" style={{ borderColor: COLORS.line }}>
              {pastDays.length === 0 && <div className="px-4 py-4 text-sm text-black/60">Todavía no hay registros anteriores.</div>}
              {pastDays.map((g) => (
                <details key={g.date} className="group px-4 py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between">
                    <span className="text-sm">{new Date(g.date + 'T00:00:00').toLocaleDateString()}</span>
                    <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                  </summary>
                  <ul className="mt-2 list-disc pl-5 text-sm">
                    {g.items.filter(Boolean).map((it, idx) => <li key={idx}>{it}</li>)}
                  </ul>
                  {g.note && <p className="mt-2 text-sm text-black/70 whitespace-pre-wrap">{g.note}</p>}
                </details>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
