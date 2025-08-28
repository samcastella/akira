'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  Home, ListChecks, User, GraduationCap, Users, X, ChevronRight,
  Plus, Trash2, Edit3, Pushpin, ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Archivo_Black } from 'next/font/google';

/* ===== Tipografía para títulos de cards ===== */
const archivoBlack = Archivo_Black({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-archivo-black',
});

/* ===== Colores ===== */
const COLORS = {
  bg: '#ffffff',
  text: '#111111',
  accent: '#FFD54F', // amarillo barra
  black: '#000000',
  line: '#eaeaea',
};

type TabKey = 'inicio' | 'habitos' | 'mizona' | 'herramientas' | 'amigos';

/* =========================
   Utils de almacenamiento
   ========================= */

const ls = {
  get<T>(key: string, fallback: T): T {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; }
    catch { return fallback; }
  },
  set<T>(key: string, value: T) { localStorage.setItem(key, JSON.stringify(value)); },
};

/* ===== Modelos ===== */
type Note = {
  id: string;
  title?: string;
  text: string;
  pinned?: boolean;
  createdAt: string;
  updatedAt: string;
};

type GratitudeEntry = {
  date: string;     // YYYY-MM-DD
  items: string[];  // mínimo 3
  updatedAt: string;
};

type FeelImg = {
  id: string;
  dataUrl: string;    // DataURL (base64)
  caption?: string;
  createdAt: string;
};

/* ===== Claves LS ===== */
const LS_NOTES = 'akira_notes_v1';
const LS_GRAT = 'akira_gratitude_v1';
const LS_FEEL = 'akira_feelgood_v1';

/* ===== Pensamientos (L→D) ===== */
type Thought = { title: string; text: string };

const THOUGHTS_BY_DAY: Record<number, Thought> = {
  1: { title: 'Visualízate', text: 'Imagina por un momento que ya lo lograste. Hoy dedica 2–3 minutos a verte consiguiendo tus objetivos.' },
  2: { title: 'Un paso más', text: 'Elige hoy una acción mínima y hazla. Lo pequeño, suma.' },
  3: { title: 'Eres constante', text: 'La disciplina es volver incluso en los días que pesan. Una página, un paso.' },
  4: { title: 'Confía en ti', text: 'Piensa en un reto que ya superaste. Puedes con este también.' },
  5: { title: 'El presente cuenta', text: 'El cambio comienza ahora. Haz algo sencillo hoy.' },
  6: { title: 'Pequeñas victorias', text: 'Suma un gesto que te acerque a tu meta y celébralo.' },
  0: { title: 'Agradece', text: 'Reconoce lo logrado esta semana. Respira y agradece.' },
};
const todayThought = () => THOUGHTS_BY_DAY[new Date().getDay()];

/* ===== Hábitos destacados (home) ===== */
interface HabitCardData {
  key: string;
  title: string;
  subtitle: string;
  image: string; // ruta en /public
}

const FEATURED_HABITS: HabitCardData[] = [
  { key: 'lectura',    title: 'La máquina lectora',      subtitle: 'Conviértete en un superlector',                      image: '/reading.jpg' },
  { key: 'burpees',    title: 'Unos f*kn burpees',       subtitle: 'Comienza hoy y no pares',                            image: '/burpees.jpg' },
  { key: 'ahorro',     title: 'Ahorra sin darte cuenta', subtitle: 'Un hábito pequeño que cambia tu futuro',            image: '/savings.jpg' },
  { key: 'meditacion', title: 'Medita 5 minutos',        subtitle: 'Encuentra calma en tu día',                         image: '/meditation.jpg' },
];

/* ===== Layout ===== */
const NAV_HEIGHT = 84;

