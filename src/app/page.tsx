'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  Home, ListChecks, User, GraduationCap, Users, X, ChevronRight, ChevronLeft, ChevronDown, ChevronUp, ArrowLeft,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Archivo_Black } from 'next/font/google';

/* =================== Tipografía para títulos =================== */
const archivoBlack = Archivo_Black({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-archivo-black',
});

/* =================== Colores =================== */
const COLORS = {
  bg: '#ffffff',
  text: '#111111',
  accent: '#FFD54F',
  black: '#000000',
  grayLight: '#f3f3f3',
  line: '#eaeaea',
  red: '#ef4444',
  orange: '#f59e0b',
  green: '#22c55e',
};

type TabKey = 'inicio' | 'habitos' | 'mizona' | 'formacion' | 'amigos';

/* =================== Pensamientos (L→D) =================== */
type Thought = { title: string; text: string };

const THOUGHTS_BY_DAY: Record<number, Thought> = {
  1: { title: 'Visualízate', text: 'Imagina por un momento que ya lo lograste. Hoy dedica 2–3 minutos a cerrar los ojos y verte consiguiendo tus objetivos.' },
  2: { title: 'Un paso más', text: 'Comprométete a un paso pequeño: 5 páginas de lectura o 10 minutos de movimiento.' },
  3: { title: 'Eres constante', text: 'La disciplina es volver incluso cuando pesa. Elige una acción mínima para no romper la cadena.' },
  4: { title: 'Confía en ti', text: 'Piensa en un reto que ya superaste. ¿Qué cualidades tuyas te ayudarán hoy?' },
  5: { title: 'El presente cuenta', text: 'Guarda 1€, elige una comida sana o sal a caminar 10 min. El cambio empieza ahora.' },
  6: { title: 'Pequeñas victorias', text: 'Envía ese mensaje pendiente, bebe agua extra o lee 2 páginas. Suma victorias.' },
  0: { title: 'Reflexiona y agradece', text: 'Reconoce lo logrado esta semana. Respira y agradece una acción que te hizo avanzar.' },
};

const todayThought = () => THOUGHTS_BY_DAY[new Date().getDay()];

/* =================== Programas (30 días dummy) =================== */

type DayTasks = { tasks: string[] };
type ProgramDef = {
  key: string;
  name: string;
  image: string;          // /public
  benefits: string[];
  howItWorks: string[];
  days: DayTasks[];       // 30 días
};

// 30 días de ejemplo para un programa genérico
function make30Days(prefix: string): DayTasks[] {
  const arr: DayTasks[] = [];
  for (let d = 1; d <= 30; d++) {
    // 2–3 tareas cortas para probar
    const base = [
      `${prefix}: tarea principal del día ${d}`,
      `Nota/registro del día ${d}`,
    ];
    if (d % 3 === 0) base.push(`Extra del día ${d}`);
    arr.push({ tasks: base });
  }
  return arr;
}

