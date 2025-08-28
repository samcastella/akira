'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  Home, ListChecks, User, Wrench, Users, X, ChevronRight,
  Plus, Trash2, Edit3, Pin, ChevronLeft, ArrowLeft, Calendar as CalendarIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Archivo_Black } from 'next/font/google';

/* ===== Tipografía títulos ===== */
const archivoBlack = Archivo_Black({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-archivo-black',
});

/* ===== Colores ===== */
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

type TabKey = 'inicio' | 'habitos' | 'mizona' | 'herramientas' | 'amigos';

/* =================== Pensamiento del día =================== */
type Thought = { title: string; text: string };
const THOUGHTS_BY_DAY: Record<number, Thought> = {
  1: { title: 'Visualízate', text: 'Imagina por un momento que ya lo lograste. Hoy dedica 2–3 minutos a verte consiguiendo tus objetivos.' },
  2: { title: 'Un paso más', text: 'Comprométete con una acción mínima: 5 páginas o 10 min de movimiento.' },
  3: { title: 'Eres constante', text: 'La disciplina es volver incluso en los días flojos. Haz lo mínimo y celebra la racha.' },
  4: { title: 'Confía en ti', text: 'Recuerda un reto superado. ¿Qué cualidad te ayudó? Úsala hoy.' },
  5: { title: 'El presente cuenta', text: 'Haz un gesto sencillo: guarda 1€, respira profundo, sal a caminar.' },
  6: { title: 'Pequeñas victorias', text: 'Suma pequeñas victorias. Tu futuro lo nota.' },
  0: { title: 'Agradece', text: 'Reconoce lo logrado esta semana y agradece una cosa concreta.' },
};
const todayThought = () => THOUGHTS_BY_DAY[new Date().getDay()];

/* =================== Programas =================== */
type DayTasks = { tasks: string[] };
type ProgramDef = {
  key: string;
  name: string;
  image: string;
  benefits: string[];
  howItWorks: string[];
  days: DayTasks[];             // 21 o 30
};

function makeBurpees30(): DayTasks[] {
  const days: DayTasks[] = [];
  for (let d = 1; d <= 30; d++) {
    const reps = 5 + Math.floor(d * 0.8);
    const series = d <= 10 ? 3 : d <= 20 ? 4 : 5;
    days.push({
      tasks: [
        `Haz ${series}×${reps} burpees`,
        'Calienta 5 minutos y estira al final',
        'Registra cómo te sentiste (1–5)'
      ]
    });
  }
  return days;
}
function makeSavings30(): DayTasks[] {
  const days: DayTasks[] = [];
  for (let d = 1; d <= 30; d++) {
    const amt = d <= 10 ? 1 : d <= 20 ? 2 : 3; // €/día
    days.push({
      tasks: [
        `Ahorra ${amt} € hoy (hucha o sobre)`,
        'Revisa gastos de hoy y elimina 1 gasto invisible',
        'Escribe 1 motivo por el que ahorrar te da calma'
      ]
    });
  }
  return days;
}
function makeMeditation30(): DayTasks[] {
  const days: DayTasks[] = [];
  for (let d = 1; d <= 30; d++) {
    const min = d <= 10 ? 5 : d <= 20 ? 8 : 10;
    days.push({
      tasks: [
        `Medita ${min} minutos (timer)`,
        'Haz 3 tandas de respiración 4–7–8',
        'Anota una palabra sobre cómo te sientes'
      ]
    });
  }
  return days;
}

