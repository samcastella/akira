'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  Home, ListChecks, User, GraduationCap, Users, X, ChevronRight, ChevronDown, ChevronUp, ArrowLeft, Edit3, Trash2, Save, Clipboard as ClipboardIcon, NotebookPen
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Archivo_Black } from 'next/font/google';

/* ============================= */
/* Tipografía para títulos       */
/* ============================= */
const archivoBlack = Archivo_Black({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-archivo-black',
});

/* ============================= */
/* Colores                       */
/* ============================= */
const COLORS = {
  bg: '#ffffff',
  text: '#111111',
  accent: '#FFD54F', // barra inferior
  black: '#000000',
  line: '#eaeaea',
  green: '#22c55e',
  orange: '#f59e0b',
  red: '#ef4444',
  gray: '#e5e7eb',
};

/* ============================= */
/* Utilidades de fecha           */
/* ============================= */
const todayKey = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const dateKey = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => { const c = new Date(d); c.setDate(c.getDate() + n); return c; };
const diffDays = (a: Date, b: Date) => Math.floor((a.getTime() - b.getTime()) / 86400000);
const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

/* ============================= */
/* Navegación                    */
/* ============================= */
type TabKey = 'inicio' | 'habitos' | 'mizona' | 'formacion' | 'amigos';

/* ============================= */
/* Pensamiento del día           */
/* ============================= */
type Thought = { title: string; text: string };

const THOUGHTS_BY_DAY: Record<number, Thought> = {
  1: { title: 'Visualízate', text: 'Imagina por un momento que ya lo lograste. Si tu reto es empezar a correr, mírate dentro de unos meses cruzando la meta... Hoy dedica 2–3 minutos a cerrar los ojos y verte consiguiendo tus objetivos.' },
  2: { title: 'Un paso más', text: 'No importa lo lejos que esté tu meta. Hoy comprométete a dar un paso pequeño: 5 páginas de lectura o 10 minutos de entreno.' },
  3: { title: 'Eres constante', text: 'La disciplina es volver incluso en los días que pesan. Elige una acción mínima para no romper la cadena.' },
  4: { title: 'Confía en ti', text: 'Piensa en un reto que ya superaste. Escribe tres cualidades tuyas que te ayudarán a conseguir tu meta.' },
  5: { title: 'El presente cuenta', text: 'Empieza con algo sencillo hoy: guarda 1€ o elige una comida sana. El cambio comienza ahora.' },
  6: { title: 'Pequeñas victorias', text: 'Camina 10 minutos, bebe un vaso de agua extra o envía ese mensaje pendiente. Suma victorias.' },
  0: { title: 'Reflexiona y agradece', text: 'Reconoce lo logrado esta semana. Respira y agradece una acción que te hizo avanzar.' },
};

const todayThought = () => THOUGHTS_BY_DAY[new Date().getDay()];

/* ============================= */
/* Programa Lectura 21 días      */
/* ============================= */
type DayTasks = { tasks: string[] };
type ProgramDef = {
  key: string;
  name: string;
  image: string;
  benefits: string[];
  howItWorks: string[];
  days: DayTasks[]; // 21
};