const PROGRAMS: Record<string, ProgramDef> = {
  lectura: {
    key: 'lectura',
    name: 'Conviértete en una máquina lectora',
    image: '/reading.jpg',
    benefits: [
      'Mejora concentración y claridad mental',
      'Aumenta creatividad y vocabulario',
      'Reduce el estrés y mejora el sueño',
    ],
    howItWorks: [
      '30 días con 2–3 micro-retos diarios.',
      'Empezar fácil; progresión suave.',
      'Registra cada día en “Mi Zona”.',
    ],
    days: make30Days('Lee 1–10 páginas'),
  },
  ejercicio: {
    key: 'ejercicio',
    name: 'Entrena cada día',
    image: '/burpees.jpg',
    benefits: [
      'Más energía y fuerza',
      'Mejora del ánimo',
      'Hábitos sostenibles',
    ],
    howItWorks: [
      '30 días con 2–3 micro-retos diarios.',
      'Cuerpo en movimiento > perfección.',
      'Registra cada día en “Mi Zona”.',
    ],
    days: make30Days('Muévete 10–20 minutos'),
  },
  ahorro: {
    key: 'ahorro',
    name: 'Ahorra sin darte cuenta',
    image: '/savings.jpg',
    benefits: [
      'Tranquilidad financiera',
      'Hábito de previsión',
      'Más control',
    ],
    howItWorks: [
      '30 días con 2–3 micro-retos diarios.',
      'Empieza por 1€ al día y crece.',
      'Registra cada día en “Mi Zona”.',
    ],
    days: make30Days('Ahorra 1–3€'),
  },
  meditacion: {
    key: 'meditacion',
    name: 'Medita 5 minutos',
    image: '/meditation.jpg',
    benefits: [
      'Calma mental',
      'Mejor foco',
      'Mejor descanso',
    ],
    howItWorks: [
      '30 días con 2–3 micro-retos diarios.',
      'Empieza con 2–5 minutos.',
      'Registra cada día en “Mi Zona”.',
    ],
    days: make30Days('Medita 2–10 min'),
  },
};

/* =================== Storage (usuarios + progreso) =================== */

type DayTasksState = number[]; // índices de tareas completadas (0..n-1)
type ProgramState = {
  startDate: string;                          // YYYY-MM-DD
  perDateTasks: Record<string, DayTasksState> // fecha->indices completados
};
type ProgramsStore = Record<string, ProgramState>;

type UserProfile = { name: string; email?: string };

const STORAGE_KEY = 'akira_programs_v2';
const USER_KEY = 'akira_user_v1';

const todayKey = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

function loadStore(): ProgramsStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function saveStore(store: ProgramsStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}
function loadUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveUser(u: UserProfile) {
  localStorage.setItem(USER_KEY, JSON.stringify(u));
}

function startProgram(key: string) {
  const store = loadStore();
  if (!store[key]) {
    store[key] = { startDate: todayKey(), perDateTasks: {} };
    saveStore(store);
  }
}