/* ---- Lectura 21 días (como acordamos) ---- */
const READING_PROGRAM: ProgramDef = {
  key: 'lectura',
  name: 'Conviértete en una máquina lectora',
  image: '/reading.jpg',
  benefits: [
    'Mejora concentración y claridad',
    'Más creatividad y vocabulario',
    'Menos estrés y mejor descanso'
  ],
  howItWorks: [
    '21 días con micro-retos diarios.',
    'Semana 1: 1–5 páginas. Semana 2: 5–10. Semana 3: 10–15.',
    'Marca cada día en “Mi zona”.'
  ],
  days: [
    { tasks: ['Ve a una librería y elige un libro ≤ 200–300 páginas.', 'Colócalo en un lugar visible.', 'Define hora/lugar y pon una alarma diaria.'] },
    { tasks: ['Lee 1 página.', 'Escribe por qué elegiste ese libro.', 'Haz una foto de tu rincón de lectura.'] },
    { tasks: ['Lee 1–5 páginas.', 'Prepara tu ritual (café, té, luz).', 'Marca una frase que te inspire.'] },
    { tasks: ['Lee 1–5 páginas.', 'Lee en voz alta un párrafo.', 'Escribe una frase sobre lo que sentiste.'] },
    { tasks: ['Lee 1–5 páginas en un lugar distinto.', 'Apunta una idea clave.', 'Cuéntaselo a alguien.'] },
    { tasks: ['Lee 1–5 páginas.', 'Evalúa tu concentración (1–5).', 'Ajusta la hora si no encaja.'] },
    { tasks: ['Lee 1–5 páginas.', 'Relee tus notas.', 'Celebra la primera semana.'] },
    { tasks: ['Lee 5 páginas.', 'Una frase aplicable hoy.', 'Compártela con alguien.'] },
    { tasks: ['Lee 6 páginas.', 'Asóciala a otro hábito (desayuno).', 'Lo más útil del día.'] },
    { tasks: ['Lee 6–7 páginas.', 'Marca 2 aprendizajes clave.', 'Recompénsate.'] },
    { tasks: ['Lee 7 páginas.', 'Comparte lo más interesante.', 'Haz check de racha.'] },
    { tasks: ['Lee 8 páginas.', 'Una idea aplicable hoy.', 'Ponla en práctica.'] },
    { tasks: ['Lee 8–9 páginas.', '2 frases de reflexión.', 'Foto del libro.'] },
    { tasks: ['Lee 10 páginas.', 'Balance de semana.', 'Recompensa.'] },
    { tasks: ['Escribe: “Soy alguien que lee a diario”.', 'Lee 10 páginas.', 'Cuenta a alguien tu hábito.'] },
    { tasks: ['Elige tu próxima lectura.', 'Lee 11 páginas.', 'Story con frase favorita.'] },
    { tasks: ['Lee 12 páginas.', 'Mini-resumen (3–4 frases).', 'Plan para terminar.'] },
    { tasks: ['Lee 12–13 páginas.', '2 ideas prácticas.', 'Aplica 1 hoy.'] },
    { tasks: ['Lee 13 páginas.', 'Comparte aprendizajes.', 'Refuerza tu identidad lectora.'] },
    { tasks: ['Lee 14 páginas.', 'Repasa todas tus notas.', 'Elige la idea más potente.'] },
    { tasks: ['Lee 15 páginas o termina el libro.', 'Balance final.', 'Comparte tu logro y el siguiente libro.'] }
  ],
};

const BURPEES_PROGRAM: ProgramDef = {
  key: 'burpees',
  name: 'Unos f*kn burpees',
  image: '/burpees.jpg',
  benefits: ['Resistencia y fuerza', 'Aumenta la energía', 'Mejora la disciplina'],
  howItWorks: ['30 días', 'Progresión suave', 'Marca a diario en “Mi zona”'],
  days: makeBurpees30(),
};
const SAVINGS_PROGRAM: ProgramDef = {
  key: 'ahorro',
  name: 'Ahorra sin darte cuenta',
  image: '/savings.jpg',
  benefits: ['Más tranquilidad', 'Fondo para imprevistos', 'Mejor control financiero'],
  howItWorks: ['30 días', 'Pequeñas cantidades diarias', 'Conciencia de gastos'],
  days: makeSavings30(),
};
const MEDITATION_PROGRAM: ProgramDef = {
  key: 'meditacion',
  name: 'Medita 5 minutos',
  image: '/meditation.jpg',
  benefits: ['Baja el estrés', 'Mejora el foco', 'Más serenidad'],
  howItWorks: ['30 días', 'De 5 a 10 minutos', 'Respiración guiada simple'],
  days: makeMeditation30(),
};

const PROGRAMS: Record<string, ProgramDef> = {
  [READING_PROGRAM.key]: READING_PROGRAM,
  [BURPEES_PROGRAM.key]: BURPEES_PROGRAM,
  [SAVINGS_PROGRAM.key]: SAVINGS_PROGRAM,
  [MEDITATION_PROGRAM.key]: MEDITATION_PROGRAM,
};

/* =================== Store Programas (localStorage) =================== */

