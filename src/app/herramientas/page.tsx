'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Camera, Image as ImageIcon, Share2, Trash2, Download, X, Copy, Check } from 'lucide-react';

/* ===========================
   Helpers de almacenamiento
   =========================== */
const LS_NOTES = 'akira_notes_v1';
const LS_GRATITUDE = 'akira_gratitude_v1';
const LS_IMAGES = 'akira_images_v1';

function loadLS<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}
function saveLS<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}
const fmt = (d: string | number) =>
  new Date(d).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/* ===========================
   Tipos
   =========================== */
type Note = { id: string; text: string; createdAt: number };
type GratitudeEntry = { id: string; text: string; date: string; createdAt: number }; // date = YYYY-MM-DD
type Photo = { id: string; dataUrl: string; caption?: string; createdAt: number };

/* ===========================
   Herramientas
   =========================== */
export default function Herramientas() {
  const [tab, setTab] = useState<'notas' | 'gratitud' | 'imagenes'>('notas');

  return (
    <div className="py-6">
      <h2 className="text-xl font-semibold">Herramientas</h2>
      <p className="mt-1 text-sm text-black/70">
        Apoya tus hábitos con notas rápidas, gratitud diaria e imágenes tipo Instagram.
      </p>

      {/* Tabs */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <button
          onClick={() => setTab('notas')}
          className={`rounded-full px-4 py-2 text-sm font-medium ${tab === 'notas' ? 'bg-black text-white' : 'bg-black/5'}`}
        >
          Mis notas
        </button>
        <button
          onClick={() => setTab('gratitud')}
          className={`rounded-full px-4 py-2 text-sm font-medium ${tab === 'gratitud' ? 'bg-black text-white' : 'bg-black/5'}`}
        >
          Diario de gratitud
        </button>
        <button
          onClick={() => setTab('imagenes')}
          className={`rounded-full px-4 py-2 text-sm font-medium ${tab === 'imagenes' ? 'bg-black text-white' : 'bg-black/5'}`}
        >
          Imágenes
        </button>
      </div>

      <div className="mt-5">
        {tab === 'notas' && <NotasTool />}
        {tab === 'gratitud' && <GratitudTool />}
        {tab === 'imagenes' && <ImagenesTool />}
      </div>
    </div>
  );
}

/* ===========================
   Notas
   =========================== */
function NotasTool() {
  const [notes, setNotes] = useState<Note[]>(() => loadLS<Note[]>(LS_NOTES, []));
  const [text, setText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => { saveLS(LS_NOTES, notes); }, [notes]);

  const addNote = () => {
    const t = text.trim();
    if (!t) return;
    setNotes([{ id: crypto.randomUUID(), text: t, createdAt: Date.now() }, ...notes]);
    setText('');
  };

  const delNote = (id: string) => setNotes(notes.filter(n => n.id !== id));

  const copyNote = async (n: Note) => {
    try {
      await navigator.clipboard.writeText(n.text);
      setCopiedId(n.id);
      setTimeout(() => setCopiedId(null), 1200);
    } catch {}
  };

  return (
    <div className="rounded-2xl border p-4">
      <h3 className="text-base font-semibold">Mis notas</h3>
      <div className="mt-3 space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe una nota rápida…"
          className="w-full resize-none rounded-xl border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
          rows={3}
        />
        <div className="flex justify-end">
          <button onClick={addNote} className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white">
            Guardar nota
          </button>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {notes.length === 0 && <div className="text-sm text-black/60">Aún no tienes notas.</div>}
        {notes.map(n => (
          <div key={n.id} className="rounded-xl border p-3">
            <div className="mb-1 text-[11px] text-black/50">{fmt(n.createdAt)}</div>
            <p className="whitespace-pre-wrap text-sm text-black/80">{n.text}</p>
            <div className="mt-2 flex gap-2">
              <button onClick={() => copyNote(n)} className="inline-flex items-center gap-1 rounded-full bg-black/5 px-3 py-1.5 text-xs">
                {copiedId === n.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copiedId === n.id ? 'Copiado' : 'Copiar'}
              </button>
              <button onClick={() => delNote(n.id)} className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1.5 text-xs text-red-600">
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
   Gratitud
   =========================== */
function GratitudTool() {
  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [list, setList] = useState<GratitudeEntry[]>(() => loadLS<GratitudeEntry[]>(LS_GRATITUDE, []));
  const [text, setText] = useState(() => list.find(e => e.date === todayKey)?.text || '');

  useEffect(() => { saveLS(LS_GRATITUDE, list); }, [list]);

  const saveToday = () => {
    const t = text.trim();
    if (!t) return;
    const existing = list.find(e => e.date === todayKey);
    if (existing) {
      existing.text = t;
      existing.createdAt = Date.now();
      setList([...list]);
    } else {
      setList([{ id: crypto.randomUUID(), text: t, date: todayKey, createdAt: Date.now() }, ...list]);
    }
  };

  const past = list
    .filter(e => e.date !== todayKey)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 20);

  return (
    <div className="rounded-2xl border p-4">
      <h3 className="text-base font-semibold">Diario de gratitud</h3>
      <p className="mt-1 text-sm text-black/70">
        Escribe 1–3 cosas por las que te sientas agradecido hoy.
      </p>

      <div className="mt-3 space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Hoy agradezco…"
          className="w-full resize-none rounded-xl border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
          rows={3}
        />
        <div className="flex justify-end">
          <button onClick={saveToday} className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white">
            Guardar entrada de hoy
          </button>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 text-sm font-medium">Entradas anteriores</div>
        {past.length === 0 && <div className="text-sm text-black/60">No hay entradas aún.</div>}
        <div className="space-y-3">
          {past.map(e => (
            <div key={e.id} className="rounded-xl border p-3">
              <div className="mb-1 text-[11px] text-black/50">{fmt(e.createdAt)}</div>
              <p className="whitespace-pre-wrap text-sm text-black/80">{e.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ===========================
   Imágenes (estilo Instagram)
   =========================== */
function ImagenesTool() {
  const [photos, setPhotos] = useState<Photo[]>(() => loadLS<Photo[]>(LS_IMAGES, []));
  const [lightbox, setLightbox] = useState<Photo | null>(null);
  const [busy, setBusy] = useState(false);
  const ordered = useMemo(() => [...photos].sort((a, b) => b.createdAt - a.createdAt), [photos]);

  useEffect(() => { saveLS(LS_IMAGES, photos); }, [photos]);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files.length) return;
    setBusy(true);
    const newItems: Photo[] = [];
    for (const file of Array.from(files)) {
      const dataUrl = await fileToDataURL(file);
      newItems.push({ id: crypto.randomUUID(), dataUrl, createdAt: Date.now() });
    }
    setPhotos(prev => [...newItems, ...prev]);
    e.target.value = '';
    setBusy(false);
  };

  const removePhoto = (id: string) => {
    setPhotos(photos.filter(p => p.id !== id));
    setLightbox(null);
  };

  const sharePhoto = async (p: Photo) => {
    // Intento Web Share con archivos (mejor experiencia móvil)
    try {
      const file = dataURLtoFile(p.dataUrl, `akira-${p.id}.png`);
      if ((navigator as any).canShare?.({ files: [file] }) && (navigator as any).share) {
        await (navigator as any).share({
          files: [file],
          title: 'Mi progreso',
          text: 'Compartiendo un momento de mi proceso con Akira 💛',
        });
        return;
      }
    } catch {}
    // Fallback: copiar texto + abrir imagen en pestaña (descarga manual)
    try {
      await navigator.clipboard.writeText('Compartiendo mi progreso con Akira 💛');
    } catch {}
    const a = document.createElement('a');
    a.href = p.dataUrl;
    a.download = 'akira.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    alert('Imagen descargada. ¡Lista para subirla a Instagram!');
  };

  return (
    <div className="rounded-2xl border p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Imágenes</h3>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-medium text-white">
          <Camera className="h-4 w-4" />
          Subir
          <input type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={onPick} />
        </label>
      </div>
      <p className="mt-1 text-sm text-black/70">
        Sube fotos de cosas que te hacen sentir bien, tus progresos o logros. Podrás verlas en tu galería y compartirlas en redes.
      </p>

      {/* Grid 3x3 tipo Instagram */}
      <div className="mt-4 grid grid-cols-3 gap-1">
        {ordered.map((p) => (
          <button key={p.id} onClick={() => setLightbox(p)} className="relative block w-full overflow-hidden bg-black/5" style={{ aspectRatio: '1 / 1' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.dataUrl} alt="foto" className="h-full w-full object-cover" />
          </button>
        ))}
        {ordered.length === 0 && (
          <div className="col-span-3 flex flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center text-sm text-black/60">
            <ImageIcon className="mb-2 h-6 w-6" />
            Aún no hay imágenes.
            <div className="mt-1">Toca <b>Subir</b> para añadir la primera.</div>
          </div>
        )}
      </div>

      {/* Busy */}
      {busy && <div className="mt-3 text-xs text-black/60">Procesando…</div>}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-40 bg-black/80">
          <button onClick={() => setLightbox(null)} className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white backdrop-blur">
            <X className="h-5 w-5" />
          </button>
          <div className="flex h-full flex-col items-center justify-center p-4">
            <div className="max-h-[70vh] w-full max-w-md overflow-hidden rounded-xl bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={lightbox.dataUrl} alt="foto" className="h-full w-full object-contain" />
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => sharePhoto(lightbox)} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium">
                <Share2 className="h-4 w-4" /> Compartir
              </button>
              <button onClick={() => downloadDataURL(lightbox.dataUrl)} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium">
                <Download className="h-4 w-4" /> Descargar
              </button>
              <button onClick={() => removePhoto(lightbox.id)} className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white">
                <Trash2 className="h-4 w-4" /> Borrar
              </button>
            </div>
            <div className="mt-2 text-xs text-white/70">Sugerencia: después de compartir, añade una descripción y etiquetas 💪</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===========================
   Utils imágenes (dataURL)
   =========================== */
function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function dataURLtoFile(dataUrl: string, filename: string): File {
  const [header, b64] = dataUrl.split(',');
  const mime = /data:(.*?);base64/.exec(header)?.[1] || 'image/png';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new File([arr], filename, { type: mime });
}
function downloadDataURL(dataUrl: string, filename = 'akira.png') {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