function SafeContainer({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mx-auto w-full max-w-md px-4"
      style={{ paddingBottom: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))` }}
    >
      {children}
    </div>
  );
}

/* ===== Bottom Nav ===== */
function BottomNav({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (k: TabKey) => void;
}) {
  const items: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: 'inicio',        label: 'Inicio',        icon: Home },
    { key: 'habitos',       label: 'Hábitos',       icon: ListChecks },
    { key: 'mizona',        label: 'Mi zona',       icon: User },
    { key: 'herramientas',  label: 'Herramientas',  icon: GraduationCap },
    { key: 'amigos',        label: 'Amigos',        icon: Users },
  ];

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30"
      style={{
        height: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
        background: COLORS.accent,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="mx-auto grid h-full max-w-md grid-cols-5">
        {items.map(({ key, label, icon: Icon }) => {
          const isActive = key === active;

          let bg = COLORS.accent;
          let fg = COLORS.text;

          if (key === 'mizona') {
            bg = isActive ? '#ffffff' : COLORS.black;
            fg = isActive ? COLORS.text : '#ffffff';
          } else {
            bg = isActive ? '#ffffff' : COLORS.accent;
            fg = COLORS.text;
          }

          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className="flex h-full flex-col items-center justify-center transition-colors"
              style={{ background: bg, color: fg }}
              aria-label={label}
            >
              <Icon className="h-6 w-6" />
              <span className="mt-1 text-[12px] leading-none">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ===== Modal Pensamiento ===== */
function ThoughtModal({
  open,
  onClose,
  thought,
}: {
  open: boolean;
  onClose: () => void;
  thought: Thought;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="flex h-full items-center justify-center p-6">
            <motion.div
              className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
            >
              <button
                onClick={onClose}
                className="absolute right-3 top-3 rounded-full p-1 text-black/70 hover:bg-black/5"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
              <h3 className="mb-2 text-xl font-semibold">{thought.title}</h3>
              <p className="whitespace-pre-line text-sm text-black/70">{thought.text}</p>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ===== Card Hábito (4:5, full-bleed) ===== */
function HabitCard({
  data,
  onStart,
}: {
  data: HabitCardData;
  onStart: (key: string) => void;
}) {
  return (
    <div className="relative overflow-hidden">
      <div className="relative w-full" style={{ aspectRatio: '4 / 5' }}>
        <Image
          src={data.image}
          alt={data.title}
          fill
          sizes="(max-width: 768px) 100vw, 600px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/0" />
      </div>
      <div className="absolute inset-0 flex flex-col justify-end p-5">
        <div className="text-white/85 text-sm">{data.subtitle}</div>
        <div className={`${archivoBlack.className} text-white text-4xl leading-tight`}>
          {data.title}
        </div>
        <button
          onClick={() => onStart(data.key)}
          className="mt-3 inline-flex items-center gap-2 self-start rounded-full bg-white/95 px-4 py-2 text-sm font-medium text-black hover:bg-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5z"/></svg>
          Empezar ahora
        </button>
      </div>
    </div>
  );
}

/* ==============================
   HERRAMIENTAS: 3 submódulos
   ============================== */

/* --- Mis notas --- */
function ToolsNotes() {
  const [notes, setNotes] = useState<Note[]>(() => ls.get<Note[]>(LS_NOTES, []));
  const [editing, setEditing] = useState<Note | null>(null);

  const saveAll = (next: Note[]) => { setNotes(next); ls.set(LS_NOTES, next); };

  const createNote = () => {
    const n: Note = {
      id: crypto.randomUUID(),
      title: '',
      text: '',
      pinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setEditing(n);
  };

  const saveNote = (n: Note) => {
    n.updatedAt = new Date().toISOString();
    const exists = notes.some(x => x.id === n.id);
    const next = exists ? notes.map(x => x.id === n.id ? n : x) : [n, ...notes];
    saveAll(next);
    setEditing(null);
  };

  const togglePin = (id: string) => {
    const next = notes.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n);
    saveAll(next);
  };

  const remove = (id: string) => {
    if (!confirm('¿Borrar nota?')) return;
    saveAll(notes.filter(n => n.id !== id));
  };

  const sorted = [...notes].sort((a,b) => (b.pinned?1:0) - (a.pinned?1:0) || (b.updatedAt.localeCompare(a.updatedAt)));

  return (
    <div className="py-4">
      {!editing ? (
        <>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Mis notas</h3>
            <button onClick={createNote} className="inline-flex items-center gap-2 rounded-full bg-black px-3 py-2 text-white text-sm">
              <Plus className="h-4 w-4" /> Nueva
            </button>
          </div>
          {sorted.length === 0 ? (
            <p className="text-sm text-black/60">Escribe frases, reflexiones, ideas… aquí se guardarán y podrás editarlas.</p>
          ) : (
            <div className="space-y-3">
              {sorted.map(n => (
                <div key={n.id} className="rounded-2xl border p-3" style={{ borderColor: COLORS.line }}>
                  <div className="mb-1 flex items-center gap-2">
                    <button onClick={() => togglePin(n.id)} className="rounded p-1 hover:bg-black/5" aria-label="Fijar">
                      <Pushpin className={`h-4 w-4 ${n.pinned ? 'text-black' : 'text-black/40'}`} />
                    </button>
                    <div className="text-xs text-black/50">{new Date(n.updatedAt).toLocaleString()}</div>
                  </div>
                  {n.title ? <div className="text-base font-semibold">{n.title}</div> : null}
                  <div className="whitespace-pre-line text-sm text-black/80">{n.text || '— (vacía)'}</div>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => setEditing(n)} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm" style={{ borderColor: COLORS.line }}>
                      <Edit3 className="h-4 w-4" /> Editar
                    </button>
                    <button onClick={() => remove(n.id)} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm" style={{ borderColor: COLORS.line }}>
                      <Trash2 className="h-4 w-4" /> Borrar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="rounded-2xl border p-3" style={{ borderColor: COLORS.line }}>
          <div className="mb-3 flex items-center gap-2">
            <button onClick={() => setEditing(null)} className="rounded-full p-2 hover:bg-black/5"><ChevronLeft className="h-5 w-5" /></button>
            <div className="text-sm text-black/60">Editando nota</div>
          </div>
          <input
            placeholder="Título (opcional)"
            value={editing.title ?? ''}
            onChange={(e) => setEditing({ ...editing, title: e.target.value })}
            className="mb-2 w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: COLORS.line }}
          />
          <textarea
            placeholder="Escribe aquí…"
            value={editing.text}
            onChange={(e) => setEditing({ ...editing, text: e.target.value })}
            rows={8}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: COLORS.line }}
          />
          <div className="mt-3 flex gap-2">
            <button onClick={() => saveNote(editing)} className="rounded-full bg-black px-4 py-2 text-sm text-white">Guardar</button>
            <button onClick={() => setEditing(null)} className="rounded-full border px-4 py-2 text-sm" style={{ borderColor: COLORS.line }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* --- Gratitud --- */
function formatYMD(d: Date) { return d.toISOString().slice(0,10); }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate()+n); return x; }

function ToolsGratitude() {
  const [map, setMap] = useState<Record<string, GratitudeEntry>>(() => ls.get(LS_GRAT, {} as Record<string, GratitudeEntry>));
  const [date, setDate] = useState<Date>(new Date());
  const key = formatYMD(date);
  const entry = map[key] ?? { date: key, items: ['', '', ''], updatedAt: new Date().toISOString() };

  const save = (e: GratitudeEntry) => {
    const next = { ...map, [e.date]: { ...e, updatedAt: new Date().toISOString() } };
    setMap(next); ls.set(LS_GRAT, next);
  };

  const setItem = (idx: number, val: string) => {
    const items = [...entry.items];
    if (idx >= items.length) items.length = idx+1;
    items[idx] = val;
    save({ ...entry, items });
  };

  return (
    <div className="py-4">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => setDate(addDays(date,-1))} className="rounded-full p-2 hover:bg-black/5"><ChevronLeft className="h-5 w-5" /></button>
        <div className="text-sm font-medium">{date.toLocaleDateString()}</div>
        <button onClick={() => setDate(addDays(date,1))} className="rounded-full p-2 hover:bg-black/5"><ChevronRight className="h-5 w-5" /></button>
      </div>
      <p className="mb-3 text-sm text-black/70">Escribe las cosas por las que dar las gracias hoy.</p>

      {Array.from({ length: Math.max(3, entry.items.length) }).map((_, i) => (
        <input
          key={i}
          placeholder={`Gracias por… #${i+1}`}
          value={entry.items[i] ?? ''}
          onChange={(e) => setItem(i, e.target.value)}
          className="mb-2 w-full rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: COLORS.line }}
        />
      ))}
      <div className="mt-2">
        <button
          onClick={() => setItem(entry.items.length, '')}
          className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm"
          style={{ borderColor: COLORS.line }}
        >
          <Plus className="h-4 w-4" /> Añadir línea
        </button>
      </div>
    </div>
  );
}