type ProgramState = {
  startDate: string;                     // YYYY-MM-DD
  // por fecha: índices de tareas completadas ese día
  completions: Record<string, number[]>;
};

type ProgramsStore = Record<string, ProgramState>;
const STORAGE_KEY = 'akira_programs_v2';

const todayKey = () => new Date().toISOString().slice(0,10);

function loadStore(): ProgramsStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function saveStore(s: ProgramsStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}
function startProgram(key: string) {
  const s = loadStore();
  if (!s[key]) s[key] = { startDate: todayKey(), completions: {} };
  saveStore(s);
}
function toggleTaskToday(key: string, taskIndex: number) {
  const s = loadStore();
  if (!s[key]) return;
  const t = todayKey();
  const arr = new Set(s[key].completions[t] ?? []);
  arr.has(taskIndex) ? arr.delete(taskIndex) : arr.add(taskIndex);
  s[key].completions[t] = Array.from(arr).sort((a,b)=>a-b);
  saveStore(s);
}
function isTaskDoneToday(key: string, taskIndex: number) {
  const s = loadStore();
  const t = todayKey();
  return !!s[key]?.completions[t]?.includes(taskIndex);
}
function getProgramDayIndex(key: string) {
  const s = loadStore();
  const start = s[key]?.startDate;
  if (!start) return 1;
  const startDate = new Date(start + 'T00:00:00');
  const diff = Math.floor((Date.now() - startDate.getTime())/(1000*60*60*24)) + 1;
  const total = PROGRAMS[key]?.days.length ?? 21;
  return Math.min(Math.max(diff,1), total);
}
function getTotalsForDate(dateISO: string) {
  // suma de tareas realizadas / totales entre TODOS los programas activos
  const s = loadStore();
  let totalTasks = 0, done = 0;
  for (const key of Object.keys(s)) {
    const p = PROGRAMS[key];
    if (!p) continue;
    // ¿qué día correspondía esa fecha?
    const start = new Date(s[key].startDate+'T00:00:00');
    const d = Math.floor((new Date(dateISO).getTime() - start.getTime())/(1000*60*60*24)) + 1;
    if (d < 1 || d > p.days.length) continue;
    const tasksToday = p.days[d-1].tasks.length;
    totalTasks += tasksToday;
    const doneToday = s[key].completions[dateISO]?.length ?? 0;
    done += Math.min(doneToday, tasksToday);
  }
  return { totalTasks, done };
}
function getGlobalStats() {
  const s = loadStore();
  let checks = 0;
  let daysWithAny = 0;
  const seenDays = new Set<string>();
  for (const key of Object.keys(s)) {
    const c = s[key].completions;
    for (const day of Object.keys(c)) {
      checks += c[day].length;
      if (!seenDays.has(day)) {
        const any = c[day].length > 0;
        if (any) daysWithAny++;
        seenDays.add(day);
      }
    }
  }
  return { checks, daysWithAny };
}

/* =================== Cards de hábitos =================== */
interface HabitCardData {
  key: string;
  title: string;
  subtitle: string;
  image: string;
}
const FEATURED_HABITS: HabitCardData[] = [
  { key: 'lectura',    title: 'La máquina lectora',      subtitle: 'Conviértete en un superlector', image: '/reading.jpg' },
  { key: 'burpees',    title: 'Unos f*kn burpees',       subtitle: 'Comienza hoy y no pares',        image: '/burpees.jpg' },
  { key: 'ahorro',     title: 'Ahorra sin darte cuenta', subtitle: 'Un hábito pequeño con impacto',  image: '/savings.jpg' },
  { key: 'meditacion', title: 'Medita 5 minutos',        subtitle: 'Encuentra calma en tu día',      image: '/meditation.jpg' },
];

/* ===== Layout ===== */
const NAV_HEIGHT = 84;
function SafeContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md px-4" style={{ paddingBottom: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom,0px))` }}>
      {children}
    </div>
  );
}