const READING_PROGRAM: ProgramDef = {
  key: 'lectura',
  name: 'Conviértete en una máquina lectora',
  image: '/reading.jpg',
  benefits: [
    'Mejora tu concentración y claridad mental',
    'Aumenta tu creatividad y vocabulario',
    'Reduce el estrés y mejora el sueño',
  ],
  howItWorks: [
    '21 días con 2–3 micro-retos diarios.',
    'Semana 1: 1–5 páginas (súper fácil). Semana 2: 5–10. Semana 3: 10–15.',
    'Registra cada día en “Mi Zona” marcando los checks.',
  ],
  days: [
    { tasks: ['Ve a una librería y elige un libro ≤ 200–300 páginas.', 'Colócalo en un lugar visible.', 'Define hora/lugar y pon una alarma diaria.'] }, // 1
    { tasks: ['Lee 1 página.', 'Escribe por qué elegiste ese libro.', 'Haz una foto de tu rincón de lectura.'] }, // 2
    { tasks: ['Lee 1–5 páginas (si lees más, genial).', 'Prepara tu ritual (café, té, luz).', 'Marca una frase que te inspire.'] }, // 3
    { tasks: ['Lee 1–5 páginas.', 'Lee en voz alta un párrafo.', 'Escribe una frase sobre lo que sentiste.'] }, // 4
    { tasks: ['Lee 1–5 páginas en un lugar distinto.', 'Apunta una idea clave.', 'Cuéntaselo a alguien.'] }, // 5
    { tasks: ['Lee 1–5 páginas.', 'Evalúa tu concentración (1–5).', 'Ajusta la hora si no encaja.'] }, // 6
    { tasks: ['Lee 1–5 páginas.', 'Relee tus notas o frases marcadas.', 'Celebra la primera semana.'] }, // 7
    { tasks: ['Lee 5 páginas.', 'Apunta 1 frase aplicable hoy.', 'Compártela con alguien.'] }, // 8
    { tasks: ['Lee 6 páginas.', 'Asocia lectura a otro hábito (después de desayunar).', 'Escribe lo más útil del día.'] }, // 9
    { tasks: ['Lee 6–7 páginas.', 'Marca 2 aprendizajes clave.', 'Recompénsate con algo sencillo.'] }, // 10
    { tasks: ['Lee 7 páginas.', 'Comparte lo más interesante con un amigo.', 'Haz check en tu racha.'] }, // 11
    { tasks: ['Lee 8 páginas.', 'Marca una idea aplicable hoy.', 'Ponla en práctica.'] }, // 12
    { tasks: ['Lee 8–9 páginas.', 'Escribe una reflexión de 2 frases.', 'Haz una foto del libro y compártela.'] }, // 13
    { tasks: ['Lee 10 páginas en tu lugar favorito.', 'Balance de semana: ¿qué aprendiste?', 'Recompénsate.'] }, // 14
    { tasks: ['Escribe: “Soy el tipo de persona que lee cada día”.', 'Lee 10 páginas.', 'Habla con alguien de tu hábito.'] }, // 15
    { tasks: ['Elige tu próxima lectura.', 'Lee 11 páginas.', 'Haz una story con tu frase favorita.'] }, // 16
    { tasks: ['Lee 12 páginas.', 'Mini-resumen (3–4 frases).', 'Meta: terminar libro en X días.'] }, // 17
    { tasks: ['Lee 12–13 páginas.', 'Marca 2 ideas prácticas.', 'Aplica 1 hoy mismo.'] }, // 18
    { tasks: ['Lee 13 páginas.', 'Cuenta a alguien qué estás aprendiendo.', 'Refuerza tu identidad lectora.'] }, // 19
    { tasks: ['Lee 14 páginas.', 'Repasa todas tus notas.', 'Elige la idea más transformadora.'] }, // 20
    { tasks: ['Lee 15 páginas o termina el libro.', 'Balance final del reto.', 'Comparte tu logro y planifica el siguiente libro.'] }, // 21
  ],
};

const PROGRAMS: Record<string, ProgramDef> = {
  [READING_PROGRAM.key]: READING_PROGRAM,
};

/* ============================= */
/* Estado en localStorage        */
/* (con migración)               */
/* ============================= */
type ProgramState = {
  startDate: string;                       // YYYY-MM-DD
  completedDates?: string[];               // (LEGADO)
  completedByDate?: Record<string, number[]>; // nuevo: por día, índices de retos completados
};
type ProgramsStore = Record<string, ProgramState>;
const STORAGE_KEY = 'akira_programs_v2';