/* --- Imágenes feel-good --- */
function ToolsFeelGood() {
  const [imgs, setImgs] = useState<FeelImg[]>(() => ls.get<FeelImg[]>(LS_FEEL, []));
  const saveAll = (next: FeelImg[]) => { setImgs(next); ls.set(LS_FEEL, next); };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const arr: FeelImg[] = [];
    for (const f of Array.from(files)) {
      const dataUrl = await fileToDataURL(f);
      arr.push({ id: crypto.randomUUID(), dataUrl, createdAt: new Date().toISOString() });
    }
    saveAll([...arr, ...imgs]);
    e.target.value = '';
  };

  const remove = (id: string) => {
    if (!confirm('¿Eliminar imagen?')) return;
    saveAll(imgs.filter(i => i.id !== id));
  };

  return (
    <div className="py-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Imágenes que me hacen sentir bien</h3>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-black px-3 py-2 text-white text-sm">
          <Plus className="h-4 w-4" /> Añadir
          <input type="file" accept="image/*" multiple onChange={onPick} className="hidden" />
        </label>
      </div>

      {imgs.length === 0 ? (
        <p className="text-sm text-black/60">Sube fotos que te transmitan calma y energía positiva: atardeceres, familia, mascotas…</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {imgs.map(im => (
            <div key={im.id} className="relative overflow-hidden rounded-lg">
              <img src={im.dataUrl} alt="feel good" className="h-full w-full object-cover" />
              <button
                onClick={() => remove(im.id)}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                aria-label="Borrar"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function fileToDataURL(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

/* ===== Página principal ===== */
export default function Page() {
  const [tab, setTab] = useState<TabKey>('inicio');

  // Splash 1.5s
  const [showSplash, setShowSplash] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 1500);
    return () => clearTimeout(t);
  }, []);

  // Pensamiento del día (1 vez/día)
  const thought = useMemo(() => todayThought(), []);
  const [openThought, setOpenThought] = useState(false);
  useEffect(() => {
    if (showSplash) return;
    const key = `thought_${new Date().toDateString()}`;
    const shown = localStorage.getItem(key);
    if (!shown) {
      setOpenThought(true);
      localStorage.setItem(key, 'shown');
    }
  }, [showSplash]);

  if (showSplash) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: COLORS.accent }}>
        <div className="relative h-screen w-screen">
          <Image src="/splash.jpg" alt="Build your habits" fill className="object-cover" priority />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: COLORS.bg, color: COLORS.text }}>
      <SafeContainer>
        {/* INICIO */}
        {tab === 'inicio' && (
          <div className="py-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h1 className="text-lg font-semibold">Pensamiento del día</h1>
                <p className="text-xs text-black/60">{thought.title}: toca para leerlo de nuevo</p>
              </div>
              <button
                onClick={() => setOpenThought(true)}
                className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white"
              >
                Ver pensamiento
              </button>
            </div>

            <div className="-mx-4">
              {FEATURED_HABITS.map((h) => (
                <div key={h.key}>
                  <HabitCard data={h} onStart={(key) => alert(`Abrir programa: ${key}`)} />
                </div>
              ))}
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl bg-white">
              <div className="p-5">
                <div className="mb-3 text-2xl font-bold leading-snug">
                  ¿Listo para más? <br /> Descubre todos los hábitos
                </div>
                <button
                  onClick={() => setTab('habitos')}
                  className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 text-white"
                >
                  Ver hábitos <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* HÁBITOS (lista simple reutilizando cards) */}
        {tab === 'habitos' && (
          <div className="py-6">
            <h2 className="text-xl font-semibold">Hábitos</h2>
            <p className="mt-1 text-sm text-black/70">Explora programas para instaurar o eliminar hábitos.</p>
            <div className="mt-4 -mx-4">
              {FEATURED_HABITS.map((h) => (
                <div key={h.key}>
                  <HabitCard data={h} onStart={(key) => alert(`Abrir programa: ${key}`)} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MI ZONA (seguirá creciendo) */}
        {tab === 'mizona' && (
          <div className="py-6">
            <h2 className="text-xl font-semibold">Mi Zona</h2>
            <p className="mt-1 text-sm text-black/70">Tu progreso, rachas y objetivos (calendario y contadores llegarán en la siguiente iteración).</p>
          </div>
        )}

        {/* HERRAMIENTAS */}
        {tab === 'herramientas' && (
          <div className="py-6">
            <h2 className="text-xl font-semibold">Herramientas</h2>
            <p className="mt-1 text-sm text-black/70">Espacio para escribir, agradecer y guardar imágenes que te hacen bien.</p>

            <div className="mt-4 space-y-6">
              <section className="rounded-2xl border p-4" style={{ borderColor: COLORS.line }}>
                <h3 className="mb-2 text-base font-semibold">Mis notas</h3>
                <ToolsNotes />
              </section>

              <section className="rounded-2xl border p-4" style={{ borderColor: COLORS.line }}>
                <h3 className="mb-2 text-base font-semibold">Diario de gratitud</h3>
                <ToolsGratitude />
              </section>

              <section className="rounded-2xl border p-4" style={{ borderColor: COLORS.line }}>
                <h3 className="mb-2 text-base font-semibold">Imágenes que me hacen sentir bien</h3>
                <ToolsFeelGood />
              </section>
            </div>
          </div>
        )}

        {/* AMIGOS (placeholder) */}
        {tab === 'amigos' && (
          <div className="py-6">
            <h2 className="text-xl font-semibold">Amigos</h2>
            <p className="mt-1 text-sm text-black/70">Pronto: grupos de retos, invitaciones y puntos.</p>
          </div>
        )}
      </SafeContainer>

      <BottomNav active={tab} onChange={setTab} />
      <ThoughtModal open={openThought} onClose={() => setOpenThought(false)} thought={thought} />
    </div>
  );
}