/* ===== Bottom Nav ===== */
function BottomNav({ active, onChange }: { active: TabKey; onChange: (k: TabKey)=>void; }) {
  const items: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: 'inicio',       label: 'Inicio',        icon: Home },
    { key: 'habitos',      label: 'Hábitos',       icon: ListChecks },
    { key: 'mizona',       label: 'Mi zona',       icon: User },
    { key: 'herramientas', label: 'Herramientas',  icon: Wrench },
    { key: 'amigos',       label: 'Amigos',        icon: Users },
  ];

  return (
    <div className="fixed inset-x-0 bottom-0 z-30" style={{ height: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom,0px))`, background: COLORS.accent, paddingBottom: 'env(safe-area-inset-bottom,0px)' }}>
      <div className="mx-auto grid h-full max-w-md grid-cols-5">
        {items.map(({key,label,icon:Icon})=>{
          const isActive = key===active;
          let bg = isActive ? '#fff' : COLORS.accent;
          let fg = COLORS.text;
          if (key==='mizona') {
            bg = isActive ? '#fff' : COLORS.black;
            fg = isActive ? COLORS.text : '#fff';
          }
          return (
            <button key={key} onClick={()=>onChange(key)} className="flex h-full flex-col items-center justify-center transition-colors" style={{ background:bg, color:fg }} aria-label={label}>
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
function ThoughtModal({ open, onClose, thought }: { open:boolean; onClose:()=>void; thought:Thought; }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
          <div className="flex h-full items-center justify-center p-6">
            <motion.div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" initial={{scale:0.95,opacity:0,y:10}} animate={{scale:1,opacity:1,y:0}} exit={{scale:0.95,opacity:0,y:10}}>
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

/* ===== Card Hábito ===== */
function HabitCard({ data, onOpen }: { data:HabitCardData; onOpen:(key:string)=>void; }) {
  return (
    <button className="relative block overflow-hidden" onClick={()=>onOpen(data.key)}>
      <div className="relative w-full" style={{ aspectRatio: '4 / 5' }}>
        <Image src={data.image} alt={data.title} fill sizes="(max-width:768px) 100vw, 600px" className="object-cover" priority={false}/>
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/0" />
      </div>
      <div className="absolute inset-0 flex flex-col justify-end p-5 text-left">
        <div className="text-white/85 text-sm">{data.subtitle}</div>
        <div className={`${archivoBlack.className} text-white text-4xl leading-tight`}>{data.title}</div>
        <div className="mt-3 inline-flex items-center gap-2 self-start rounded-full bg-white/95 px-4 py-2 text-sm font-medium text-black">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5z"/></svg>
          Empezar ahora
        </div>
      </div>
    </button>
  );
}

/* ===== Detalle Hábito ===== */
function HabitDetail({ program, onBack, onStarted }: { program:ProgramDef; onBack:()=>void; onStarted:()=>void; }) {
  const [openedHow, setOpenedHow] = useState(false);
  const [justStarted, setJustStarted] = useState(false);
  const dayIndex = getProgramDayIndex(program.key);
  const progress = useMemo(()=>{
    const s = loadStore();
    const c = s[program.key]?.completions ?? {};
    const uniqueDays = Object.keys(c).length;
    const total = program.days.length;
    return Math.round(Math.min(100, (uniqueDays / total) * 100));
  }, [program.key]);

  const handleStart = () => {
    startProgram(program.key);
    setJustStarted(true);
    onStarted();
  };

  return (
    <div className="pb-6">
      <div className="relative w-full overflow-hidden rounded-b-2xl" style={{ aspectRatio: '16 / 9' }}>
        <Image src={program.image} alt={program.name} fill className="object-cover"/>
        <button onClick={onBack} className="absolute left-3 top-3 rounded-full bg-black/60 p-2 text-white"><ArrowLeft className="h-5 w-5"/></button>
      </div>

      <div className="mt-4">
        <h1 className={`${archivoBlack.className} text-3xl leading-tight`}>{program.name}</h1>
        <ul className="mt-2 list-disc pl-5 text-sm text-black/80">
          {program.benefits.map((b,i)=>(<li key={i}>{b}</li>))}
        </ul>
      </div>

      <div className="mt-4 rounded-2xl border" style={{borderColor:COLORS.line}}>
        <button onClick={()=>setOpenedHow(!openedHow)} className="flex w-full items-center justify-between px-4 py-3">
          <span className="text-base font-medium">¿Cómo funciona?</span>
          {openedHow ? <ChevronLeft className="h-5 w-5 rotate-90"/> : <ChevronLeft className="h-5 w-5 -rotate-90" />}
        </button>
        <AnimatePresence>
          {openedHow && (
            <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}}>
              <ul className="space-y-2 px-4 pb-4 text-sm text-black/70">
                {program.howItWorks.map((it,i)=>(<li key={i}>• {it}</li>))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-5 rounded-2xl border p-4" style={{borderColor:COLORS.line}}>
        <div className="flex items-center justify-between">
          <button onClick={handleStart} className="rounded-full bg-black px-5 py-3 text-sm font-medium text-white">Empezar ahora</button>
          <div className="text-sm text-black/60">Día {dayIndex} / {program.days.length}</div>
        </div>
        {justStarted && <div className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">¡Enhorabuena por empezar el reto!</div>}
        <div className="mt-4">
          <div className="h-3 w-full rounded-full bg-gray-200">
            <div className="h-3 rounded-full bg-black transition-all" style={{width:`${progress}%`}}/>
          </div>
          <div className="mt-1 text-right text-xs text-black/60">{progress}%</div>
        </div>
      </div>
    </div>
  );
}

/* =================== Mi Zona =================== */
function monthKey(d: Date) { return d.toISOString().slice(0,7); }
function daysInMonth(date: Date) {
  const year = date.getFullYear(), month = date.getMonth();
  const first = new Date(year, month, 1);
  const lastDay = new Date(year, month+1, 0).getDate();
  return Array.from({length:lastDay}, (_,i)=> new Date(year, month, i+1));
}

function MiZona() {
  const [profileName, setProfileName] = useState<string>('');
  const [editingName, setEditingName] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [tick, setTick] = useState(0); // para refrescar tras toggles

  useEffect(()=>{
    const name = localStorage.getItem('akira_name_v1') ?? '';
    setProfileName(name);
  },[]);

  const activeKeys = useMemo(()=>Object.keys(loadStore()).filter(k=>PROGRAMS[k]), [tick]);

  const stats = useMemo(()=>getGlobalStats(), [tick]);

  const monthDays = useMemo(()=>daysInMonth(currentMonth), [currentMonth]);

  const colorForDate = (d: Date) => {
    const iso = d.toISOString().slice(0,10);
    const { totalTasks, done } = getTotalsForDate(iso);
    if (totalTasks===0) return '#d1d5db'; // gris (sin programas activos ese día)
    if (done===0 && d < new Date(new Date().toDateString())) return COLORS.red;
    if (done===0) return '#e5e7eb';
    if (done===totalTasks) return COLORS.green;
    return COLORS.orange;
  };

  return (
    <div className="py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className={`${archivoBlack.className} text-2xl`}>Hola {profileName || 'Akira'}</h2>
          <div className="text-sm text-black/60">Tu progreso diario</div>
        </div>
        <button onClick={()=>setEditingName(true)} className="rounded-full border px-3 py-1 text-sm">Editar nombre</button>
      </div>

      {/* Calendario mensual */}
      <div className="mb-3 flex items-center gap-2">
        <button onClick={()=>setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth()-1, 1))} className="rounded-full border p-1"><ChevronLeft className="h-4 w-4"/></button>
        <div className="flex items-center gap-2 text-sm font-medium"><CalendarIcon className="h-4 w-4"/>{currentMonth.toLocaleString('es-ES',{month:'long', year:'numeric'})}</div>
        <button onClick={()=>setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth()+1, 1))} className="rounded-full border p-1"><ChevronRight className="h-4 w-4"/></button>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {monthDays.map((d)=>(
          <div key={d.toISOString()} className="flex items-center justify-center rounded-full text-xs font-medium" style={{background: colorForDate(d), color:'#fff', width:34, height:34}}>
            {d.getDate()}
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border p-4">
          <div className={`${archivoBlack.className} text-3xl`}>{stats.checks}</div>
          <div className="text-sm text-black/60">retos completados</div>
        </div>
        <div className="rounded-2xl border p-4">
          <div className={`${archivoBlack.className} text-3xl`}>{stats.daysWithAny}</div>
          <div className="text-sm text-black/60">días cumpliendo retos</div>
        </div>
      </div>

      {/* Programas activos y tareas del día (checks individuales) */}
      <div className="mt-6 space-y-4">
        {activeKeys.length===0 && (
          <div className="rounded-2xl border p-4 text-sm text-black/70">
            Aún no has empezado ningún programa. Ve a “Hábitos” o “Inicio” y toca un hábito para comenzarlo.
          </div>
        )}

        {activeKeys.map((key)=>{
          const p = PROGRAMS[key];
          const day = getProgramDayIndex(key);
          const tasks = p.days[day-1]?.tasks ?? [];
          return (
            <div key={key} className="overflow-hidden rounded-2xl border" style={{borderColor:COLORS.line}}>
              <div className="bg-white px-4 py-3">
                <div className="text-xs text-black/60">Programa</div>
                <div className="text-base font-semibold">{p.name} — Día {day}/{p.days.length}</div>
              </div>
              <div className="bg-[#f7f7f7] px-4 py-3">
                <ul className="space-y-2">
                  {tasks.map((t,idx)=>{
                    const done = isTaskDoneToday(key, idx);
                    return (
                      <li key={idx} className="flex items-center gap-3">
                        <button
                          onClick={()=>{ toggleTaskToday(key, idx); setTick(v=>v+1); }}
                          className="flex h-6 w-6 items-center justify-center rounded-full border"
                          style={{
                            borderColor: done ? 'transparent' : '#c7c7c7',
                            background: done ? COLORS.green : COLORS.red,
                            color: '#fff'
                          }}
                          aria-label={done ? 'Marcado' : 'Sin marcar'}
                        >
                          {done ? '✓' : '✕'}
                        </button>
                        <span className="text-sm">{t}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      {/* Editar nombre (modal simple) */}
      <AnimatePresence>
        {editingName && (
          <motion.div className="fixed inset-0 z-40 bg-black/40" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
            <div className="flex h-full items-center justify-center p-6">
              <motion.div className="w-full max-w-sm rounded-2xl bg-white p-4" initial={{scale:.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:.95,opacity:0}}>
                <div className="mb-2 text-sm font-medium">Tu nombre</div>
                <input className="w-full rounded-lg border px-3 py-2" defaultValue={profileName} onChange={(e)=>setProfileName(e.target.value)}/>
                <div className="mt-3 flex justify-end gap-2">
                  <button className="rounded-lg border px-3 py-2 text-sm" onClick={()=>setEditingName(false)}>Cancelar</button>
                  <button className="rounded-lg bg-black px-3 py-2 text-sm text-white" onClick={()=>{
                    localStorage.setItem('akira_name_v1', profileName);
                    setEditingName(false);
                  }}>Guardar</button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* =================== Herramientas (Notas, Gratitud, Imágenes) =================== */
type Note = { id: string; text: string; createdAt: string };
type Gratitude = { date: string; items: string[] };
type GalleryItem = { id: string; dataUrl: string; caption?: string; createdAt: string };

const NOTES_KEY = 'akira_notes_v1';
const GRATITUDE_KEY = 'akira_gratitude_v1';
const GALLERY_KEY = 'akira_gallery_v1';

function loadJSON<T>(key:string, def:T): T { try { const r = localStorage.getItem(key); return r? JSON.parse(r) as T : def; } catch { return def; } }
function saveJSON<T>(key:string, value:T) { localStorage.setItem(key, JSON.stringify(value)); }

function Herramientas() {
  const [tab, setTab] = useState<'notas'|'gratitud'|'imagenes'>('notas');
  return (
    <div className="py-6">
      <h2 className="text-xl font-semibold">Herramientas</h2>
      <div className="mt-3 grid grid-cols-3 rounded-lg bg-[#f7f7f7] p-1 text-sm">
        {(['notas','gratitud','imagenes'] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)} className="rounded-md px-3 py-2" style={{ background: tab===t ? '#fff' : 'transparent', fontWeight: tab===t ? 600 : 500 }}>
            {t==='notas'?'Mis notas': t==='gratitud'?'Diario de gratitud':'Imágenes que me hacen sentir bien'}
          </button>
        ))}
      </div>

      {tab==='notas' && <NotasTool/>}
      {tab==='gratitud' && <GratitudTool/>}
      {tab==='imagenes' && <ImagenesTool/>}
    </div>
  );
}

function NotasTool() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState('');
  useEffect(()=>{ setNotes(loadJSON<Note[]>(NOTES_KEY, [])); },[]);
  const save = (ns:Note[])=>{ setNotes(ns); saveJSON(NOTES_KEY, ns); };

  return (
    <div className="mt-4">
      <div className="mb-3 text-sm text-black/70">Escribe frases, ideas o reflexiones. Se guardan y puedes editarlas.</div>
      <div className="flex gap-2">
        <input className="flex-1 rounded-lg border px-3 py-2" value={text} placeholder="Escribe una nota..." onChange={(e)=>setText(e.target.value)}/>
        <button className="rounded-lg bg-black px-3 py-2 text-white" onClick={()=>{
          if (!text.trim()) return;
          const n:Note = { id: crypto.randomUUID(), text: text.trim(), createdAt: new Date().toISOString() };
          save([n, ...notes]); setText('');
        }}><Plus className="h-4 w-4"/></button>
      </div>
      <div className="mt-4 space-y-3">
        {notes.map(n=>(
          <div key={n.id} className="rounded-xl border p-3">
            <div className="text-sm">{n.text}</div>
            <div className="mt-2 flex gap-2 text-xs text-black/50">
              <span>{new Date(n.createdAt).toLocaleString()}</span>
              <button onClick={()=> {
                const t = prompt('Editar nota', n.text);
                if (t!=null) { n.text = t; save([...notes]); }
              }} className="ml-auto inline-flex items-center gap-1"><Edit3 className="h-3 w-3"/> Editar</button>
              <button onClick={()=> save(notes.filter(x=>x.id!==n.id))} className="inline-flex items-center gap-1 text-red-600"><Trash2 className="h-3 w-3"/> Borrar</button>
            </div>
          </div>
        ))}
        {notes.length===0 && <div className="text-sm text-black/60">Sin notas todavía.</div>}
      </div>
    </div>
  );
}

function GratitudTool() {
  const [map,setMap] = useState<Record<string, Gratitude>>({});
  const [date, setDate] = useState<string>(todayKey());
  useEffect(()=>{ setMap(loadJSON<Record<string,Gratitude>>(GRATITUDE_KEY, {})); },[]);
  const items = map[date]?.items ?? [];
  const save = (m: typeof map) => { setMap(m); saveJSON(GRATITUDE_KEY, m); };

  return (
    <div className="mt-4">
      <div className="mb-2 text-sm text-black/70">Escribe por lo que das las gracias hoy. Se guarda por día.</div>
      <div className="mb-3 flex items-center gap-2">
        <button onClick={()=>setDate(new Date(new Date(date).getTime()-86400000).toISOString().slice(0,10))} className="rounded-full border p-1"><ChevronLeft className="h-4 w-4"/></button>
        <input type="date" className="rounded-lg border px-2 py-1 text-sm" value={date} onChange={(e)=>setDate(e.target.value)}/>
        <button onClick={()=>setDate(new Date(new Date(date).getTime()+86400000).toISOString().slice(0,10))} className="rounded-full border p-1"><ChevronRight className="h-4 w-4"/></button>
      </div>
      <div className="space-y-2">
        {[0,1,2].map(i=>(
          <input key={i} className="w-full rounded-lg border px-3 py-2 text-sm" placeholder={`Motivo #${i+1}`} value={items[i] ?? ''} onChange={(e)=>{
            const next = {...map};
            const list = [...items];
            list[i] = e.target.value;
            next[date] = { date, items: list };
            save(next);
          }}/>
        ))}
      </div>
    </div>
  );
}