function loadStore(): ProgramsStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data: ProgramsStore = raw ? JSON.parse(raw) : {};
    // Migración desde formato viejo
    Object.keys(data).forEach((k) => {
      const st = data[k];
      if (!st.completedByDate) st.completedByDate = {};
      if (st.completedDates && st.completedDates.length) {
        const prog = PROGRAMS[k];
        st.completedDates.forEach((d) => {
          const dayIdx = getRelativeDayIndexForDate(k, d);
          const n = prog?.days[dayIdx - 1]?.tasks.length ?? 0;
          st.completedByDate![d] = Array.from({ length: n }, (_, i) => i);
        });
        delete st.completedDates;
      }
    });
    return data;
  } catch {
    return {};
  }
}
function saveStore(store: ProgramsStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}
function ensureProgram(key: string) {
  const store = loadStore();
  if (!store[key]) {
    store[key] = { startDate: todayKey(), completedByDate: {} };
    saveStore(store);
  }
}
function startProgram(key: string) {
  const store = loadStore();
  if (!store[key]) {
    store[key] = { startDate: todayKey(), completedByDate: {} };
    saveStore(store);
  }
}
function toggleTaskToday(key: string, taskIndex: number) {
  const store = loadStore();
  if (!store[key]) return;
  const t = todayKey();
  const list = new Set(store[key].completedByDate?.[t] ?? []);
  list.has(taskIndex) ? list.delete(taskIndex) : list.add(taskIndex);
  if (!store[key].completedByDate) store[key].completedByDate = {};
  store[key].completedByDate[t] = Array.from(list).sort((a, b) => a - b);
  saveStore(store);
}
function isTaskTodayCompleted(key: string, taskIndex: number) {
  const store = loadStore();
  return !!store[key]?.completedByDate?.[todayKey()]?.includes(taskIndex);
}
function getRelativeDayIndexForDate(key: string, dateStr: string): number {
  const store = loadStore();
  const start = store[key]?.startDate;
  if (!start) return 0;
  const idx = diffDays(new Date(dateStr + 'T00:00:00'), new Date(start + 'T00:00:00')) + 1;
  return idx >= 1 && idx <= (PROGRAMS[key]?.days.length ?? 21) ? idx : 0;
}
function getProgressPercent(key: string) {
  const store = loadStore();
  const st = store[key];
  const prog = PROGRAMS[key];
  if (!st || !prog) return 0;
  let completedDays = 0;
  const start = new Date(st.startDate + 'T00:00:00');
  const end = new Date();
  const totalDays = Math.min(diffDays(end, start) + 1, prog.days.length);
  for (let i = 0; i < totalDays; i++) {
    const dKey = dateKey(addDays(start, i));
    const n = prog.days[i]?.tasks.length ?? 0;
    const done = st.completedByDate?.[dKey]?.length ?? 0;
    if (n > 0 && done >= n) completedDays++;
  }
  return Math.min(100, Math.round((completedDays / prog.days.length) * 100));
}

/* ============================= */
/* Cards portada                 */
/* ============================= */
interface HabitCardData {
  key: string; title: string; subtitle: string; image: string;
}
const FEATURED_HABITS: HabitCardData[] = [
  { key: 'lectura',    title: 'La máquina lectora',      subtitle: 'Conviértete en un superlector',                      image: '/reading.jpg' },
  { key: 'burpees',    title: 'Unos f*kn burpees',       subtitle: 'Comienza hoy y no pares',                            image: '/burpees.jpg' },
  { key: 'ahorro',     title: 'Ahorra sin darte cuenta', subtitle: 'Un hábito pequeño que cambia tu futuro',            image: '/savings.jpg' },
  { key: 'meditacion', title: 'Medita 5 minutos',        subtitle: 'Encuentra calma en tu día',                         image: '/meditation.jpg' },
];

/* ============================= */
/* Layout                        */
/* ============================= */
const NAV_HEIGHT = 84;
function SafeContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md px-4" style={{ paddingBottom: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))` }}>
      {children}
    </div>
  );
}