function getProgramDayIndexForDate(key: string, y: number, m: number, d: number) {
  const store = loadStore();
  const start = store[key]?.startDate;
  if (!start) return null;
  const date = new Date(y, m, d);
  const startDate = new Date(start + 'T00:00:00');
  const diff = Math.floor((date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  if (diff < 1 || diff > (PROGRAMS[key]?.days.length ?? 30)) return null;
  return diff; // 1..30
}

// Toggle de una tarea (por fecha)
function toggleTask(key: string, dateISO: string, taskIndex: number) {
  const store = loadStore();
  if (!store[key]) return;
  const set = new Set(store[key].perDateTasks[dateISO] ?? []);
  if (set.has(taskIndex)) set.delete(taskIndex);
  else set.add(taskIndex);
  store[key].perDateTasks[dateISO] = Array.from(set).sort((a,b)=>a-b);
  saveStore(store);
}

// estado de un día para un programa
function getDayStatusForProgram(key: string, dateISO: string) {
  const program = PROGRAMS[key];
  if (!program) return { total: 0, done: 0 };
  const store = loadStore();
  const ps = store[key];
  if (!ps) return { total: 0, done: 0 };

  const [y,m,d] = dateISO.split('-').map(Number);
  const dayIndex = getProgramDayIndexForDate(key, y, m-1, d);
  if (!dayIndex) return { total: 0, done: 0 };

  const tasks = program.days[dayIndex - 1]?.tasks ?? [];
  const doneIndices = new Set(ps.perDateTasks[dateISO] ?? []);
  let done = 0;
  for (let i = 0; i < tasks.length; i++) if (doneIndices.has(i)) done++;
  return { total: tasks.length, done };
}

/* =================== Helpers de fecha =================== */
function daysInMonth(year: number, monthIndex0: number) {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}
function ymd(date: Date) {
  return date.toISOString().slice(0, 10);
}

/* =================== UI: Layout helpers =================== */
const NAV_HEIGHT = 84; // ~ +30%

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

function BottomNav({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (k: TabKey) => void;
}) {
  const items: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: 'inicio',    label: 'Inicio',     icon: Home },
    { key: 'habitos',   label: 'Hábitos',    icon: ListChecks },
    { key: 'mizona',    label: 'Mi zona',    icon: User },
    { key: 'formacion', label: 'Formación',  icon: GraduationCap },
    { key: 'amigos',    label: 'Amigos',     icon: Users },
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

/* =================== Modal pensamiendo =================== */
function ThoughtModal({
  open, onClose, thought,
}: { open: boolean; onClose: () => void; thought: Thought }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="flex h-full items-center justify-center p-6">
            <motion.div
              className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
            >
              <button onClick={onClose} className="absolute right-3 top-3 rounded-full p-1 text-black/70 hover:bg-black/5" aria-label="Cerrar">
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

/* =================== Cards de hábitos (4:5) =================== */

interface HabitCardData {
  key: keyof typeof PROGRAMS;
  title: string;
  subtitle: string;
  image: string;
}

const FEATURED_HABITS: HabitCardData[] = [
  { key: 'lectura',    title: 'La máquina lectora',      subtitle: 'Conviértete en un superlector',  image: '/reading.jpg' },
  { key: 'ejercicio',  title: 'Unos f*kn burpees',       subtitle: 'Comienza hoy y no pares',         image: '/burpees.jpg' },
  { key: 'ahorro',     title: 'Ahorra sin darte cuenta', subtitle: 'Un hábito pequeño, gran cambio', image: '/savings.jpg' },
  { key: 'meditacion', title: 'Medita 5 minutos',        subtitle: 'Encuentra calma en tu día',      image: '/meditation.jpg' },
];

function HabitCard({ data, onOpen }: { data: HabitCardData; onOpen: (key: string) => void }) {
  return (
    <button className="relative block overflow-hidden" onClick={() => onOpen(data.key)}>
      <div className="relative w-full" style={{ aspectRatio: '4 / 5' }}>
        <Image
          src={data.image}
          alt={data.title}
          fill
          sizes="(max-width: 768px) 100vw, 600px"
          className="object-cover"
          priority={false}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/0" />
      </div>
      <div className="absolute inset-0 flex flex-col justify-end p-5 text-left">
        <div className="text-white/85 text-sm">{data.subtitle}</div>
        <div className={`${archivoBlack.className} text-white text-4xl leading-tight`}>{data.title}</div>
        <span className="mt-3 inline-flex items-center gap-2 self-start rounded-full bg-white/95 px-4 py-2 text-sm font-medium text-black">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5z"/></svg>
          Empezar ahora
        </span>
      </div>
    </button>
  );
}

/* =================== Detalle de hábito =================== */
function HabitDetail({
  program, onBack, onStarted,
}: { program: ProgramDef; onBack: () => void; onStarted: () => void }) {
  const [openedHow, setOpenedHow] = useState(false);

  const store = loadStore();
  const started = !!store[program.key];

  return (
    <div className="pb-6">
      <div className="relative w-full rounded-b-2xl overflow-hidden" style={{ aspectRatio: '16 / 9' }}>
        <Image src={program.image} alt={program.name} fill className="object-cover" priority />
        <div className="absolute left-3 top-3">
          <button onClick={onBack} className="rounded-full bg-black/60 p-2 text-white">
            <ArrowLeft className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="mt-4">
        <h1 className={`${archivoBlack.className} text-3xl leading-tight`}>{program.name}</h1>
        <p className="mt-2 text-sm text-black/70">Beneficios:</p>
        <ul className="mt-2 list-disc pl-5 text-sm text-black/80">
          {program.benefits.map((b, i) => (<li key={i}>{b}</li>))}
        </ul>
      </div>

      <div className="mt-4 rounded-2xl border" style={{ borderColor: COLORS.line }}>
        <button onClick={() => setOpenedHow(!openedHow)} className="flex w-full items-center justify-between px-4 py-3">
          <span className="text-base font-medium">¿Cómo funciona?</span>
          {openedHow ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>
        <AnimatePresence>
          {openedHow && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              <ul className="space-y-2 px-4 pb-4 text-sm text-black/70">
                {program.howItWorks.map((it, i) => (<li key={i}>• {it}</li>))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-5 rounded-2xl border p-4" style={{ borderColor: COLORS.line }}>
        <button
          onClick={() => { startProgram(program.key); onStarted(); }}
          className="rounded-full bg-black px-5 py-3 text-sm font-medium text-white"
        >
          {started ? 'Reiniciar desde hoy' : 'Empezar ahora'}
        </button>
      </div>
    </div>
  );
}

/* =================== Calendario mensual (Mi Zona) =================== */
function CalendarMonth({
  year, monthIndex0, // 0..11
  onPrev, onNext,
}: {
  year: number; monthIndex0: number;
  onPrev: () => void; onNext: () => void;
}) {
  const store = loadStore();
  const activeKeys = Object.keys(store).filter(k => PROGRAMS[k]);

  const days = daysInMonth(year, monthIndex0);
  const firstDow = new Date(year, monthIndex0, 1).getDay(); // 0=Dom

  // calcula color de un día según todos los programas activos
  function colorFor(day: number) {
    const iso = ymd(new Date(year, monthIndex0, day));
    let totalTasks = 0;
    let doneTasks = 0;
    for (const k of activeKeys) {
      const { total, done } = getDayStatusForProgram(k, iso);
      totalTasks += total;
      doneTasks += done;
    }
    if (totalTasks === 0) return 'transparent';           // sin tareas aplicables
    if (doneTasks === 0) return COLORS.red;               // ninguna
    if (doneTasks === totalTasks) return COLORS.green;    // todas
    return COLORS.orange;                                 // algunas
  }

  // grid con offset por día de la semana
  const blanks = (firstDow + 6) % 7; // queremos Lunes=0
  const cells: React.ReactNode[] = [];
  for (let i = 0; i < blanks; i++) cells.push(<div key={`b${i}`} />);
  for (let d = 1; d <= days; d++) {
    const c = colorFor(d);
    cells.push(
      <div key={d} className="flex items-center justify-center">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-xs"
          style={{ background: c === 'transparent' ? '#f4f4f4' : c, color: c === 'transparent' ? '#666' : '#fff' }}
          title={`${year}-${monthIndex0+1}-${d}`}
        >
          {d}
        </div>
      </div>
    );
  }

  const monthName = new Date(year, monthIndex0, 1).toLocaleString('es-ES', { month: 'long' });

  return (
    <div className="rounded-2xl border p-3" style={{ borderColor: COLORS.line }}>
      <div className="mb-2 flex items-center justify-between">
        <button onClick={onPrev} className="rounded-full p-2 hover:bg-black/5"><ChevronLeft className="h-5 w-5"/></button>
        <div className="text-sm font-medium capitalize">{monthName} {year}</div>
        <button onClick={onNext} className="rounded-full p-2 hover:bg-black/5"><ChevronRight className="h-5 w-5"/></button>
      </div>
      <div className="grid grid-cols-7 gap-2 text-center text-[11px] text-black/60 mb-1">
        <div>Lu</div><div>Ma</div><div>Mi</div><div>Ju</div><div>Vi</div><div>Sa</div><div>Do</div>
      </div>
      <div className="grid grid-cols-7 gap-2">{cells}</div>
    </div>
  );
}

/* =================== Mi Zona =================== */
function MiZona() {
  const [, force] = useState(0);
  const bump = () => force(v => v + 1);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [askName, setAskName] = useState(false);

  const [calYear, setCalYear] = useState<number>(new Date().getFullYear());
  const [calMonth0, setCalMonth0] = useState<number>(new Date().getMonth());

  useEffect(() => {
    const u = loadUser();
    if (u?.name) setUser(u);
    else setAskName(true);
  }, []);

  // resumen
  const store = loadStore();
  const activeKeys = Object.keys(store).filter(k => PROGRAMS[k]);

  // retos completados: total de checks de tareas
  let retosCompletados = 0;
  let diasConAlguna = 0;
  const diaVisto = new Set<string>();

  for (const k of activeKeys) {
    const ps = store[k];
    if (!ps) continue;
    for (const [date, arr] of Object.entries(ps.perDateTasks)) {
      retosCompletados += arr.length;
      // si ese día (entre todos) ya se tuvo alguna, marcar
      if (!diaVisto.has(date) && arr.length > 0) {
        diaVisto.add(date);
      }
    }
  }
  diasConAlguna = diaVisto.size;

  // tareas de HOY por programa (con checks independientes)
  const todayISO = todayKey();
  const todayByProgram = activeKeys.map((k) => {
    const program = PROGRAMS[k];
    const [y,m,d] = todayISO.split('-').map(Number);
    const idx = getProgramDayIndexForDate(k, y, m-1, d);
    const tasks = idx ? (program.days[idx-1]?.tasks ?? []) : [];
    const done = new Set(store[k]?.perDateTasks[todayISO] ?? []);
    return { key:k, program, tasks, done };
  }).filter(x => x.tasks.length > 0);

  return (
    <div className="py-6 space-y-4">
      {/* Saludo */}
      <div>
        <div className="text-2xl font-semibold">Hola {user?.name ?? '👋'}</div>
        <div className="text-sm text-black/60">Tu progreso y retos del día</div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border p-4" style={{ borderColor: COLORS.line }}>
          <div className={`${archivoBlack.className} text-4xl`}>{retosCompletados}</div>
          <div className="text-sm text-black/60">retos completados</div>
        </div>
        <div className="rounded-2xl border p-4" style={{ borderColor: COLORS.line }}>
          <div className={`${archivoBlack.className} text-4xl`}>{diasConAlguna}</div>
          <div className="text-sm text-black/60">días cumpliendo retos</div>
        </div>
      </div>

      {/* Calendario mensual */}
      <CalendarMonth
        year={calYear}
        monthIndex0={calMonth0}
        onPrev={() => {
          const m = calMonth0 - 1;
          if (m < 0) { setCalMonth0(11); setCalYear(y => y - 1); }
          else setCalMonth0(m);
        }}
        onNext={() => {
          const m = calMonth0 + 1;
          if (m > 11) { setCalMonth0(0); setCalYear(y => y + 1); }
          else setCalMonth0(m);
        }}
      />

      {/* Retos de HOY por programa activo */}
      <div className="space-y-3">
        {todayByProgram.length === 0 && (
          <div className="rounded-2xl border p-4 text-sm text-black/70" style={{ borderColor: COLORS.line }}>
            Aún no hay programas activos o hoy no corresponde tarea. Ve a “Hábitos” para empezar uno.
          </div>
        )}

        {todayByProgram.map(({ key, program, tasks, done }) => (
          <div key={key} className="overflow-hidden rounded-2xl border" style={{ borderColor: COLORS.line }}>
            <div className="bg-white px-4 py-3">
              <div className="text-sm text-black/60">Programa</div>
              <div className="text-base font-semibold">{program.name}</div>
            </div>

            <div className="bg-[#f7f7f7] px-4 py-3 space-y-2">
              <div className="mb-1 text-sm text-black/60">Retos de hoy</div>
              {tasks.map((t, i) => {
                const isDone = done.has(i);
                return (
                  <button
                    key={i}
                    onClick={() => { toggleTask(key, todayISO, i); bump(); }}
                    className="flex items-center gap-3 text-left"
                  >
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full border"
                      style={{
                        borderColor: isDone ? 'transparent' : COLORS.red,
                        background: isDone ? COLORS.green : 'transparent',
                      }}
                    >
                      {isDone ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill={COLORS.red}>
                          <circle cx="5" cy="5" r="5" />
                        </svg>
                      )}
                    </span>
                    <span className="text-sm">{t}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Modal para pedir nombre si no existe */}
      <AnimatePresence>
        {askName && (
          <motion.div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-6"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="w-full max-w-sm rounded-2xl bg-white p-5"
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}>
              <h3 className="text-lg font-semibold mb-2">¿Cómo te llamas?</h3>
              <p className="text-sm text-black/60 mb-3">Solo para saludarte :)</p>
              <NameForm onSave={(n) => { const u={name:n}; saveUser(u); setUser(u); setAskName(false); }} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NameForm({ onSave }: { onSave: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <form
      onSubmit={(e)=>{e.preventDefault(); if(name.trim()) onSave(name.trim());}}
      className="flex gap-2"
    >
      <input
        value={name} onChange={(e)=>setName(e.target.value)}
        placeholder="Tu nombre"
        className="flex-1 rounded-xl border px-3 py-2 text-sm outline-none"
        style={{ borderColor: COLORS.line }}
      />
      <button className="rounded-xl bg-black px-4 py-2 text-sm text-white">Guardar</button>
    </form>
  );
}

/* =================== Página principal =================== */
export default function Page() {
  const [tab, setTab] = useState<TabKey>('inicio');
  const [selectedHabit, setSelectedHabit] = useState<string | null>(null);

  // Splash
  const [showSplash, setShowSplash] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 1200);
    return () => clearTimeout(t);
  }, []);

  // Pensamiento del día (1 vez/día)
  const thought = useMemo(() => todayThought(), []);
  const [openThought, setOpenThought] = useState(false);
  useEffect(() => {
    if (showSplash) return;
    const key = `thought_${new Date().toDateString()}`;
    if (!localStorage.getItem(key)) {
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
            {!selectedHabit ? (
              <>
                {/* Cabecera pensamiento */}
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

                {/* Cards a sangre */}
                <div className="-mx-4">
                  {FEATURED_HABITS.map((h) => (
                    <div key={h.key}>
                      <HabitCard data={h} onOpen={(key) => setSelectedHabit(key)} />
                    </div>
                  ))}
                </div>

                {/* CTA final */}
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
              </>
            ) : (
              <HabitDetail
                program={PROGRAMS[selectedHabit] ?? PROGRAMS.lectura}
                onBack={() => setSelectedHabit(null)}
                onStarted={() => { setTab('mizona'); }}
              />
            )}
          </div>
        )}

        {/* HÁBITOS */}
        {tab === 'habitos' && (
          <div className="py-6">
            {!selectedHabit ? (
              <>
                <h2 className="text-xl font-semibold">Hábitos</h2>
                <p className="mt-1 text-sm text-black/70">Explora programas y empieza hoy.</p>
                <div className="mt-4 -mx-4">
                  {FEATURED_HABITS.map((h) => (
                    <div key={h.key}>
                      <HabitCard data={h} onOpen={(key) => setSelectedHabit(key)} />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <HabitDetail
                program={PROGRAMS[selectedHabit] ?? PROGRAMS.lectura}
                onBack={() => setSelectedHabit(null)}
                onStarted={() => { setTab('mizona'); }}
              />
            )}
          </div>
        )}

        {/* MI ZONA */}
        {tab === 'mizona' && <MiZona />}

        {/* Placeholders */}
        {tab === 'formacion' && (
          <div className="py-6">
            <h2 className="text-xl font-semibold">Formación</h2>
            <p className="mt-1 text-sm text-black/70">Cursos cortos por pilares: Salud, Bienestar emocional y Finanzas.</p>
          </div>
        )}
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

  );
}