function ImagenesTool() {
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [caption, setCaption] = useState('');
  useEffect(()=>{ setGallery(loadJSON<GalleryItem[]>(GALLERY_KEY, [])); },[]);
  const save = (g:GalleryItem[]) => { setGallery(g); saveJSON(GALLERY_KEY, g); };

  return (
    <div className="mt-4">
      <div className="mb-2 text-sm text-black/70">Sube o captura imágenes que te hagan sentir bien.</div>
      <div className="flex items-center gap-2">
        <input id="imgInput" type="file" accept="image/*" className="hidden" onChange={async (e)=>{
          const file = e.target.files?.[0]; if (!file) return;
          const reader = new FileReader();
          reader.onload = ()=> {
            const it: GalleryItem = { id: crypto.randomUUID(), dataUrl: String(reader.result), caption, createdAt: new Date().toISOString() };
            save([it, ...gallery]); setCaption(''); (e.target as HTMLInputElement).value = '';
          };
          reader.readAsDataURL(file);
        }}/>
        <input className="flex-1 rounded-lg border px-3 py-2 text-sm" placeholder="Descripción (opcional)" value={caption} onChange={(e)=>setCaption(e.target.value)} />
        <button className="rounded-lg bg-black px-3 py-2 text-white" onClick={()=>document.getElementById('imgInput')?.click()}><Pin className="h-4 w-4"/></button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {gallery.map(g=>(
          <div key={g.id} className="overflow-hidden rounded-xl border">
            <div className="relative w-full" style={{aspectRatio:'4/5'}}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.dataUrl} alt={g.caption ?? 'imagen'} className="h-full w-full object-cover"/>
            </div>
            <div className="truncate px-2 py-1 text-xs text-black/70">{g.caption}</div>
          </div>
        ))}
        {gallery.length===0 && <div className="text-sm text-black/60">Aún no hay imágenes.</div>}
      </div>
    </div>
  );
}