/* Bottom Nav (Mi zona negro cuando no está activa) */
function BottomNav({ active, onChange }: { active: TabKey; onChange: (k: TabKey) => void; }) {
  const items: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: 'inicio', label: 'Inicio', icon: Home },
    { key: 'habitos', label: 'Hábitos', icon: ListChecks },
    { key: 'mizona', label: 'Mi zona', icon: User },
    // Renombrado visual de "Formación" -> "Herramientas"
    { key: 'formacion', label: 'Herramientas', icon: GraduationCap },
    { key: 'amigos', label: 'Amigos', icon: Users },
  ];
  return (
    <div className="fixed inset-x-0 bottom-0 z-30" style={{ height: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))`, background: COLORS.accent, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="mx-auto grid h-full max-w-md grid-cols-5">
        {items.map(({ key, label, icon: Icon }) => {
          const isActive = key === active;
          let bg = COLORS.accent, fg = COLORS.text;
          if (key === 'mizona') { bg = isActive ? '#ffffff' : COLORS.black; fg = isActive ? COLORS.text : '#ffffff'; }
          else { bg = isActive ? '#ffffff' : COLORS.accent; fg = COLORS.text; }
          return (
            <button key={key} onClick={() => onChange(key)} className="flex h-full flex-col items-center justify-center transition-colors" style={{ background: bg, color: fg }} aria-label={label}>
              <Icon className="h-6 w-6" /><span className="mt-1 text-[12px] leading-none">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================= */
/* Modal Pensamiento             */
/* ============================= */
function ThoughtModal({ open, onClose, thought }: { open: boolean; onClose: () => void; thought: Thought; }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="flex h-full items-center justify-center p-6">
            <motion.div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }}>
              <button onClick={onClose} className="absolute right-3 top-3 rounded-full p-1 text-black/70 hover:bg-black/5" aria-label="Cerrar"><X className="h-5 w-5" /></button>
              <h3 className="mb-2 text-xl font-semibold">{thought.title}</h3>
              <p className="whitespace-pre-line text-sm text-black/70">{thought.text}</p>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ============================= */
/* Card Hábito (4:5 + CTA)       */
/* ============================= */
function HabitCard({ data, onOpen }: { data: HabitCardData; onOpen: (key: string) => void; }) {
  return (
    <div className="relative overflow-hidden" onClick={() => onOpen(data.key)} role="button" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen(data.key)} aria-label={data.title}>
      <div className="relative w-full" style={{ height: 0, paddingBottom: '125%', backgroundColor: '#111' }}>
        <Image src={data.image} alt={data.title} fill sizes="(max-width: 768px) 100vw, 600px" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
      </div>
      <div className="absolute inset-0 flex flex-col justify-end p-5">
        <div className="text-white/85 text-sm">{data.subtitle}</div>
        <div className={`${archivoBlack.className} text-white text-4xl leading-tight`}>{data.title}</div>
        <button
          className="mt-3 inline-flex items-center gap-2 self-start rounded-full bg-white px-4 py-2 text-sm font-medium text-black shadow"
          onClick={(e) => { e.stopPropagation(); onOpen(data.key); }}>
          Empieza ahora
        </button>
      </div>
    </div>
  );
}

/* ============================= */
/* Detalle del hábito            */
/* ============================= */
function HabitDetail({ program, onBack, onStarted }: { program: ProgramDef; onBack: () => void; onStarted: () => void; }) {
  const [openedHow, setOpenedHow] = useState(false);
  const [justStarted, setJustStarted] = useState(false);
  const [progress, setProgress] = useState(getProgressPercent(program.key));
  const dayIndex = getRelativeDayIndexForDate(program.key, todayKey()) || 1;

  useEffect(() => {
    const id = setInterval(() => setProgress(getProgressPercent(program.key)), 800);
    return () => clearInterval(id);
  }, [program.key]);

  const handleStart = () => { startProgram(program.key); setJustStarted(true); setProgress(getProgressPercent(program.key)); onStarted(); };

  return (
    <div className="pb-6">
      <div className="relative w-full overflow-hidden rounded-b-2xl" style={{ height: 0, paddingBottom: '56.25%', backgroundColor: '#111' }}>
        <Image src={program.image} alt={program.name} fill className="object-cover" priority />
        <div className="absolute left-3 top-3"><button onClick={onBack} className="rounded-full bg-black/60 p-2 text-white"><ArrowLeft className="h-5 w-5" /></button></div>
      </div>

      <div className="mt-4">
        <h1 className={`${archivoBlack.className} text-3xl leading-tight`}>{program.name}</h1>
        <p className="mt-2 text-sm text-black/70">Beneficios de la lectura:</p>
        <ul className="mt-2 list-disc pl-5 text-sm text-black/80">{program.benefits.map((b, i) => (<li key={i}>{b}</li>))}</ul>
      </div>

      <div className="mt-4 rounded-2xl border" style={{ borderColor: COLORS.line }}>
        <button onClick={() => setOpenedHow(!openedHow)} className="flex w-full items-center justify-between px-4 py-3">
          <span className="text-base font-medium">¿Cómo funciona?</span>
          {openedHow ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>
        <AnimatePresence>
          {openedHow && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              <ul className="space-y-2 px-4 pb-4 text-sm text-black/70">{program.howItWorks.map((it, i) => (<li key={i}>• {it}</li>))}</ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-5 rounded-2xl border p-4" style={{ borderColor: COLORS.line }}>
        <div className="flex items-center justify-between">
          <button onClick={handleStart} className="rounded-full bg-black px-5 py-3 text-sm font-medium text-white">Empieza ahora</button>
          <div className="text-sm text-black/60">Día {dayIndex} / 21</div>
        </div>
        {justStarted && <div className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">¡Enhorabuena por tu primer día del reto!</div>}
        <div className="mt-4">
          <div className="h-3 w-full rounded-full bg-gray-200"><div className="h-3 rounded-full bg-black transition-all" style={{ width: `${progress}%` }} /></div>
          <div className="mt-1 text-right text-xs text-black/60">{progress}%</div>
        </div>
      </div>
    </div>
  );
}

/* ============================= */
/* Herramientas (Mis notas + Diario) */
/* ============================= */
type Note = { id: string; text: string; createdAt: string; updatedAt?: string };
const NOTES_KEY = 'akira_notes_v1';
function loadNotes(): Note[] {
  try { return JSON.parse(localStorage.getItem(NOTES_KEY) || '[]'); } catch { return []; }
}
function saveNotes(notes: Note[]) { localStorage.setItem(NOTES_KEY, JSON.stringify(notes)); }

type Gratitude = { date: string; items: string[]; note?: string };
const GRAT_KEY = 'akira_gratitude_v1';
function loadGratitude(): Record<string, Gratitude> {
  try { return JSON.parse(localStorage.getItem(GRAT_KEY) || '{}'); } catch { return {}; }
}
function saveGratitude(map: Record<string, Gratitude>) { localStorage.setItem(GRAT_KEY, JSON.stringify(map)); }

function Herramientas() {
  const [tab, setTab] = useState<'notas' | 'gratitud'>('notas');

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

  useEffect(() => {
    setNotes(loadNotes());
    setGrat(loadGratitude());
  }, []);

  // sync cuando cambia el mapa de gratitud
  useEffect(() => {
    if (!grat[today]) return;
    setGItems(grat[today].items);
    setGNote(grat[today].note || '');
  }, [grat]);

  const addNote = () => {
    const text = draft.trim();
    if (!text) return;
    const n: Note = { id: `${Date.now()}`, text, createdAt: new Date().toISOString() };
    const next = [n, ...notes];
    setNotes(next); saveNotes(next); setDraft('');
  };
  const removeNote = (id: string) => {
    const next = notes.filter(n => n.id !== id);
    setNotes(next); saveNotes(next);
  };
  const startEdit = (n: Note) => { setEditingId(n.id); setEditText(n.text); };
  const saveEdit = () => {
    if (!editingId) return;
    const next = notes.map(n => n.id === editingId ? { ...n, text: editText, updatedAt: new Date().toISOString() } : n);
    setNotes(next); saveNotes(next); setEditingId(null); setEditText('');
  };
  const copyToClipboard = async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch { /* noop */ }
  };

  const saveTodayGratitude = () => {
    const cleaned = gItems.map(s => s.trim());
    const map = { ...grat, [today]: { date: today, items: cleaned, note: gNote.trim() } };
    setGrat(map); saveGratitude(map);
  };

  const pastDays = Object.values(grat)
    .filter(g => g.date !== today)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="py-6">
      <h2 className="text-xl font-semibold">Herramientas</h2>
      <p className="mt-1 text-sm text-black/70">Tu espacio para escribir y agradecer cada día.</p>

      {/* Pills */}
      <div className="mt-4 flex gap-2">
        <button onClick={() => setTab('notas')}
          className={`rounded-full px-4 py-2 text-sm border ${tab === 'notas' ? 'bg-black text-white' : 'bg-white text-black'}`}
          style={{ borderColor: COLORS.line }}>
          <span className="inline-flex items-center gap-2"><NotebookPen className="h-4 w-4" /> Mis notas</span>
        </button>
        <button onClick={() => setTab('gratitud')}
          className={`rounded-full px-4 py-2 text-sm border ${tab === 'gratitud' ? 'bg-black text-white' : 'bg-white text-black'}`}
          style={{ borderColor: COLORS.line }}>
          Diario de gratitud
        </button>
      </div>

      {/* --- MIS NOTAS --- */}
      {tab === 'notas' && (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border p-4" style={{ borderColor: COLORS.line }}>
            <label className="text-sm font-medium">Escribe una nota</label>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Frases que te inspiran, ideas, reflexiones..."
              className="mt-2 w-full rounded-xl border p-3 text-sm"
              style={{ borderColor: COLORS.line }}
              rows={4}
            />
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
                        <button onClick={saveEdit} className="rounded-full bg-black px-3 py-1.5 text-xs text-white inline-flex items-center gap-1"><Save className="h-4 w-4" /> Guardar</button>
                      ) : (
                        <button onClick={() => startEdit(n)} className="rounded-full bg-white px-3 py-1.5 text-xs inline-flex items-center gap-1 border" style={{ borderColor: COLORS.line }}><Edit3 className="h-4 w-4" /> Editar</button>
                      )}
                      <button onClick={() => copyToClipboard(n.text)} className="rounded-full bg-white px-3 py-1.5 text-xs inline-flex items-center gap-1 border" style={{ borderColor: COLORS.line }}><ClipboardIcon className="h-4 w-4" /> Copiar</button>
                      <button onClick={() => removeNote(n.id)} className="rounded-full bg-white px-3 py-1.5 text-xs inline-flex items-center gap-1 border text-red-600" style={{ borderColor: COLORS.line }}><Trash2 className="h-4 w-4" /> Borrar</button>
                    </div>
                  </div>
                  {editingId === n.id ? (
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="mt-2 w-full rounded-xl border p-3 text-sm"
                      style={{ borderColor: COLORS.line }}
                      rows={3}
                    />
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
                <input
                  key={i}
                  value={val}
                  onChange={(e) => {
                    const next = [...gItems]; next[i] = e.target.value; setGItems(next);
                  }}
                  placeholder={`Agradecimiento ${i + 1}`}
                  className="w-full rounded-xl border p-3 text-sm"
                  style={{ borderColor: COLORS.line }}
                />
              ))}
              <textarea
                value={gNote}
                onChange={(e) => setGNote(e.target.value)}
                placeholder="Notas o reflexión del día (opcional)"
                className="w-full rounded-xl border p-3 text-sm"
                style={{ borderColor: COLORS.line }}
                rows={3}
              />
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

/* ============================= */
/* Mi Zona                       */
/* ============================= */
function totalsForDate(dateStr: string) {
  const store = loadStore();
  let total = 0; let done = 0;
  for (const k of Object.keys(store)) {
    const prog = PROGRAMS[k]; if (!prog) continue;
    const idx = getRelativeDayIndexForDate(k, dateStr);
    if (idx < 1) continue;
    const n = prog.days[idx - 1]?.tasks.length ?? 0;
    total += n;
    const arr = store[k].completedByDate?.[dateStr] ?? [];
    done += Math.min(arr.length, n);
  }
  return { total, done };
}
type DayColor = 'empty' | 'none' | 'some' | 'all';
function dayColorStatus(dateStr: string): DayColor {
  const { total, done } = totalsForDate(dateStr);
  if (total === 0) return 'empty';
  if (done === 0) {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date(todayKey() + 'T00:00:00');
    return d < today ? 'none' : 'empty';
  }
  if (done < total) return 'some';
  return 'all';
}

function MiZona() {
  const [name, setName] = useState<string>('Amigo/a');
  const [, setTick] = useState(0);
  const bump = () => setTick((v) => v + 1);

  useEffect(() => {
    setName(localStorage.getItem('akira_name') || 'Amigo/a');
  }, []);

  const store = loadStore();
  const active = Object.keys(store).filter((k) => PROGRAMS[k]);

  const allDatesWithAny = new Set<string>();
  let totalChecks = 0;
  Object.keys(store).forEach((k) => {
    const map = store[k].completedByDate || {};
    Object.entries(map).forEach(([d, arr]) => {
      if ((arr?.length ?? 0) > 0) allDatesWithAny.add(d);
      totalChecks += arr.length;
    });
  });
  const daysWithAny = allDatesWithAny.size;

  const now = new Date();
  const y = now.getFullYear(); const m = now.getMonth();
  const nDays = daysInMonth(y, m);
  const monthPrefix = `${y}-${String(m + 1).padStart(2, '0')}-`;

  return (
    <div className="py-6">
      <div className="mb-4">
        <h2 className={`${archivoBlack.className} text-3xl leading-tight`}>Hola {name}</h2>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border p-4" style={{ borderColor: COLORS.line }}>
          <div className={`${archivoBlack.className} text-4xl`}>{totalChecks}</div>
          <div className="text-sm text-black/60">retos completados</div>
        </div>
        <div className="rounded-2xl border p-4" style={{ borderColor: COLORS.line }}>
          <div className={`${archivoBlack.className} text-4xl`}>{daysWithAny}</div>
          <div className="text-sm text-black/60">días cumpliendo retos</div>
        </div>
      </div>

      <div className="rounded-2xl border p-4" style={{ borderColor: COLORS.line }}>
        <div className="mb-2 text-sm font-medium">Este mes</div>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: nDays }, (_, i) => {
            const day = i + 1;
            const dKey = `${monthPrefix}${String(day).padStart(2, '0')}`;
            const status = dayColorStatus(dKey);
            let bg = 'transparent', br = COLORS.gray;
            if (status === 'none') { bg = COLORS.red; br = COLORS.red; }
            if (status === 'some') { bg = COLORS.orange; br = COLORS.orange; }
            if (status === 'all')  { bg = COLORS.green; br = COLORS.green; }
            return (
              <div key={dKey} className="flex items-center justify-center rounded-full text-xs"
                   style={{ width: 28, height: 28, background: bg, border: `1px solid ${br}`, color: bg === 'transparent' ? '#111' : '#fff' }}>
                {day}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-3 text-xs text-black/60">
          <span className="inline-flex h-3 w-3 rounded-full" style={{ background: COLORS.red }} /> Sin marcar
          <span className="inline-flex h-3 w-3 rounded-full" style={{ background: COLORS.orange }} /> Parcial
          <span className="inline-flex h-3 w-3 rounded-full" style={{ background: COLORS.green }} /> Completado
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {active.length === 0 && (
          <div className="rounded-2xl border p-4 text-sm text-black/70" style={{ borderColor: COLORS.line }}>
            Aún no has empezado ningún programa. Ve a “Hábitos” o “Inicio” para comenzar uno.
          </div>
        )}

        {active.map((key) => {
          const p = PROGRAMS[key];
          const dayIdx = getRelativeDayIndexForDate(key, todayKey());
          const tasks = dayIdx ? (p.days[dayIdx - 1]?.tasks ?? []) : [];
          return (
            <div key={key} className="overflow-hidden rounded-2xl border" style={{ borderColor: COLORS.line }}>
              <div className="bg-white px-4 py-3">
                <div className="text-sm text-black/60">Programa</div>
                <div className="text-base font-semibold">{p.name}</div>
                <div className="text-xs text-black/60">Día {dayIdx || 1} / {p.days.length}</div>
              </div>

              <div className="bg-[#f7f7f7] px-4 py-3">
                <div className="mb-2 text-sm text-black/60">Retos de hoy</div>
                <ul className="space-y-3">
                  {tasks.map((t, i) => {
                    const done = isTaskTodayCompleted(key, i);
                    return (
                      <li key={i} className="flex items-center gap-3">
                        <button
                          onClick={() => { toggleTaskToday(key, i); bump(); }}
                          className="flex h-6 w-6 items-center justify-center rounded-full"
                          style={{ background: done ? COLORS.green : COLORS.red, color: '#fff' }}
                          aria-label={done ? 'Completado' : 'Sin completar'}
                        >
                          {done ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                              <path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                              <path d="M6 12h12" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                            </svg>
                          )}
                        </button>
                        <span className="text-sm text-black/80">{t}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================= */
/* Página principal              */
/* ============================= */
export default function Page() {
  const [tab, setTab] = useState<TabKey>('inicio');
  const [selectedHabit, setSelectedHabit] = useState<string | null>(null);

  // Splash 1.5s
  const [showSplash, setShowSplash] = useState(true);
  useEffect(() => { const t = setTimeout(() => setShowSplash(false), 1500); return () => clearTimeout(t); }, []);

  // Pensamiento del día (1 vez/día)
  const thought = useMemo(() => todayThought(), []);
  const [openThought, setOpenThought] = useState(false);
  useEffect(() => {
    if (showSplash) return;
    const key = `thought_${new Date().toDateString()}`;
    if (!localStorage.getItem(key)) { setOpenThought(true); localStorage.setItem(key, 'shown'); }
  }, [showSplash]);

  if (showSplash) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: COLORS.accent }}>
        <div className="relative w-screen" style={{ height: 0, paddingBottom: '177.78%' }}>
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
            {!selectedHabit ? (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h1 className="text-lg font-semibold">Pensamiento del día</h1>
                    <p className="text-xs text-black/60">{thought.title}: toca para leerlo de nuevo</p>
                  </div>
                  <button onClick={() => setOpenThought(true)} className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white">Ver pensamiento</button>
                </div>

                <div className="-mx-4">
                  {FEATURED_HABITS.map((h) => (
                    <div key={h.key}>
                      <HabitCard data={h} onOpen={(key) => setSelectedHabit(key)} />
                    </div>
                  ))}
                </div>

                <div className="mt-6 overflow-hidden rounded-2xl bg-white">
                  <div className="p-5">
                    <div className="mb-3 text-2xl font-bold leading-snug">
                      ¿Listo para más? <br /> Descubre todos los hábitos
                    </div>
                    <button onClick={() => setTab('habitos')} className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 text-white">
                      Ver hábitos <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <HabitDetail program={PROGRAMS[selectedHabit] ?? READING_PROGRAM} onBack={() => setSelectedHabit(null)} onStarted={() => {}} />
            )}
          </div>
        )}

        {/* HÁBITOS */}
        {tab === 'habitos' && (
          <div className="py-6">
            {!selectedHabit ? (
              <>
                <h2 className="text-xl font-semibold">Hábitos</h2>
                <p className="mt-1 text-sm text-black/70">Explora programas para instaurar o eliminar hábitos.</p>
                <div className="mt-4 -mx-4">
                  {FEATURED_HABITS.map((h) => (
                    <div key={h.key}>
                      <HabitCard data={h} onOpen={(key) => setSelectedHabit(key)} />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <HabitDetail program={PROGRAMS[selectedHabit] ?? READING_PROGRAM} onBack={() => setSelectedHabit(null)} onStarted={() => {}} />
            )}
          </div>
        )}

        {/* MI ZONA */}
        {tab === 'mizona' && <MiZona />}

        {/* HERRAMIENTAS (antes Formación) */}
        {tab === 'formacion' && <Herramientas />}

        {/* AMIGOS */}
        {tab === 'amigos' && (
          <div className="py-6">
            <h2 className="text-xl font-semibold">Amigos</h2>
            <p className="mt-1 text-sm text-black/70">Comparte retos y rachas con tu gente.</p>
          </div>
        )}
      </SafeContainer>

      <BottomNav active={tab} onChange={setTab} />
      <ThoughtModal open={openThought} onClose={() => setOpenThought(false)} thought={thought} />
    </div>
  );
}