/* =================== Página principal =================== */
export default function Page() {
  const [tab, setTab] = useState<TabKey>('inicio');
  const [selectedHabit, setSelectedHabit] = useState<string|null>(null);

  const [showSplash, setShowSplash] = useState(true);
  useEffect(()=>{ const t = setTimeout(()=>setShowSplash(false), 1200); return ()=>clearTimeout(t); },[]);

  const thought = useMemo(()=>todayThought(), []);
  const [openThought, setOpenThought] = useState(false);
  useEffect(()=>{
    if (showSplash) return;
    const key = `thought_${new Date().toDateString()}`;
    const shown = localStorage.getItem(key);
    if (!shown) { setOpenThought(true); localStorage.setItem(key, 'shown'); }
  },[showSplash]);

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
        {tab==='inicio' && (
          <div className="py-6">
            {!selectedHabit ? (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h1 className="text-lg font-semibold">Pensamiento del día</h1>
                    <p className="text-xs text-black/60">{thought.title}: toca para leerlo de nuevo</p>
                  </div>
                  <button onClick={()=>setOpenThought(true)} className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white">Ver pensamiento</button>
                </div>

                <div className="-mx-4">
                  {FEATURED_HABITS.map(h=>(
                    <div key={h.key} className="mb-4">
                      <HabitCard data={h} onOpen={(key)=>setSelectedHabit(key)} />
                    </div>
                  ))}
                </div>

                <div className="mt-6 overflow-hidden rounded-2xl bg-white">
                  <div className="p-5">
                    <div className="mb-3 text-2xl font-bold leading-snug">¿Listo para más? <br/> Descubre todos los hábitos</div>
                    <button onClick={()=>setTab('habitos')} className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 text-white">
                      Ver hábitos <ChevronRight className="h-4 w-4"/>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <HabitDetail program={PROGRAMS[selectedHabit] ?? READING_PROGRAM} onBack={()=>setSelectedHabit(null)} onStarted={()=>{}}/>
            )}
          </div>
        )}

        {/* HÁBITOS */}
        {tab==='habitos' && (
          <div className="py-6">
            {!selectedHabit ? (
              <>
                <h2 className="text-xl font-semibold">Hábitos</h2>
                <p className="mt-1 text-sm text-black/70">Explora y empieza un programa.</p>
                <div className="mt-4 -mx-4">
                  {FEATURED_HABITS.map(h=>(
                    <div key={h.key} className="mb-4">
                      <HabitCard data={h} onOpen={(key)=>setSelectedHabit(key)} />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <HabitDetail program={PROGRAMS[selectedHabit] ?? READING_PROGRAM} onBack={()=>setSelectedHabit(null)} onStarted={()=>{}}/>
            )}
          </div>
        )}

        {/* MI ZONA */}
        {tab==='mizona' && <MiZona />}

        {/* HERRAMIENTAS */}
        {tab==='herramientas' && <Herramientas />}

        {/* AMIGOS (placeholder; grupos vendrán después) */}
        {tab==='amigos' && (
          <div className="py-6">
            <h2 className="text-xl font-semibold">Amigos</h2>
            <p className="mt-1 text-sm text-black/70">Próximamente: crea grupos, invita a amigos y sumad puntos juntos.</p>
          </div>
        )}
      </SafeContainer>

      <BottomNav active={tab} onChange={setTab}/>
      <ThoughtModal open={openThought} onClose={()=>setOpenThought(false)} thought={thought}/>
    </div>
  );
}
